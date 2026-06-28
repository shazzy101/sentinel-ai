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


def donchian_breakout(bars: list[OHLCV], indicators: dict, i: int, period: int = 20) -> Optional[StrategyResult]:
    """Turtle-style channel breakout: close clears the N-bar high/low."""
    if i < period:
        return None
    window = bars[i - period:i]  # excludes current bar
    hi = max(b.high for b in window)
    lo = min(b.low for b in window)
    c = bars[i].close
    if c > hi:
        return StrategyResult("DONCHIAN_BREAKOUT", "LONG", 0.65, f"{period}-bar high break")
    if c < lo:
        return StrategyResult("DONCHIAN_BREAKOUT", "SHORT", 0.65, f"{period}-bar low break")
    return None


def keltner_breakout(bars: list[OHLCV], indicators: dict, i: int, mult: float = 1.5) -> Optional[StrategyResult]:
    """Close breaks outside the Keltner channel (EMA20 ± mult·ATR)."""
    closes = [b.close for b in bars[: i + 1]]
    mid = ind.ema(closes, 20)
    atr = indicators.get("atr")
    if mid is None or atr is None:
        return None
    c = bars[i].close
    if c > mid + mult * atr:
        return StrategyResult("KELTNER_BREAKOUT", "LONG", 0.6, "break above upper Keltner")
    if c < mid - mult * atr:
        return StrategyResult("KELTNER_BREAKOUT", "SHORT", 0.6, "break below lower Keltner")
    return None


def zscore_reversion(bars: list[OHLCV], indicators: dict, i: int, z: float = 2.0) -> Optional[StrategyResult]:
    """Statistical mean-reversion: fade a >2σ stretch from the 20-bar mean."""
    bb = indicators.get("bollinger")
    if not bb:
        return None
    mid = bb["mid"]
    sd = (bb["upper"] - mid) / 2.0  # bands are mid ± 2σ
    if sd <= 0:
        return None
    score = (bars[i].close - mid) / sd
    if score <= -z:
        return StrategyResult("ZSCORE_REVERSION", "LONG", 0.6, f"z={score:.1f} oversold")
    if score >= z:
        return StrategyResult("ZSCORE_REVERSION", "SHORT", 0.6, f"z={score:.1f} overbought")
    return None


def roc_momentum(bars: list[OHLCV], indicators: dict, i: int, lookback: int = 10, thresh: float = 0.02) -> Optional[StrategyResult]:
    """Rate-of-change momentum confirmed by EMA alignment."""
    if i < lookback:
        return None
    past = bars[i - lookback].close
    if past == 0:
        return None
    roc = (bars[i].close - past) / past
    e9, e21 = indicators.get("ema9"), indicators.get("ema21")
    if e9 is None or e21 is None:
        return None
    if roc > thresh and e9 > e21:
        return StrategyResult("ROC_MOMENTUM", "LONG", 0.6, f"+{roc*100:.1f}% momentum")
    if roc < -thresh and e9 < e21:
        return StrategyResult("ROC_MOMENTUM", "SHORT", 0.6, f"{roc*100:.1f}% momentum")
    return None


def adx_trend(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    """Trend-follow ONLY when ADX confirms a strong trend (>25)."""
    adx = indicators.get("adx")
    e9, e21 = indicators.get("ema9"), indicators.get("ema21")
    if adx is None or e9 is None or e21 is None or adx < 25:
        return None
    if e9 > e21:
        return StrategyResult("ADX_TREND", "LONG", 0.7, f"strong uptrend ADX={adx:.0f}")
    if e9 < e21:
        return StrategyResult("ADX_TREND", "SHORT", 0.7, f"strong downtrend ADX={adx:.0f}")
    return None


def rel_volume_breakout(bars: list[OHLCV], indicators: dict, i: int, period: int = 20, mult: float = 1.5) -> Optional[StrategyResult]:
    """Directional bar on relative-volume spike."""
    if i < period:
        return None
    avg_vol = sum(b.volume for b in bars[i - period:i]) / period
    if avg_vol <= 0:
        return None
    cur = bars[i]
    if cur.volume < mult * avg_vol:
        return None
    if cur.close > cur.open:
        return StrategyResult("REL_VOLUME_BREAKOUT", "LONG", 0.6, "volume spike up")
    if cur.close < cur.open:
        return StrategyResult("REL_VOLUME_BREAKOUT", "SHORT", 0.6, "volume spike down")
    return None


def stochrsi_turn(bars: list[OHLCV], indicators: dict, i: int) -> Optional[StrategyResult]:
    """Stochastic-RSI exiting extreme zones."""
    sr = indicators.get("stoch_rsi")
    if sr is None:
        return None
    if sr <= 0.2:
        return StrategyResult("STOCHRSI_TURN", "LONG", 0.55, "stochRSI oversold")
    if sr >= 0.8:
        return StrategyResult("STOCHRSI_TURN", "SHORT", 0.55, "stochRSI overbought")
    return None


def supertrend(bars: list[OHLCV], indicators: dict, i: int, mult: float = 1.0) -> Optional[StrategyResult]:
    """ATR-trend confirmation: price decisively beyond a fast EMA by >mult·ATR."""
    closes = [b.close for b in bars[: i + 1]]
    fast = ind.ema(closes, 10)
    atr = indicators.get("atr")
    if fast is None or atr is None or i < 1:
        return None
    c, prev = bars[i].close, bars[i - 1].close
    if c > fast + mult * atr and c > prev:
        return StrategyResult("SUPERTREND", "LONG", 0.65, "above ATR trend band")
    if c < fast - mult * atr and c < prev:
        return StrategyResult("SUPERTREND", "SHORT", 0.65, "below ATR trend band")
    return None


def market_regime(indicators: dict) -> str:
    """'trend' when ADX is high, 'range' when low, else 'mixed'. Used to weight votes."""
    adx = indicators.get("adx")
    if adx is None:
        return "mixed"
    if adx >= 25:
        return "trend"
    if adx < 18:
        return "range"
    return "mixed"


# strategies that thrive in trending vs ranging regimes (for confidence weighting)
TREND_STRATEGIES = {"EMA_CROSS", "MACD_MOMENTUM", "ROC_MOMENTUM", "ADX_TREND",
                    "SUPERTREND", "DONCHIAN_BREAKOUT", "KELTNER_BREAKOUT", "GAP_GO", "ORB"}
RANGE_STRATEGIES = {"VWAP_REVERSION", "ZSCORE_REVERSION", "RSI_DIVERGENCE",
                    "BB_SQUEEZE", "STOCHRSI_TURN"}


# registry — keys match constants.STRATEGIES
STRATEGY_FNS = {
    "ORB": orb,
    "VWAP_REVERSION": vwap_reversion,
    "EMA_CROSS": ema_cross,
    "MACD_MOMENTUM": macd_momentum,
    "BB_SQUEEZE": bb_squeeze,
    "RSI_DIVERGENCE": rsi_divergence,
    "GAP_GO": gap_go,
    "DONCHIAN_BREAKOUT": donchian_breakout,
    "KELTNER_BREAKOUT": keltner_breakout,
    "ZSCORE_REVERSION": zscore_reversion,
    "ROC_MOMENTUM": roc_momentum,
    "ADX_TREND": adx_trend,
    "REL_VOLUME_BREAKOUT": rel_volume_breakout,
    "STOCHRSI_TURN": stochrsi_turn,
    "SUPERTREND": supertrend,
}
