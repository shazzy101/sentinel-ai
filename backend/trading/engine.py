"""APEX confluence engine: vote aggregation, backtest, portfolio stats, edge quality.

calculate_edge_quality() is the heart of the honesty mandate — it exposes whether
profit is distributed across many trades or carried by one lucky catch.
"""

from __future__ import annotations

import statistics
import uuid
from typing import Optional

from trading.types import (
    OHLCV, Signal, StrategyResult, Trade, EquityPoint,
    PortfolioStats, StrategyStats, EdgeQuality, BacktestResult,
)
from trading.constants import (
    RISK_PARAMS, TOTAL_STRATEGIES, HIGH_CONVICTION_VOTES,
)
from trading.strategies import (
    STRATEGY_FNS, market_regime, TREND_STRATEGIES, RANGE_STRATEGIES,
)
from trading import indicators as ind

_DISTRIBUTED_THRESHOLD = 0.30   # one trade > 30% of P&L → not a distributed edge


# ── vote aggregation ─────────────────────────────────────────────────────
def build_signal(
    results: list[StrategyResult],
    *,
    asset: str,
    price: float,
    atr_val: float,
    rsi_val: float = 0.0,
    vwap_val: float = 0.0,
    ts: int = 0,
    timeframe: str = "5m",
    min_confluences: Optional[int] = None,
    sig_id: Optional[str] = None,
) -> Optional[Signal]:
    """Aggregate strategy votes into a Signal, or None if confluence too low.

    Majority direction wins (ties → LONG). Exposed for direct testing.
    """
    if min_confluences is None:
        min_confluences = int(RISK_PARAMS["min_confluences"])
    results = [r for r in results if r is not None]
    if not results:
        return None

    longs = [r for r in results if r.dir == "LONG"]
    shorts = [r for r in results if r.dir == "SHORT"]
    if len(longs) >= len(shorts):
        direction, agree = "LONG", longs
    else:
        direction, agree = "SHORT", shorts

    votes = len(agree)
    if votes < min_confluences:
        return None

    avg_conf = sum(r.confidence for r in agree) / votes
    confluence_score = (votes / TOTAL_STRATEGIES) * avg_conf
    sl_mult, tp_mult = RISK_PARAMS["atr_sl_mult"], RISK_PARAMS["atr_tp_mult"]
    if direction == "LONG":
        sl = price - atr_val * sl_mult
        tp = price + atr_val * tp_mult
    else:
        sl = price + atr_val * sl_mult
        tp = price - atr_val * tp_mult

    return Signal(
        id=sig_id or str(uuid.uuid4()),
        ts=ts,
        asset=asset,
        timeframe=timeframe,
        dir=direction,
        price=price,
        sl=sl,
        tp=tp,
        confidence=avg_conf,
        confluence_score=confluence_score,
        votes=votes,
        is_high_conviction=votes >= HIGH_CONVICTION_VOTES,
        strategies=[r.strategy for r in agree],
        rsi=rsi_val,
        vwap=vwap_val,
        atr=atr_val,
    )


def run_strategies_on_bar(
    bars: list[OHLCV], i: int, *, asset: str = "", timeframe: str = "5m",
    min_confluences: Optional[int] = None,
) -> Optional[Signal]:
    """Run all 7 strategies on bar i and aggregate into a Signal (or None)."""
    if not bars or i < 0 or i >= len(bars):
        return None
    window = bars[: i + 1]
    indicators = ind.run_all_indicators(window)
    results: list[StrategyResult] = []
    for fn in STRATEGY_FNS.values():
        try:
            r = fn(bars, indicators, i)
        except Exception:
            r = None
        if r is not None:
            results.append(r)

    # Regime weighting: boost strategies aligned with the current regime, dampen
    # those fighting it. Adjusts confidence (→ confluence_score), not vote count.
    regime = market_regime(indicators)
    if regime in ("trend", "range"):
        aligned = TREND_STRATEGIES if regime == "trend" else RANGE_STRATEGIES
        opposed = RANGE_STRATEGIES if regime == "trend" else TREND_STRATEGIES
        for r in results:
            if r.strategy in aligned:
                r.confidence = min(1.0, r.confidence * 1.2)
            elif r.strategy in opposed:
                r.confidence *= 0.7

    atr_val = indicators.get("atr") or 0.0
    if atr_val <= 0:
        return None
    return build_signal(
        results,
        asset=asset,
        price=bars[i].close,
        atr_val=atr_val,
        rsi_val=indicators.get("rsi") or 0.0,
        vwap_val=indicators.get("vwap") or 0.0,
        ts=bars[i].ts,
        timeframe=timeframe,
        min_confluences=min_confluences,
    )


