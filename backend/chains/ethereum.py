"""
Sentinel AI — Ethereum Chain Adapter
Async Etherscan v2 integration with structured errors (no print statements).
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

import config  # noqa: F401 — ensures load_dotenv() runs before API calls

ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"


class ChainAdapterError(Exception):
    """Base error for chain adapter failures."""

    def __init__(self, code: str, message: str, details: Optional[dict] = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


class EtherscanError(ChainAdapterError):
    pass


def _get_api_key() -> str:
    api_key = os.getenv("ETHERSCAN_API_KEY")
    if not api_key:
        raise EtherscanError("ETHERSCAN_KEY_MISSING", "ETHERSCAN_API_KEY is not configured")
    return api_key


async def get_eth_balance(address: str) -> float:
    """Fetch ETH balance for an address. Returns ETH float."""
    params = {
        "chainid": "1",
        "module": "account",
        "action": "balance",
        "address": address,
        "tag": "latest",
        "apikey": _get_api_key(),
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(ETHERSCAN_BASE, params=params)
            data = resp.json()
            if data.get("status") == "1":
                return round(int(data["result"]) / 1e18, 4)
            raise EtherscanError(
                "ETHERSCAN_BALANCE_ERROR",
                data.get("message", "Unknown Etherscan balance error"),
                {"address": address, "http_status": resp.status_code},
            )
    except EtherscanError:
        raise
    except httpx.HTTPError as e:
        raise EtherscanError("ETHERSCAN_HTTP_ERROR", str(e), {"address": address}) from e


async def get_eth_transactions(address: str, limit: int = 10, days: Optional[int] = None) -> list[dict]:
    """
    Fetch recent ETH transactions. Returns normalized list.
    When days is set, paginates until history older than cutoff or no more results.
    """
    if days is not None:
        return await get_eth_transactions_since(address, days=days, page_size=min(limit, 100))

    params = {
        "chainid": "1",
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "page": 1,
        "offset": limit,
        "sort": "desc",
    }
    return await _fetch_tx_page(address, params)


async def get_eth_transactions_since(address: str, days: int = 90, page_size: int = 100) -> list[dict]:
    """Fetch all transactions within the last N days via Etherscan pagination."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    all_txs: list[dict] = []
    page = 1

    while True:
        params = {
            "chainid": "1",
            "module": "account",
            "action": "txlist",
            "address": address,
            "startblock": 0,
            "endblock": 99999999,
            "page": page,
            "offset": page_size,
            "sort": "desc",
        }
        page_txs = await _fetch_tx_page(address, params, raw=True)
        if not page_txs:
            break

        reached_cutoff = False
        for raw in page_txs:
            ts = datetime.fromtimestamp(int(raw["timeStamp"]), tz=timezone.utc)
            if ts < cutoff:
                reached_cutoff = True
                break
            all_txs.append(_normalize_eth_tx(raw, address))

        if reached_cutoff or len(page_txs) < page_size:
            break
        page += 1
        await asyncio.sleep(0.25)
        if page > 100:
            break

    return all_txs


async def _fetch_tx_page(address: str, params: dict, raw: bool = False) -> list:
    params["apikey"] = _get_api_key()
    last_error: Optional[EtherscanError] = None

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(ETHERSCAN_BASE, params=params)
                data = resp.json()

                if data.get("status") == "1" and data.get("result"):
                    if raw:
                        return data["result"]
                    return [_normalize_eth_tx(tx, address) for tx in data["result"]]
                if data.get("status") == "0" and data.get("message") == "No transactions found":
                    return []
                if data.get("message") == "NOTOK" and attempt < 2:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                if data.get("status") != "1":
                    last_error = EtherscanError(
                        "ETHERSCAN_TX_ERROR",
                        data.get("message", "Unknown Etherscan transaction error"),
                        {"address": address, "attempt": attempt + 1},
                    )
        except EtherscanError as e:
            last_error = e
            if attempt < 2:
                await asyncio.sleep(0.5 * (attempt + 1))
                continue
        except httpx.HTTPError as e:
            last_error = EtherscanError("ETHERSCAN_HTTP_ERROR", str(e), {"address": address})
            if attempt < 2:
                await asyncio.sleep(0.5 * (attempt + 1))
                continue

    if last_error:
        raise last_error
    return []


def _normalize_eth_tx(raw: dict, wallet_address: str) -> dict:
    """Normalize raw Etherscan tx into Sentinel's standard format."""
    value_eth = round(int(raw.get("value", 0)) / 1e18, 6)
    timestamp = datetime.fromtimestamp(int(raw["timeStamp"]), tz=timezone.utc)
    from_addr = raw.get("from", "")
    to_addr = raw.get("to", "") or "contract_creation"
    wallet_lower = wallet_address.lower()
    if from_addr.lower() == wallet_lower:
        direction = "out"
    elif to_addr.lower() == wallet_lower:
        direction = "in"
    else:
        direction = "unknown"

    return {
        "hash": raw.get("hash", ""),
        "chain": "ethereum",
        "timestamp": timestamp.isoformat(),
        "timestamp_unix": int(raw["timeStamp"]),
        "value": value_eth,
        "value_symbol": "ETH",
        "from_addr": from_addr,
        "to_addr": to_addr,
        "direction": direction,
        "gas_used": int(raw.get("gasUsed", 0)),
        "gas_price_gwei": round(int(raw.get("gasPrice", 0)) / 1e9, 2),
        "is_error": raw.get("isError") == "1",
        "method_id": raw.get("methodId", "0x"),
        "status": "failed" if raw.get("isError") == "1" else "success",
    }
