"""Supabase CRUD for the APEX module.

Every function is defensive: on any DB error it logs and returns a safe empty value
so endpoints/crons degrade gracefully instead of 500-ing. Tables created by
supabase/migrations/20260627_apex_trading.sql.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from trading.api_clients import get_admin_client
from trading.constants import PAPER_STARTING_CAPITAL, POSITION_EXPIRY_HOURS

_log = logging.getLogger("apex.store")


def _client():
    return get_admin_client()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── logging ──────────────────────────────────────────────────────────────
def log(level: str, source: str, message: str, meta: Optional[dict] = None) -> None:
    try:
        _client().table("trading_logs").insert({
            "level": level, "source": source, "message": message, "meta": meta or {},
        }).execute()
    except Exception as exc:  # never let logging break a cron
        _log.warning("trading_logs insert failed: %s", exc)


# ── signals ──────────────────────────────────────────────────────────────
def signal_to_row(sig) -> dict:
    return {
        "asset": sig.asset, "timeframe": sig.timeframe, "direction": sig.dir,
        "price": sig.price, "sl": sig.sl, "tp": sig.tp, "confidence": sig.confidence,
        "confluence_score": sig.confluence_score, "votes": sig.votes,
        "is_high_conviction": sig.is_high_conviction, "strategies": sig.strategies,
        "rsi": sig.rsi, "vwap": sig.vwap, "atr": sig.atr, "status": sig.status,
        "is_paper": True,
    }


def insert_signal(row: dict) -> Optional[dict]:
    try:
        res = _client().table("trading_signals").insert(row).execute()
        return (res.data or [None])[0]
    except Exception as exc:
        _log.error("insert_signal failed: %s", exc)
        return None


def update_signal(signal_id: str, data: dict) -> None:
    try:
        _client().table("trading_signals").update(data).eq("id", signal_id).execute()
    except Exception as exc:
        _log.error("update_signal failed: %s", exc)


def list_signals(
    *, asset: Optional[str] = None, status: Optional[str] = None,
    strategy: Optional[str] = None, limit: int = 50, offset: int = 0,
) -> list[dict]:
    try:
        q = _client().table("trading_signals").select("*")
        if asset:
            q = q.eq("asset", asset)
        if status:
            q = q.eq("status", status)
        if strategy:
            q = q.contains("strategies", [strategy])
        q = q.order("created_at", desc=True).range(offset, offset + limit - 1)
        return (q.execute().data) or []
    except Exception as exc:
        _log.error("list_signals failed: %s", exc)
        return []


def latest_signals(n: int = 10) -> list[dict]:
    return list_signals(limit=n)


def daily_signal_count() -> int:
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        res = _client().table("trading_signals").select("id").gte("created_at", since).execute()
        return len(res.data or [])
    except Exception:
        return 0


# ── positions ────────────────────────────────────────────────────────────
def insert_position(row: dict) -> Optional[dict]:
    try:
        res = _client().table("paper_positions").insert(row).execute()
        return (res.data or [None])[0]
    except Exception as exc:
        _log.error("insert_position failed: %s", exc)
        return None


def list_positions(status: Optional[str] = None) -> list[dict]:
    try:
        q = _client().table("paper_positions").select("*")
        if status:
            q = q.eq("status", status)
        return (q.order("opened_at", desc=True).execute().data) or []
    except Exception as exc:
        _log.error("list_positions failed: %s", exc)
        return []


def open_positions() -> list[dict]:
    return list_positions(status="OPEN")


def has_open_position(asset: str) -> bool:
    try:
        res = (_client().table("paper_positions").select("id")
               .eq("asset", asset).eq("status", "OPEN").limit(1).execute())
        return bool(res.data)
    except Exception:
        return False


def update_position(position_id: str, data: dict) -> None:
    try:
        _client().table("paper_positions").update(data).eq("id", position_id).execute()
    except Exception as exc:
        _log.error("update_position failed: %s", exc)


def closed_positions(limit: int = 1000) -> list[dict]:
    try:
        res = (_client().table("paper_positions").select("*")
               .eq("status", "CLOSED").order("exit_at", desc=True).limit(limit).execute())
        return res.data or []
    except Exception as exc:
        _log.error("closed_positions failed: %s", exc)
        return []


def closed_today() -> list[dict]:
    try:
        since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        res = (_client().table("paper_positions").select("*")
               .eq("status", "CLOSED").gte("exit_at", since).execute())
        return res.data or []
    except Exception:
        return []


# ── equity ───────────────────────────────────────────────────────────────
def insert_equity_snapshot(equity: float, drawdown: float, open_count: int) -> None:
    try:
        _client().table("paper_equity_snapshots").insert({
            "equity": equity, "drawdown": drawdown, "open_positions": open_count,
        }).execute()
    except Exception as exc:
        _log.error("insert_equity_snapshot failed: %s", exc)


def equity_snapshots(limit: int = 500) -> list[dict]:
    try:
        res = (_client().table("paper_equity_snapshots").select("*")
               .order("taken_at", desc=False).limit(limit).execute())
        return res.data or []
    except Exception:
        return []


# ── derived ──────────────────────────────────────────────────────────────
def current_capital() -> float:
    total = 0.0
    for p in closed_positions():
        total += float(p.get("pnl") or 0)
    return PAPER_STARTING_CAPITAL + total


def is_expired(opened_at_iso: str) -> bool:
    try:
        opened = datetime.fromisoformat(opened_at_iso.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) - opened > timedelta(hours=POSITION_EXPIRY_HOURS)
    except Exception:
        return False


# ── waitlist ───────────────────────────────────────────────────────────────
def add_waitlist(email: str) -> bool:
    """Insert email; returns False if duplicate or on error."""
    try:
        existing = _client().table("trading_waitlist").select("id").eq("email", email).limit(1).execute()
        if existing.data:
            return False
        _client().table("trading_waitlist").insert({"email": email}).execute()
        return True
    except Exception as exc:
        _log.error("add_waitlist failed: %s", exc)
        return False


def waitlist_count() -> int:
    try:
        res = _client().table("trading_waitlist").select("id").execute()
        return len(res.data or [])
    except Exception:
        return 0


# ── admin ────────────────────────────────────────────────────────────────
def reset_paper() -> None:
    """Wipe all paper data back to a fresh $10k start. Admin only."""
    c = _client()
    for table in ("paper_positions", "trading_signals", "paper_equity_snapshots"):
        try:
            c.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception as exc:
            _log.error("reset_paper %s failed: %s", table, exc)