# ── backtest ─────────────────────────────────────────────────────────────
def run_backtest(
    bars: list[OHLCV],
    starting_capital: float = 10000.0,
    risk_pct: float = 0.02,
    min_votes: int = 2,
    *,
    asset: str = "",
    timeframe: str = "5m",
) -> BacktestResult:
    """Single-position-at-a-time simulation using R-multiple accounting.

    Risk a fixed % of capital per trade. TP hit → +risk*RR; SL hit → -risk.
    Deterministic given bars.
    """
    result = BacktestResult(
        asset=asset, timeframe=timeframe, days=0,
        starting_capital=starting_capital, risk_pct=risk_pct, min_votes=min_votes,
    )
    if not bars or len(bars) < 53:
        result.stats = calculate_portfolio_stats([], starting_capital)
        result.edge_quality = calculate_edge_quality([])
        return result

    capital = starting_capital
    trades: list[Trade] = []
    equity = [EquityPoint(ts=bars[0].ts, equity=capital)]
    open_pos: Optional[dict] = None

    for i in range(52, len(bars)):
        bar = bars[i]
        if open_pos is not None:
            entry = open_pos["entry"]
            sl, tp = open_pos["sl"], open_pos["tp"]
            is_long = open_pos["dir"] == "LONG"
            hit_tp = bar.high >= tp if is_long else bar.low <= tp
            hit_sl = bar.low <= sl if is_long else bar.high >= sl
            exit_price = exit_reason = None
            if hit_tp and hit_sl:
                # both in one bar → assume worst case (SL first)
                exit_price, exit_reason = sl, "SL"
            elif hit_tp:
                exit_price, exit_reason = tp, "TP"
            elif hit_sl:
                exit_price, exit_reason = sl, "SL"
            if exit_price is not None:
                risk_amt = open_pos["risk_amt"]
                rr = abs(tp - entry) / abs(entry - sl) if entry != sl else 0
                pnl = risk_amt * rr if exit_reason == "TP" else -risk_amt
                capital += pnl
                move = (exit_price - entry) / entry * (1 if is_long else -1)
                trades.append(Trade(
                    id=open_pos["id"], asset=asset, dir=open_pos["dir"],
                    strategies=open_pos["strategies"], votes=open_pos["votes"],
                    entry_price=entry, exit_price=exit_price, pnl=pnl, pnl_pct=move * 100,
                    bars_held=i - open_pos["bar_i"], opened_ts=open_pos["ts"],
                    closed_ts=bar.ts, exit_reason=exit_reason,
                ))
                equity.append(EquityPoint(ts=bar.ts, equity=capital))
                open_pos = None

        if open_pos is None:
            sig = run_strategies_on_bar(bars, i, asset=asset, timeframe=timeframe, min_confluences=min_votes)
            if sig is not None:
                open_pos = {
                    "id": sig.id, "entry": sig.price, "sl": sig.sl, "tp": sig.tp,
                    "dir": sig.dir, "strategies": sig.strategies, "votes": sig.votes,
                    "ts": sig.ts, "bar_i": i, "risk_amt": capital * risk_pct,
                }

    result.days = max(1, (bars[-1].day - bars[0].day) + 1)
    result.trades = trades
    result.equity = _with_drawdown(equity)
    result.stats = calculate_portfolio_stats(trades, starting_capital)
    result.edge_quality = calculate_edge_quality(trades)
    result.strategy_breakdown = calculate_strategy_breakdown(trades)
    result.max_consecutive_wins, result.max_consecutive_losses = _max_streaks(trades)
    result.avg_bars_held = (sum(t.bars_held for t in trades) / len(trades)) if trades else 0.0
    return result


# ── stats ────────────────────────────────────────────────────────────────
def calculate_portfolio_stats(trades: list[Trade], starting_capital: float) -> PortfolioStats:
    if not trades:
        return PortfolioStats(
            starting_capital=starting_capital, current_capital=starting_capital,
            total_return_pct=0.0, win_rate=0.0, total_trades=0, wins=0, losses=0,
            max_drawdown=0.0, expectancy=0.0, profit_factor=0.0, sharpe=0.0, calmar=0.0,
        )
    wins = [t for t in trades if t.pnl > 0]
    losses = [t for t in trades if t.pnl <= 0]
    total_pnl = sum(t.pnl for t in trades)
    current = starting_capital + total_pnl
    gross_win = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))
    returns = [t.pnl_pct for t in trades]
    sd = statistics.pstdev(returns) if len(returns) > 1 else 0.0
    sharpe = (statistics.mean(returns) / sd) if sd else 0.0
    max_dd = _max_drawdown(trades, starting_capital)
    total_return = (current - starting_capital) / starting_capital * 100
    calmar = (total_return / abs(max_dd)) if max_dd else 0.0
    return PortfolioStats(
        starting_capital=starting_capital, current_capital=current,
        total_return_pct=total_return, win_rate=len(wins) / len(trades) * 100,
        total_trades=len(trades), wins=len(wins), losses=len(losses),
        max_drawdown=max_dd, expectancy=total_pnl / len(trades),
        profit_factor=(gross_win / gross_loss) if gross_loss else float("inf") if gross_win else 0.0,
        sharpe=sharpe, calmar=calmar,
    )


