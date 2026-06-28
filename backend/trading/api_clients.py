"""Price-data clients + market hours.

Step 6: fetch_ohlcv returns DETERMINISTIC seeded simulated bars so the whole
pipeline + UI can be built and tested before real APIs are wired.
Step 23 replaces the body of fetch_alpaca_bars / fetch_coingecko_bars with live calls
and routes fetch_ohlcv through them, cache-first.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import httpx

from trading.types import OHLCV
from trading.constants import ASSETS_BY_SYMBOL

_log = logging.getLogger("apex.data")
_ET = ZoneInfo("America/New_York")
_ALPACA_DATA = "https://data.alpaca.markets/v2/stocks"
_COINGECKO = "https://api.coingecko.com/api/v3"
_ALPACA_TF = {"1m": "1Min", "5m": "5Min", "15m": "15Min", "1h": "1Hour", "4h": "4Hour", "1d": "1Day"}
_CACHE_TTL = 60  # seconds — in-memory rate-limit guard
_MEM: dict[str, tuple[float, list]] = {}
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


def _rows_to_ohlcv(rows: list[tuple]) -> list[OHLCV]:
    """rows: (ts_ms, open, high, low, close, volume), oldest→newest.

    Derives day ordinal / bar-in-day / day_open from UTC calendar days.
    """
    out: list[OHLCV] = []
    prev_ord: Optional[int] = None
    day = -1
    bar = 0
    day_open = 0.0
    for ts, o, h, l, c, v in rows:
        d_ord = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).date().toordinal()
        if d_ord != prev_ord:
            day += 1
            bar = 0
            day_open = float(o)
            prev_ord = d_ord
        # guard OHLC sanity
        hi = max(o, h, c)
        lo = min(o, l, c)
        out.append(OHLCV(ts=int(ts), open=float(o), high=float(hi), low=float(lo),
                         close=float(c), volume=float(v), bar=bar, day=day, day_open=day_open))
        bar += 1
    return out


def fetch_alpaca_bars(symbol: str, timeframe: str, limit: int) -> list[OHLCV]:
    """Real stock/ETF bars via Alpaca market data (IEX feed on free/paper)."""
    key, secret = os.getenv("ALPACA_API_KEY"), os.getenv("ALPACA_API_SECRET")
    if not key or not secret:
        raise RuntimeError("ALPACA keys not configured")
    tf = _ALPACA_TF.get(timeframe, "5Min")
    # Free IEX feed requires an explicit start; look back enough to cover `limit`
    # intraday bars across weekends/holidays.
    from datetime import timedelta
    lookback_days = 20 if timeframe in ("1m", "5m", "15m") else 120
    start = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    r = httpx.get(
        f"{_ALPACA_DATA}/{symbol}/bars",
        params={"timeframe": tf, "limit": min(limit, 1000), "feed": "iex",
                "sort": "desc", "start": start},
        headers={"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret},
        timeout=12,
    )
    r.raise_for_status()
    bars = list(reversed(r.json().get("bars") or []))  # desc → oldest→newest
    rows = []
    for b in bars:
        ts = int(datetime.fromisoformat(b["t"].replace("Z", "+00:00")).timestamp() * 1000)
        rows.append((ts, b["o"], b["h"], b["l"], b["c"], b.get("v", 0)))
    return _rows_to_ohlcv(rows)


def fetch_coingecko_bars(coingecko_id: str, timeframe: str, limit: int) -> list[OHLCV]:
    """Real crypto OHLC via CoinGecko (keyless). Free tier granularity:
    days=1→30m, days=30→4h candles. We use 30d for enough history; volume is not
    provided by /ohlc so it is set to a neutral constant."""
    r = httpx.get(
        f"{_COINGECKO}/coins/{coingecko_id}/ohlc",
        params={"vs_currency": "usd", "days": 30},
        timeout=12,
    )
    r.raise_for_status()
    raw = r.json() or []
    rows = [(int(c[0]), c[1], c[2], c[3], c[4], 1000.0) for c in raw]
    return _rows_to_ohlcv(rows)[-limit:]


def fetch_ohlcv(asset: str, timeframe: str = "5m", limit: int = 100) -> list[OHLCV]:
    """Up to `limit` OHLCV bars (oldest→newest), cache-first.

    crypto → CoinGecko (keyless); stocks/etf → Alpaca during market hours.
    Falls back to deterministic simulated bars when the market is closed, keys are
    missing, or a provider call fails — so the engine never starves.
    """
    a = ASSETS_BY_SYMBOL.get(asset)
    if not a or limit <= 0:
        return []

    ck = f"{asset}|{timeframe}|{limit}"
    hit = _MEM.get(ck)
    if hit and time.time() - hit[0] < _CACHE_TTL:
        return hit[1]

    bars: list[OHLCV] = []
    try:
        if a.kind == "crypto":
            bars = fetch_coingecko_bars(a.coingecko_id, timeframe, limit)
        elif is_market_open():
            bars = fetch_alpaca_bars(a.alpaca_symbol, timeframe, limit)
        else:
            bars = _simulated_bars(asset, timeframe, limit)  # market closed
    except Exception as exc:
        _log.warning("real fetch failed for %s (%s) — using simulated: %s", asset, a.kind, exc)
        bars = _simulated_bars(asset, timeframe, limit)

    if not bars:
        bars = _simulated_bars(asset, timeframe, limit)

    _MEM[ck] = (time.time(), bars)
    return bars
