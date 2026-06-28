"""The 7 APEX strategies.

Each strategy: fn(bars, indicators, i) -> StrategyResult | None
  bars        : list[OHLCV] (oldest→newest)
  indicators  : dict from run_all_indicators(bars[:i+1])
  i           : index of the bar being evaluated (the latest)
Returns a vote (LONG/SHORT + confidence 0..1) or None for no signal.
All handle insufficient data without raising.
"""

from __future__ import annotations

from typing import Optional

from trading.types import OHLCV, StrategyResult
from trading import indicators as ind

_ORB_WINDOW = 3   # bars defining the opening range


def _day_bars(bars: list[OHLCV], i: int) -> list[OHLCV]:
    day = bars[i].day
    return [b for b in bars[: i + 1] if b.day == day]


def orb(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    db = _day_bars(bars, i)
    if len(db) <= _ORB_WINDOW:
        return None
    opening = db[:_ORB_WINDOW]
    orb_high = max(b.high for b in opening)
    orb_low = min(b.low for b in opening)
    prior = db[:-1]
    avg_vol = sum(b.volume for b in prior) / len(prior) if prior else 0
    cur = bars[i]
    if cur.close > orb_high and cur.volume > avg_vol:
        return StrategyResult("ORB", "LONG", 0.7, "break above opening range on volume")
    if cur.close < orb_low and cur.volume > avg_vol:
        return StrategyResult("ORB", "SHORT", 0.7, "break below opening range on volume")
    return None


def vwap_reversion(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    vw = indicators.get("vwap")
    rsi_v = indicators.get("rsi")
    if vw is None or rsi_v is None:
        return None
    price = bars[i].close
    if price > vw * 1.01 and rsi_v > 70:
        return StrategyResult("VWAP_REVERSION", "SHORT", 0.6, "extended above VWAP, overbought")
    if price < vw * 0.99 and rsi_v < 30:
        return StrategyResult("VWAP_REVERSION", "LONG", 0.6, "extended below VWAP, oversold")
    return None


def ema_cross(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    closes = [b.close for b in bars[: i + 1]]
    if len(closes) < 23:
        return None
    e9_now, e21_now = ind.ema(closes, 9), ind.ema(closes, 21)
    e9_prev, e21_prev = ind.ema(closes[:-1], 9), ind.ema(closes[:-1], 21)
    if None in (e9_now, e21_now, e9_prev, e21_prev):
        return None
    if e9_prev <= e21_prev and e9_now > e21_now:
        return StrategyResult("EMA_CROSS", "LONG", 0.65, "EMA9 crossed above EMA21")
    if e9_prev >= e21_prev and e9_now < e21_now:
        return StrategyResult("EMA_CROSS", "SHORT", 0.65, "EMA9 crossed below EMA21")
    return None


def macd_momentum(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    m = indicators.get("macd")
    if not m:
        return None
    if m["macd"] > m["signal"] and m["hist"] > 0:
        return StrategyResult("MACD_MOMENTUM", "LONG", 0.6, "MACD above signal, rising")
    if m["macd"] < m["signal"] and m["hist"] < 0:
        return StrategyResult("MACD_MOMENTUM", "SHORT", 0.6, "MACD below signal, falling")
    return None


def bb_squeeze(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    bb = indicators.get("bollinger")
    if not bb or bb.get("bandwidth") is None:
        return None
    price = bars[i].close
    # squeeze = narrow bands; breakout = close outside a band
    if bb["bandwidth"] < 0.04:
        if price > bb["upper"]:
            return StrategyResult("BB_SQUEEZE", "LONG", 0.6, "squeeze breakout up")
        if price < bb["lower"]:
            return StrategyResult("BB_SQUEEZE", "SHORT", 0.6, "squeeze breakout down")
    return None


def rsi_divergence(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    closes = [b.close for b in bars[: i + 1]]
    if len(closes) < 30:
        return None
    rsi_now = indicators.get("rsi")
    rsi_prev = ind.rsi(closes[:-5], 14) if len(closes) > 20 else None
    if rsi_now is None or rsi_prev is None:
        return None
    price_now, price_prev = closes[-1], closes[-6]
    # bullish div: lower price low but higher RSI low, oversold zone
    if price_now < price_prev and rsi_now > rsi_prev and rsi_now < 40:
        return StrategyResult("RSI_DIVERGENCE", "LONG", 0.6, "bullish RSI divergence")
    if price_now > price_prev and rsi_now < rsi_prev and rsi_now > 60:
        return StrategyResult("RSI_DIVERGENCE", "SHORT", 0.6, "bearish RSI divergence")
    return None


def gap_go(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    cur = bars[i]
    prior_day = [b for b in bars[: i + 1] if b.day == cur.day - 1]
    if not prior_day:
        return None
    prev_close = prior_day[-1].close
    if prev_close == 0:
        return None
    gap = (cur.day_open - prev_close) / prev_close
    if gap > 0.02 and cur.close > cur.day_open:
        return StrategyResult("GAP_GO", "LONG", 0.6, "gap up holding")
    if gap < -0.02 and cur.close < cur.day_open:
        return StrategyResult("GAP_GO", "SHORT", 0.6, "gap down holding")
    return None


# registry — keys match constants.STRATEGIES
STRATEGY_FNS = {
    "ORB": orb,
    "VWAP_REVERSION": vwap_reversion,
    "EMA_CROSS": ema_cross,
    "MACD_MOMENTUM": macd_momentum,
    "BB_SQUEEZE": bb_squeeze,
    "RSI_DIVERGENCE": rsi_divergence,
    "GAP_GO": gap_go,
}