def calculate_edge_quality(trades: list[Trade]) -> EdgeQuality:
    """Distributed edge vs one-trade-luck. distributed_edge=False if any single
    trade contributes > 30% of net P&L."""
    if not trades:
        return EdgeQuality(0.0, 0.0, 0.0, 0, True)
    total_pnl = sum(t.pnl for t in trades)
    best = max(trades, key=lambda t: t.pnl)
    if total_pnl <= 0:
        # not profitable → no edge to distribute
        return EdgeQuality(
            profit_concentration=100.0, return_ex_max_win=0.0,
            consistency_score=0.0, longest_flat_period=len(trades), distributed_edge=False,
        )
    concentration = best.pnl / total_pnl
    return_ex_max = sum(t.pnl_pct for t in trades) - best.pnl_pct
    distributed = concentration <= _DISTRIBUTED_THRESHOLD
    win_rate = len([t for t in trades if t.pnl > 0]) / len(trades)
    consistency = max(0.0, min(100.0, (1 - concentration) * win_rate * 100))
    return EdgeQuality(
        profit_concentration=round(concentration * 100, 2),
        return_ex_max_win=round(return_ex_max, 2),
        consistency_score=round(consistency, 2),
        longest_flat_period=_longest_flat(trades),
        distributed_edge=distributed,
    )


def calculate_strategy_breakdown(trades: list[Trade]) -> list[StrategyStats]:
    by_strat: dict[str, list[Trade]] = {}
    for t in trades:
        for s in t.strategies:
            by_strat.setdefault(s, []).append(t)
    out = []
    for strat, ts_ in by_strat.items():
        wins = [t for t in ts_ if t.pnl > 0]
        by_asset: dict[str, float] = {}
        for t in ts_:
            by_asset[t.asset] = by_asset.get(t.asset, 0) + t.pnl
        best_asset = max(by_asset, key=by_asset.get) if by_asset else None
        out.append(StrategyStats(
            strategy=strat, signals=len(ts_), wins=len(wins), losses=len(ts_) - len(wins),
            win_rate=len(wins) / len(ts_) * 100 if ts_ else 0.0,
            avg_pnl_pct=sum(t.pnl_pct for t in ts_) / len(ts_) if ts_ else 0.0,
            avg_rr=sum(abs(t.pnl_pct) for t in ts_) / len(ts_) if ts_ else 0.0,
            max_consecutive_losses=_max_streaks(ts_)[1],
            best_asset=best_asset,
        ))
    return out


# ── helpers ──────────────────────────────────────────────────────────────
def _with_drawdown(points: list[EquityPoint]) -> list[EquityPoint]:
    peak = float("-inf")
    for p in points:
        peak = max(peak, p.equity)
        p.drawdown = (p.equity - peak) / peak * 100 if peak else 0.0
    return points


def _max_drawdown(trades: list[Trade], starting_capital: float) -> float:
    eq = starting_capital
    peak = starting_capital
    max_dd = 0.0
    for t in trades:
        eq += t.pnl
        peak = max(peak, eq)
        dd = (eq - peak) / peak * 100 if peak else 0.0
        max_dd = min(max_dd, dd)
    return max_dd


def _longest_flat(trades: list[Trade]) -> int:
    eq = 0.0
    peak = 0.0
    flat = 0
    longest = 0
    for t in trades:
        eq += t.pnl
        if eq > peak:
            peak = eq
            flat = 0
        else:
            flat += 1
            longest = max(longest, flat)
    return longest


def _max_streaks(trades: list[Trade]) -> tuple[int, int]:
    max_w = max_l = cur_w = cur_l = 0
    for t in trades:
        if t.pnl > 0:
            cur_w += 1
            cur_l = 0
            max_w = max(max_w, cur_w)
        else:
            cur_l += 1
            cur_w = 0
            max_l = max(max_l, cur_l)
    return max_w, max_l
