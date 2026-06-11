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
from observability import log_error

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


async def get_eth_transactions(address: str, limit: int = 50, days: Optional[int] = None) -> list[dict]:
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
                    # Back off and retry on ALL error statuses, not just NOTOK.
                    if attempt < 2:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
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


async def get_token_top_holders(token_address: str, page: int = 1, offset: int = 100) -> list[dict]:
    """Fetch top ERC-20 token holders from Etherscan."""
    params = {
        "chainid": "1",
        "module": "token",
        "action": "tokenholderlist",
        "contractaddress": token_address,
        "page": page,
        "offset": min(offset, 100),
        "apikey": _get_api_key(),
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(ETHERSCAN_BASE, params=params)
            data = resp.json()
            if data.get("status") == "1" and isinstance(data.get("result"), list):
                return data["result"]
            return []
    except httpx.HTTPError:
        return []


async def discover_whale_addresses(limit: int = 500) -> list[dict]:
    """
    Discover high-value addresses from top holders of major tokens.
    Used to expand the watchlist universe toward 500 wallets.
    """
    tokens = {
        "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "WBTC": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        "stETH": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    }
    seen: set[str] = set()
    discovered: list[dict] = []

    for label, addr in tokens.items():
        holders = await get_token_top_holders(addr, page=1, offset=100)
        for i, h in enumerate(holders):
            address = (h.get("TokenHolderAddress") or h.get("address") or "").strip()
            if not address or address.lower() in seen:
                continue
            seen.add(address.lower())
            discovered.append({
                "address": address,
                "label": f"{label} Top Holder #{i + 1}",
                "chain": "ethereum",
                "tags": ["ethereum", "smart-money", "discovered"],
            })
            if len(discovered) >= limit:
                return discovered
        await asyncio.sleep(0.3)

    return discovered


async def get_eth_internal_transactions(address: str, limit: int = 20) -> list[dict]:
    """
    Fetch internal transactions (DeFi contract calls).
    More meaningful than regular ETH transfers for smart money analysis.
    """
    params = {
        "chainid": "1",
        "module": "account",
        "action": "txlistinternal",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "page": 1,
        "offset": limit,
        "sort": "desc",
        "apikey": _get_api_key(),
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(ETHERSCAN_BASE, params=params)
            data = resp.json()
            if data.get("status") == "1":
                return data.get("result", [])
    except Exception as e:
        log_error("eth_internal_tx_error", error=str(e)[:200])
    return []


async def get_eth_token_transfers(address: str, limit: int = 20) -> list[dict]:
    """
    Fetch ERC-20 token transfers.
    Stablecoin + DeFi token flows reveal trading intent.
    """
    params = {
        "chainid": "1",
        "module": "account",
        "action": "tokentx",
        "address": address,
        "page": 1,
        "offset": limit,
        "sort": "desc",
        "apikey": _get_api_key(),
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(ETHERSCAN_BASE, params=params)
            data = resp.json()
            if data.get("status") != "1":
                return []
            out: list[dict] = []
            for tx in data.get("result", []):
                try:
                    ts_unix = int(tx.get("timeStamp", 0))
                    value = int(tx.get("value", 0)) / (10 ** int(tx.get("tokenDecimal", 18)))
                except (TypeError, ValueError):
                    # Skip malformed records rather than failing the whole page.
                    continue
                out.append({
                    "hash": tx.get("hash"),
                    "token_name": tx.get("tokenName"),
                    "token_symbol": tx.get("tokenSymbol"),
                    "value": value,
                    "from_addr": tx.get("from"),
                    "to_addr": tx.get("to"),
                    "direction": "in" if (tx.get("to", "").lower() == address.lower()) else "out",
                    "timestamp": datetime.fromtimestamp(ts_unix, tz=timezone.utc).isoformat(),
                    "timestamp_unix": ts_unix,
                    "chain": "ethereum",
                    "type": "token_transfer",
                    "status": "success",
                })
            return out
    except Exception as e:
        log_error("eth_token_transfer_error", address=address, error=str(e)[:200])
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
