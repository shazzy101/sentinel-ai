"""APEX indicator correctness + robustness (empty input never raises)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from trading.types import OHLCV  # noqa: E402
from trading import indicators as ind  # noqa: E402


def _bar(close, day=0, bar=0, high=None, low=None, vol=1000.0, open_=None):
    high = close + 1 if high is None else high
    low = close - 1 if low is None else low
    open_ = close if open_ is None else open_
    return OHLCV(ts=bar, open=open_, high=high, low=low, close=close,
                 volume=vol, bar=bar, day=day, day_open=open_)


# ── correctness ─────────────────────────────────────────────────────────
def test_sma_last_value():
    assert ind.sma([1, 2, 3, 4, 5], 3) == 4  # mean of [3,4,5]


def test_ema_reacts_faster_than_sma():
    prices = [10.0] * 20 + [20.0]  # flat then jump up
    e = ind.ema(prices, 10)
    s = ind.sma(prices, 10)
    assert e is not None and s is not None
    assert e > s  # EMA weights the recent jump more heavily


def test_rsi_overbought_on_straight_gains():
    prices = [float(i) for i in range(1, 30)]  # 28 straight gains
    assert ind.rsi(prices, 14) > 70


def test_rsi_oversold_on_straight_losses():
    prices = [float(i) for i in range(30, 1, -1)]  # straight losses
    assert ind.rsi(prices, 14) < 30


def test_vwap_resets_on_new_day():
    day0 = [_bar(100, day=0, bar=i, high=100, low=100) for i in range(5)]
    day1 = [_bar(200, day=1, bar=i, high=200, low=200) for i in range(3)]
    # vwap over both days must equal vwap of day1 only (reset on new day)
    assert ind.vwap(day0 + day1) == 200.0
    assert ind.vwap(day0) == 100.0


def test_atr_positive_on_volatile_bars():
    bars = [_bar(100 + (i % 2) * 10, high=120, low=80) for i in range(20)]
    a = ind.atr(bars, 14)
    assert a is not None and a > 0


def test_macd_returns_three_keys():
    prices = [float(i) + (i % 3) for i in range(60)]
    m = ind.macd(prices)
    assert m is not None and set(m) == {"macd", "signal", "hist"}


def test_run_all_indicators_keys():
    bars = [_bar(100 + i, day=0, bar=i) for i in range(60)]
    out = ind.run_all_indicators(bars)
    for key in ("sma20", "ema9", "rsi", "vwap", "atr", "bollinger", "macd", "adx", "obv"):
        assert key in out


# ── robustness: empty / insufficient input returns None, never raises ────
def test_empty_inputs_return_none():
    assert ind.sma([], 3) is None
    assert ind.ema([], 3) is None
    assert ind.rsi([], 14) is None
    assert ind.vwap([]) is None
    assert ind.atr([], 14) is None
    assert ind.bollinger_bands([], 20) is None
    assert ind.macd([]) is None
    assert ind.stoch_rsi([], 14) is None
    assert ind.adx([], 14) is None
    assert ind.obv([]) is None


def test_insufficient_input_returns_none():
    assert ind.sma([1, 2], 3) is None
    assert ind.rsi([1, 2, 3], 14) is None
    assert ind.atr([_bar(100)], 14) is None
