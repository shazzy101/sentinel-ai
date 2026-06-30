"""Signal generation + position monitoring — the live paper-trading loop.

Called both by the protected HTTP endpoints (Step 8/9) and the asyncio crons (Step 12).
In-process (no HTTP self-calls). Every asset/position iteration is isolated in try/except
so one failure never breaks the batch.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from trading import store
from trading.engine import run_strategies_on_bar
from trading.api_clients import fetch_ohlcv, is_market_open
from trading.constants import (
    ASSETS, ASSETS_BY_SYMBOL, RISK_PARAMS, PAPER_STARTING_CAPITAL,
)

_log = logging.getLogger("apex.runner")


def _drawdown_breached() -> bool:
    """True if today's realized P&L is down more than max_daily_drawdown of start capital."""
    today_pnl = sum(float(p.get("pnl") or 0) for p in store.closed_today())
    limit = -RISK_PARAMS["max_daily_drawdown"] * PAPER_STARTING_CAPITAL
    return today_pnl <= limit


def generate_signals() -> dict:
    """Scan all assets, fire signals where confluence + risk guards allow."""
    capital = store.current_capital()
    daily_count = store.daily_signal_count()
    max_daily = int(RISK_PARAMS["max_daily_trades"])
    risk_pct = RISK_PARAMS["default_risk_pct"]

    if _drawdown_breached():
        store.log("warn", "signal_cron", "daily drawdown breached — generation halted")
        return {"generated": 0, "signals": [], "halted": "daily_drawdown"}

    generated: list[dict] = []
    for asset in ASSETS:
        if daily_count + len(generated) >= max_daily:
            break
        try:
            # stocks/ETFs only when the market is open
            if asset.kind in ("stock", "etf") and not is_market_open():
                continue
            if store.has_open_position(asset.symbol):
                continue
            bars = fetch_ohlcv(asset.symbol, "5m", 100)
            if len(bars) < 53:
                continue
            sig = run_strategies_on_bar(bars, len(bars) - 1, asset=asset.symbol)
            if sig is None:
                continue
            # dedupe: don't re-fire the same asset+direction within 30 min
            if store.recent_signal_exists(sig.asset, sig.dir, minutes=30):
                continue

            row = store.insert_signal(store.signal_to_row(sig))
            if not row:
                continue

            entry = sig.price
            risk_per_unit = abs(entry - sig.sl)
            if risk_per_unit <= 0:
                continue
            risk_amt = capital * risk_pct
            units = risk_amt / risk_per_unit
            store.insert_position({
                "signal_id": row["id"], "asset": sig.asset, "direction": sig.dir,
                "entry_price": entry, "sl": sig.sl, "tp": sig.tp,
                "size": units * entry, "risk_pct": risk_pct, "status": "OPEN",
            })
            generated.append(row)
            store.log("info", "signal_cron",
                      f"signal {sig.asset} {sig.dir} votes={sig.votes}",
                      {"signal_id": row["id"], "high_conviction": sig.is_high_conviction})
        except Exception as exc:
            _log.error("generate_signals %s failed: %s", asset.symbol, exc)
            store.log("error", "signal_cron", f"{asset.symbol} scan failed: {exc}")
    return {"generated": len(generated), "signals": generated}


def _last_price(asset: str) -> float | None:
    bars = fetch_ohlcv(asset, "5m", 1)
    return bars[-1].close if bars else None


def monitor_positions() -> dict:
    """Check open positions for SL/TP/expiry, close hits, snapshot equity."""
    positions = store.open_positions()
    closed = 0
    for p in positions:
        try:
            asset = p["asset"]
            entry = float(p["entry_price"])
            sl, tp = float(p["sl"]), float(p["tp"])
            is_long = p["direction"] == "LONG"
            price = _last_price(asset)
            if price is None:
                continue

            exit_price = exit_reason = None
            hit_tp = price >= tp if is_long else price <= tp
            hit_sl = price <= sl if is_long else price >= sl
            if hit_sl:                      # SL takes priority (conservative)
                exit_price, exit_reason = sl, "SL"
            elif hit_tp:
                exit_price, exit_reason = tp, "TP"
            elif store.is_expired(p.get("opened_at", "")):
                exit_price, exit_reason = price, "EXPIRED"
            if exit_price is None:
                continue

            move = (exit_price - entry) / entry * (1 if is_long else -1)
            pnl_pct = move * 100
            units = float(p["size"]) / entry if entry else 0
            pnl = (exit_price - entry) * units * (1 if is_long else -1)
            sig_status = {"TP": "WIN", "SL": "LOSS", "EXPIRED": "EXPIRED"}[exit_reason]

            store.update_position(p["id"], {
                "status": "CLOSED", "exit_price": exit_price,
                "exit_at": datetime.now(timezone.utc).isoformat(),
                "pnl": pnl, "pnl_pct": pnl_pct, "exit_reason": exit_reason,
            })
            if p.get("signal_id"):
                store.update_signal(p["signal_id"], {
                    "status": sig_status, "exit_price": exit_price, "pnl_pct": pnl_pct,
                    "exit_reason": exit_reason,
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                })
            closed += 1
            store.log("info", "monitor_cron",
                      f"closed {asset} {exit_reason} pnl={pnl:.2f}", {"position_id": p["id"]})
        except Exception as exc:
            _log.error("monitor_positions %s failed: %s", p.get("id"), exc)
            store.log("error", "monitor_cron", f"position {p.get('id')} failed: {exc}")

    # Equity snapshot only when something actually closed — avoids ~1440 rows/day
    # of no-op snapshots from the 1-minute monitor cadence.
    if closed:
        try:
            cap = store.current_capital()
            dd = (cap - PAPER_STARTING_CAPITAL) / PAPER_STARTING_CAPITAL * 100
            store.insert_equity_snapshot(cap, min(0.0, dd), len(store.open_positions()))
        except Exception as exc:
            _log.error("equity snapshot failed: %s", exc)

    return {"closed": closed, "checked": len(positions)}
