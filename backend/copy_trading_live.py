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

from observability import log_error, log_info, log_warning
from copy_trading_winrate import unrealized_win_rate

ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
HISTORY_DAYS = 180

_ranker_mod = None
_price_warm_ts = 0.0
_PRICE_TTL_S = 6 * 3600  # refresh ETH price history at most every 6h
_result_cache: dict[str, tuple[float, dict | None]] = {}
_RESULT_TTL_S = 30 * 60  # cache per-wallet metrics for 30 min
_RESULT_CACHE_MAX = 2000  # hard cap on cached addresses (bounds memory)


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
    except Exception as e:
        # eth_price_on() falls back to a constant if the cache stays empty
        log_warning("eth_price_warm_failed", error=str(e)[:160])


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
            except Exception as e:
                log_error("live_transfers_fetch_failed", address=address, page=page, error=str(e)[:160])
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


async def _defillama_prices(addresses: list[str]) -> dict[str, float]:
    """Current USD prices keyed by lowercase contract address (DefiLlama coins)."""
    addrs = list(dict.fromkeys([(a or "").lower() for a in addresses if a]))
    if not addrs:
        return {}
    out: dict[str, float] = {}
    for i in range(0, len(addrs), 80):
        chunk = addrs[i : i + 80]
        keys = ",".join(f"ethereum:{a}" for a in chunk)
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(f"https://coins.llama.fi/prices/current/{keys}")
                res.raise_for_status()
                coins = (res.json() or {}).get("coins", {})
            for a in chunk:
                entry = coins.get(f"ethereum:{a}")
                if entry and entry.get("price"):
                    out[a] = float(entry["price"])
        except Exception as e:
            log_error("live_defillama_price_failed", error=str(e)[:160])
    return out


async def _unrealized_win_rate(trades: list[dict], open_positions: list[dict]) -> float | None:
    """Win rate counting still-held bags at current price (DefiLlama)."""
    contracts = [p.get("contract") for p in open_positions if p.get("contract")]
    prices_by_contract = await _defillama_prices(contracts) if contracts else {}
    current_prices: dict[str, float] = {}
    for p in open_positions:
        c = (p.get("contract") or "").lower()
        if c in prices_by_contract:
            current_prices[(p.get("token") or "").upper()] = prices_by_contract[c]
    return unrealized_win_rate(trades, open_positions, current_prices)


async def compute_live_metrics(address: str) -> dict | None:
    """
    Compute supplemental on-chain metrics (max drawdown, avg duration) for a
    single wallet. Returns None when trade reconstruction is insufficient.
    Never replaces dataset win rate / profit factor / track record.
    """
    if not address:
        return None
    key = address.lower()

    cached = _result_cache.get(key)
    if cached and (time.time() - cached[0]) < _RESULT_TTL_S:
        log_info("live_metrics_cache_hit", address=key)
        return cached[1]

    r = _ranker()
    async with httpx.AsyncClient(timeout=30) as client:
        await _warm_eth_prices(client)

    transfers = await _fetch_token_transfers(address)
    metrics = None
    if transfers:
        trades, open_positions, first_ts, last_ts = r.reconstruct_trades(address, transfers)
        raw = r.compute_metrics(trades, first_ts, last_ts)
        # Require enough reconstructed trades — avoid returning zeros that
        # would clobber good Dune dataset values on the frontend.
        if raw and raw.get("trade_count", 0) >= getattr(r, "MIN_TRADES", 10):
            metrics = {
                "max_drawdown_pct": raw["max_drawdown_pct"],
                "avg_trade_duration_hrs": raw["avg_trade_duration_hrs"],
            }
            # Unrealized win rate: mark still-held bags to current price so a
            # sells-winners/holds-losers wallet can't show a fake 100%.
            unrealized = await _unrealized_win_rate(trades, open_positions)
            if unrealized is not None:
                metrics["unrealized_win_rate_pct"] = unrealized

    # Bound the cache: evict expired entries, then the oldest if still over cap,
    # so a long-running process can't accumulate unbounded per-address results.
    now_ts = time.time()
    if len(_result_cache) >= _RESULT_CACHE_MAX:
        for k in [k for k, (ts, _) in _result_cache.items() if now_ts - ts >= _RESULT_TTL_S]:
            del _result_cache[k]
        while len(_result_cache) >= _RESULT_CACHE_MAX:
            oldest = min(_result_cache, key=lambda k: _result_cache[k][0])
            del _result_cache[oldest]
    _result_cache[key] = (now_ts, metrics)
    log_info("live_metrics_cache_miss", address=key, cache_size=len(_result_cache))
    return metrics
