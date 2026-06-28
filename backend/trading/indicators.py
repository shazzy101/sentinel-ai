"""Technical indicators — pure Python, dependency-free.

Conventions:
- Functions that take a price series take list[float] of closes (oldest→newest).
- Functions needing OHLC take list[OHLCV].
- Every function returns None (or a dict of None) for invalid/insufficient input and
  NEVER raises on empty input.
- Scalar indicators return the LATEST value; series helpers are prefixed with `_`.
"""

from __future__ import annotations

from typing import Optional

from trading.types import OHLCV


# ── series helpers ──────────────────────────────────────────────────────
def _ema_series(values: list[float], period: int) -> list[float]:
    if not values or period <= 0 or len(values) < period:
        return []
    k = 2 / (period + 1)
    # seed with SMA of the first `period` values
    seed = sum(values[:period]) / period
    out = [seed]
    for v in values[period:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def _changes(values: list[float]) -> list[float]:
    return [values[i] - values[i - 1] for i in range(1, len(values))]


# ── scalar indicators ───────────────────────────────────────────────────
def sma(values: list[float], period: int) -> Optional[float]:
    if not values or period <= 0 or len(values) < period:
        return None
    return sum(values[-period:]) / period


def ema(values: list[float], period: int) -> Optional[float]:
    series = _ema_series(values, period)
    return series[-1] if series else None


def rsi(values: list[float], period: int = 14) -> Optional[float]:
    if not values or period <= 0 or len(values) < period + 1:
        return None
    ch = _changes(values)
    gains = [c if c > 0 else 0.0 for c in ch]
    losses = [-c if c < 0 else 0.0 for c in ch]
    # Wilder's smoothing
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(ch)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def vwap(bars: list[OHLCV]) -> Optional[float]:
    """Volume-weighted average price for the CURRENT day. Resets when bar.day increments."""
    if not bars:
        return None
    current_day = bars[-1].day
    pv = 0.0
    vol = 0.0
    for b in bars:
        if b.day != current_day:
            continue
        typical = (b.high + b.low + b.close) / 3
        pv += typical * b.volume
        vol += b.volume
    if vol == 0:
        return None
    return pv / vol


def atr(bars: list[OHLCV], period: int = 14) -> Optional[float]:
    if not bars or period <= 0 or len(bars) < period + 1:
        return None
    trs = []
    for i in range(1, len(bars)):
        h, l, pc = bars[i].high, bars[i].low, bars[i - 1].close
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    # Wilder smoothing
    a = sum(trs[:period]) / period
    for i in range(period, len(trs)):
        a = (a * (period - 1) + trs[i]) / period
    return a


def bollinger_bands(values: list[float], period: int = 20, mult: float = 2.0) -> Optional[dict]:
    if not values or period <= 0 or len(values) < period:
        return None
    window = values[-period:]
    mid = sum(window) / period
    var = sum((v - mid) ** 2 for v in window) / period
    sd = var ** 0.5
    return {"upper": mid + mult * sd, "mid": mid, "lower": mid - mult * sd, "bandwidth": (2 * mult * sd) / mid if mid else None}


def macd(values: list[float], fast: int = 12, slow: int = 26, signal: int = 9) -> Optional[dict]:
    if not values or len(values) < slow + signal:
        return None
    fast_s = _ema_series(values, fast)
    slow_s = _ema_series(values, slow)
    # align tails (fast series is longer)
    n = min(len(fast_s), len(slow_s))
    macd_line = [fast_s[-n + i] - slow_s[-n + i] for i in range(n)]
    sig_s = _ema_series(macd_line, signal)
    if not sig_s:
        return None
    macd_val = macd_line[-1]
    sig_val = sig_s[-1]
    return {"macd": macd_val, "signal": sig_val, "hist": macd_val - sig_val}


def stoch_rsi(values: list[float], period: int = 14) -> Optional[float]:
    """Stochastic RSI in 0..1. Needs ~2*period of data."""
    if not values or len(values) < 2 * period + 1:
        return None
    rsis: list[float] = []
    for i in range(period + 1, len(values) + 1):
        r = rsi(values[:i], period)
        if r is not None:
            rsis.append(r)
    if len(rsis) < period:
        return None
    window = rsis[-period:]
    lo, hi = min(window), max(window)
    if hi == lo:
        return 0.0
    return (rsis[-1] - lo) / (hi - lo)


def adx(bars: list[OHLCV], period: int = 14) -> Optional[float]:
    if not bars or period <= 0 or len(bars) < 2 * period:
        return None
    plus_dm, minus_dm, trs = [], [], []
    for i in range(1, len(bars)):
        up = bars[i].high - bars[i - 1].high
        down = bars[i - 1].low - bars[i].low
        plus_dm.append(up if (up > down and up > 0) else 0.0)
        minus_dm.append(down if (down > up and down > 0) else 0.0)
        h, l, pc = bars[i].high, bars[i].low, bars[i - 1].close
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))

    def _smooth(vals: list[float]) -> list[float]:
        s = sum(vals[:period])
        out = [s]
        for i in range(period, len(vals)):
            s = s - (s / period) + vals[i]
            out.append(s)
        return out

    str_, sp, sm = _smooth(trs), _smooth(plus_dm), _smooth(minus_dm)
    dxs = []
    for i in range(len(str_)):
        if str_[i] == 0:
            continue
        pdi = 100 * sp[i] / str_[i]
        mdi = 100 * sm[i] / str_[i]
        denom = pdi + mdi
        if denom == 0:
            continue
        dxs.append(100 * abs(pdi - mdi) / denom)
    if len(dxs) < period:
        return None
    return sum(dxs[-period:]) / period


def obv(bars: list[OHLCV]) -> Optional[float]:
    if not bars or len(bars) < 2:
        return None
    total = 0.0
    for i in range(1, len(bars)):
        if bars[i].close > bars[i - 1].close:
            total += bars[i].volume
        elif bars[i].close < bars[i - 1].close:
            total -= bars[i].volume
    return total


def run_all_indicators(bars: list[OHLCV]) -> dict:
    """Compute every indicator once. Missing/insufficient → None for that key."""
    closes = [b.close for b in bars] if bars else []
    return {
        "sma20": sma(closes, 20),
        "ema9": ema(closes, 9),
        "ema21": ema(closes, 21),
        "rsi": rsi(closes, 14),
        "vwap": vwap(bars),
        "atr": atr(bars, 14),
        "bollinger": bollinger_bands(closes, 20, 2.0),
        "macd": macd(closes),
        "stoch_rsi": stoch_rsi(closes, 14),
        "adx": adx(bars, 14),
        "obv": obv(bars),
    }
