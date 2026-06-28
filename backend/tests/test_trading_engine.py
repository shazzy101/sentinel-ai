"""APEX engine: vote aggregation, ORB trigger, edge-quality distributed vs concentrated."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from trading.types import OHLCV, StrategyResult, Trade  # noqa: E402
from trading.strategies import (  # noqa: E402
    orb, donchian_breakout, market_regime, STRATEGY_FNS,
)
from trading import engine  # noqa: E402


def _bar(close, day=0, bar=0, high=None, low=None, vol=1000.0, open_=None):
    high = close if high is None else high
    low = close if low is None else low
    open_ = close if open_ is None else open_
    return OHLCV(ts=bar, open=open_, high=high, low=low, close=close,
                 volume=vol, bar=bar, day=day, day_open=open_)


def _sr(strategy, direction, conf=0.6):
    return StrategyResult(strategy, direction, conf)


def _trade(pnl, pnl_pct=None, strategies=("ORB",)):
    pnl_pct = pnl / 100 if pnl_pct is None else pnl_pct
    return Trade(id="t", asset="BTC/USD", dir="LONG", strategies=list(strategies),
                 votes=2, entry_price=100, exit_price=100 + pnl_pct, pnl=pnl,
                 pnl_pct=pnl_pct, bars_held=3, opened_ts=0, closed_ts=1, exit_reason="TP")


# ── ORB strategy fires long ───────────────────────────────────────────────
def test_orb_triggers_long():
    # opening range (first 3 bars) high≈100; then a breakout bar closes 105 on high volume
    bars = [
        _bar(100, bar=0, high=100, low=99, vol=1000),
        _bar(100, bar=1, high=100, low=99, vol=1000),
        _bar(100, bar=2, high=100, low=99, vol=1000),
        _bar(102, bar=3, high=103, low=100, vol=1000),
        _bar(105, bar=4, high=106, low=104, vol=5000),
    ]
    res = orb(bars, {}, 4)
    assert res is not None and res.strategy == "ORB" and res.dir == "LONG"


# ── vote aggregation ──────────────────────────────────────────────────────
def test_four_aligned_is_high_conviction():
    results = [_sr("ORB", "LONG"), _sr("EMA_CROSS", "LONG"),
               _sr("MACD_MOMENTUM", "LONG"), _sr("GAP_GO", "LONG")]
    sig = engine.build_signal(results, asset="BTC/USD", price=100, atr_val=2, min_confluences=2)
    assert sig is not None
    assert sig.votes == 4 and sig.is_high_conviction is True
    assert "ORB" in sig.strategies


def test_mixed_votes_long_majority():
    results = [_sr("ORB", "LONG"), _sr("EMA_CROSS", "LONG"), _sr("MACD_MOMENTUM", "SHORT")]
    sig = engine.build_signal(results, asset="BTC/USD", price=100, atr_val=2, min_confluences=2)
    assert sig is not None
    assert sig.dir == "LONG" and sig.votes == 2
    assert sig.is_high_conviction is False


def test_below_min_confluence_returns_none():
    results = [_sr("ORB", "LONG")]
    assert engine.build_signal(results, asset="X", price=100, atr_val=2, min_confluences=2) is None


def test_sl_tp_levels_long():
    sig = engine.build_signal([_sr("ORB", "LONG"), _sr("EMA_CROSS", "LONG")],
                              asset="X", price=100, atr_val=2, min_confluences=2)
    assert sig.sl == 100 - 2 * 1.5   # 97
    assert sig.tp == 100 + 2 * 3.0   # 106


# ── edge quality: the honesty mandate ─────────────────────────────────────
def test_edge_quality_concentrated_is_false():
    # one trade = 90% of P&L
    trades = [_trade(90), _trade(2), _trade(2), _trade(2), _trade(2), _trade(2)]
    eq = engine.calculate_edge_quality(trades)
    assert eq.distributed_edge is False
    assert eq.profit_concentration > 30


def test_edge_quality_distributed_is_true():
    trades = [_trade(10) for _ in range(6)]
    eq = engine.calculate_edge_quality(trades)
    assert eq.distributed_edge is True
    assert eq.profit_concentration <= 30


def test_edge_quality_unprofitable_not_distributed():
    trades = [_trade(-10), _trade(-5), _trade(2)]
    eq = engine.calculate_edge_quality(trades)
    assert eq.distributed_edge is False


def test_empty_trades_safe():
    assert engine.calculate_edge_quality([]).distributed_edge is True
    stats = engine.calculate_portfolio_stats([], 10000)
    assert stats.total_trades == 0 and stats.current_capital == 10000


def test_run_strategies_on_bar_empty():
    assert engine.run_strategies_on_bar([], 0) is None


def test_strategy_registry_has_15():
    assert len(STRATEGY_FNS) == 15


def test_donchian_breakout_long():
    bars = [_bar(100, bar=i, high=101, low=99) for i in range(20)]
    bars.append(_bar(110, bar=20, high=111, low=109))  # breaks 20-bar high
    res = donchian_breakout(bars, {}, 20)
    assert res is not None and res.dir == "LONG" and res.strategy == "DONCHIAN_BREAKOUT"


def test_market_regime_classification():
    assert market_regime({"adx": 30}) == "trend"
    assert market_regime({"adx": 10}) == "range"
    assert market_regime({"adx": 20}) == "mixed"
    assert market_regime({}) == "mixed"


def test_all_strategies_safe_on_insufficient_data():
    # engine guards index bounds; strategies must return None (not throw) when given
    # a valid index but not enough history.
    one = [_bar(100, bar=0)]
    for fn in STRATEGY_FNS.values():
        assert fn(one, {}, 0) is None


def test_run_backtest_returns_result():
    bars = [_bar(100 + (i % 7), day=i // 10, bar=i % 10, high=100 + (i % 7) + 2,
                 low=100 + (i % 7) - 2, vol=1000) for i in range(120)]
    res = engine.run_backtest(bars, 10000, 0.02, 2, asset="BTC/USD")
    assert res.stats is not None and res.edge_quality is not None
    assert res.starting_capital == 10000
