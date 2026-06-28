"""Assemble the public portfolio payload from stored paper data.

Converts closed positions (which hold dollar P&L) + their signals (which hold
strategies/votes) into Trade objects, then runs the engine's stats + edge-quality.
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from trading import store
from trading.engine import (
    calculate_portfolio_stats, calculate_edge_quality, calculate_strategy_breakdown,
)
from trading.types import Trade
from trading.constants import PAPER_STARTING_CAPITAL


def _ts(iso: Optional[str]) -> int:
    if not iso:
        return 0
    try:
        return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        return 0


def _trades(since: Optional[datetime] = None) -> list[Trade]:
    sigs = {s["id"]: s for s in store.list_signals(limit=2000)}
    out: list[Trade] = []
    for p in store.closed_positions():
        if since:
            exit_at = p.get("exit_at")
            if not exit_at or _ts(exit_at) < since.timestamp() * 1000:
                continue
        sig = sigs.get(p.get("signal_id")) or {}
        out.append(Trade(
            id=p["id"], asset=p["asset"], dir=p["direction"],
            strategies=sig.get("strategies") or [], votes=sig.get("votes") or 0,
            entry_price=float(p["entry_price"]), exit_price=float(p.get("exit_price") or 0),
            pnl=float(p.get("pnl") or 0), pnl_pct=float(p.get("pnl_pct") or 0),
            bars_held=0, opened_ts=_ts(p.get("opened_at")), closed_ts=_ts(p.get("exit_at")),
            exit_reason=p.get("exit_reason") or "",
        ))
    return out


def _current_streak(trades: list[Trade]) -> int:
    """Positive = win streak, negative = loss streak (most recent first)."""
    if not trades:
        return 0
    ordered = sorted(trades, key=lambda t: t.closed_ts, reverse=True)
    streak = 0
    first_win = ordered[0].pnl > 0
    for t in ordered:
        if (t.pnl > 0) == first_win:
            streak += 1
        else:
            break
    return streak if first_win else -streak


def _equity_curve() -> list[dict]:
    snaps = store.equity_snapshots()
    if snaps:
        return [{"ts": _ts(s.get("taken_at")), "equity": float(s.get("equity") or 0),
                 "drawdown": float(s.get("drawdown") or 0)} for s in snaps]
    # fallback: synthesize from closed trades
    cap = PAPER_STARTING_CAPITAL
    curve = [{"ts": 0, "equity": cap, "drawdown": 0.0}]
    for t in sorted(_trades(), key=lambda x: x.closed_ts):
        cap += t.pnl
        curve.append({"ts": t.closed_ts, "equity": cap, "drawdown": 0.0})
    return curve


def build_portfolio() -> dict:
    trades = _trades()
    stats = calculate_portfolio_stats(trades, PAPER_STARTING_CAPITAL)
    edge = calculate_edge_quality(trades)
    breakdown = calculate_strategy_breakdown(trades)
    best = max(trades, key=lambda t: t.pnl, default=None)
    worst = min(trades, key=lambda t: t.pnl, default=None)
    return {
        "stats": asdict(stats),
        "edge_quality": asdict(edge),
        "strategy_breakdown": [asdict(b) for b in breakdown],
        "equity": _equity_curve(),
        "current_streak": _current_streak(trades),
        "best_trade": asdict(best) if best else None,
        "worst_trade": asdict(worst) if worst else None,
        "open_positions": store.open_positions(),
        "starting_capital": PAPER_STARTING_CAPITAL,
        "current_capital": stats.current_capital,
    }


def rolling_stats(window: str) -> dict:
    since = None
    if window == "7d":
        since = datetime.now(timezone.utc) - timedelta(days=7)
    elif window == "30d":
        since = datetime.now(timezone.utc) - timedelta(days=30)
    trades = _trades(since=since)
    stats = calculate_portfolio_stats(trades, PAPER_STARTING_CAPITAL)
    edge = calculate_edge_quality(trades)
    return {"window": window, "stats": asdict(stats), "edge_quality": asdict(edge)}
