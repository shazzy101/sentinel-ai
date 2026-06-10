"""
On-demand copy-trading metrics for a single wallet.

Reuses the tested trade-reconstruction + metric math from
scripts/copy_trading_ranker.py, but fetches data at request time using the
runtime ETHERSCAN_API_KEY and a single CoinGecko price call (cached).

This is what powers the "Max Drawdown" and "Avg Duration" cards in the
copy-trader detail panel — computed from real on-chain trade history rather
than the offline batch ranker.
"""

from __future__ import annotations

import os
import time
import importlib.util
from datetime import datetime, timezone, timedelta

import httpx

ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
HISTORY_DAYS = 180

_ranker_mod = None
_price_warm_ts = 0.0
_PRICE_TTL_S = 6 * 3600  # refresh ETH price history at most every 6h
_result_cache: dict[str, tuple[float, dict | None]] = {}
_RESULT_TTL_S = 30 * 60  # cache per-wallet metrics for 30 min


def _ranker():
    """Lazily load the ranker module from its file path (robust to packaging)."""
    global _ranker_mod
    if _ranker_mod is None:
        path = os.path.join(os.path.dirname(__file__), "scripts", "copy_trading_ranker.py")
        spec = importlib.util.spec_from_file_location("copy_trading_ranker", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _ranker_mod = mod
    return _ranker_mod


async def _warm_eth_prices(client: httpx.AsyncClient) -> None:
    """Populate the ranker's ETH price cache from a single CoinGecko call."""
    r = _ranker()
    global _price_warm_ts
    if r._eth_price_cache and (time.time() - _price_warm_ts) < _PRICE_TTL_S:
        return
    try:
        resp = await client.get(
            f"{COINGECKO_BASE}/coins/ethereum/market_chart",
            params={"vs_currency": "usd", "days": HISTORY_DAYS + 30, "interval": "daily"},
            timeout=30,
        )
        prices = (resp.json() or {}).get("prices", [])
        for ts_ms, price in prices:
            ds = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            r._eth_price_cache[ds] = price
        if prices:
            _price_warm_ts = time.time()
    except Exception:
        # eth_price_on() falls back to a constant if the cache stays empty
        pass


async def _fetch_token_transfers(address: str, days: int = HISTORY_DAYS) -> list[dict]:
    """Fetch raw ERC-20 transfers (Etherscan v2) in the shape reconstruct_trades expects."""
    key = os.getenv("ETHERSCAN_API_KEY")
    if not key:
        return []
    cutoff_ts = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    transfers: list[dict] = []
    async with httpx.AsyncClient(timeout=20) as client:
        page = 1
        while page <= 10:  # cap at 1000 transfers
            params = {
                "chainid": "1",
                "module": "account",
                "action": "tokentx",
                "address": address,
                "page": page,
                "offset": 100,
                "sort": "desc",
                "apikey": key,
            }
            try:
                resp = await client.get(ETHERSCAN_BASE, params=params)
                data = resp.json()
            except Exception:
                break
            if str(data.get("status")) != "1":
                break
            result = data.get("result") or []
            reached_cutoff = False
            for tx in result:
                if int(tx.get("timeStamp", 0)) < cutoff_ts:
                    reached_cutoff = True
                    break
                transfers.append(tx)
            if reached_cutoff or len(result) < 100:
                break
            page += 1
    return transfers


async def compute_live_metrics(address: str) -> dict | None:
    """
    Compute the 5 copy-trading metrics for a single wallet from real on-chain
    trade history. Returns None when there isn't enough data to reconstruct trades.
    """
    if not address:
        return None
    key = address.lower()

    cached = _result_cache.get(key)
    if cached and (time.time() - cached[0]) < _RESULT_TTL_S:
        return cached[1]

    r = _ranker()
    async with httpx.AsyncClient(timeout=30) as client:
        await _warm_eth_prices(client)

    transfers = await _fetch_token_transfers(address)
    metrics = None
    if transfers:
        trades, first_ts, last_ts = r.reconstruct_trades(address, transfers)
        raw = r.compute_metrics(trades, first_ts, last_ts)
        if raw:
            metrics = {
                "win_rate_pct": raw["win_rate"],
                "profit_factor": raw["profit_factor"],
                "max_drawdown_pct": raw["max_drawdown_pct"],
                "avg_trade_duration_hrs": raw["avg_trade_duration_hrs"],
                "track_record_days": raw["track_record_days"],
                "trade_count": raw["trade_count"],
                "net_pnl_usd": raw["net_pnl_usd"],
            }

    _result_cache[key] = (time.time(), metrics)
    return metrics
