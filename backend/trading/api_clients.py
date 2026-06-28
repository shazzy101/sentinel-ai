"""Price-data clients + market hours.

Step 6: fetch_ohlcv returns DETERMINISTIC seeded simulated bars so the whole
pipeline + UI can be built and tested before real APIs are wired.
Step 23 replaces the body of fetch_alpaca_bars / fetch_coingecko_bars with live calls
and routes fetch_ohlcv through them, cache-first.
"""

from __future__ import annotations

import hashlib
import math
import os
import time
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from trading.types import OHLCV
from trading.constants import ASSETS_BY_SYMBOL

_ET = ZoneInfo("America/New_York")
_BARS_PER_DAY = 78          # ~6.5h session in 5m bars
_TF_MS = {
    "1m": 60_000, "5m": 300_000, "15m": 900_000,
    "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
}


def get_admin_client():
    """Service-role Supabase client (reuses the app's accessor)."""
    from db.supabase import get_supabase
    return get_supabase()


def is_market_open(now: Optional[datetime] = None) -> bool:
    """US equity hours: Mon–Fri, 09:30–16:00 ET. (Crypto is always open.)"""
    now = now or datetime.now(_ET)
    if now.tzinfo is None:
        now = now.replace(tzinfo=_ET)
    et = now.astimezone(_ET)
    if et.weekday() >= 5:
        return False
    minutes = et.hour * 60 + et.minute
    return 9 * 60 + 30 <= minutes <= 16 * 60


def _seed(asset: str, timeframe: str) -> int:
    h = hashlib.sha256(f"{asset}:{timeframe}".encode()).hexdigest()
    return int(h[:8], 16)


def _base_price(asset: str) -> float:
    defaults = {
        "BTC/USD": 65000, "ETH/USD": 3500, "SOL/USD": 150,
        "NVDA": 120, "TSLA": 250, "AAPL": 190, "SPY": 550, "QQQ": 480,
    }
    return float(defaults.get(asset, 100))


def _simulated_bars(asset: str, timeframe: str, limit: int) -> list[OHLCV]:
    """Deterministic seeded random walk. high>=low guaranteed."""
    rng = _seed(asset, timeframe)
    price = _base_price(asset)
    step_ms = _TF_MS.get(timeframe, 300_000)
    now = int(time.time() * 1000)
    bars: list[OHLCV] = []
    day_open = price
    for n in range(limit):
        idx = limit - n  # bars from oldest to newest
        ts = now - idx * step_ms
        bar_in_day = n % _BARS_PER_DAY
        day = n // _BARS_PER_DAY
        if bar_in_day == 0:
            day_open = price
        # LCG for reproducible pseudo-randomness
        rng = (1103515245 * rng + 12345) & 0x7FFFFFFF
        drift = (rng / 0x7FFFFFFF - 0.5) * 0.02   # ±1% per bar
        open_ = price
        close = max(0.01, price * (1 + drift))
        high = max(open_, close) * (1 + abs(drift) * 0.5)
        low = min(open_, close) * (1 - abs(drift) * 0.5)
        rng = (1103515245 * rng + 12345) & 0x7FFFFFFF
        volume = 1000 + (rng % 9000)
        bars.append(OHLCV(
            ts=ts, open=round(open_, 4), high=round(high, 4), low=round(low, 4),
            close=round(close, 4), volume=float(volume),
            bar=bar_in_day, day=day, day_open=round(day_open, 4),
        ))
        price = close
    return bars


def fetch_ohlcv(asset: str, timeframe: str = "5m", limit: int = 100) -> list[OHLCV]:
    """Return up to `limit` OHLCV bars (oldest→newest).

    TODO(Step 23): route crypto→CoinGecko, stocks/etf→Alpaca, cache-first via price_cache.
    For now: deterministic simulated bars.
    """
    if asset not in ASSETS_BY_SYMBOL or limit <= 0:
        return []
    return _simulated_bars(asset, timeframe, limit)


def fetch_alpaca_bars(symbol: str, timeframe: str, limit: int) -> list[OHLCV]:
    raise NotImplementedError("Alpaca client wired in Step 23")


def fetch_coingecko_bars(coingecko_id: str, timeframe: str, limit: int) -> list[OHLCV]:
    raise NotImplementedError("CoinGecko client wired in Step 23")
