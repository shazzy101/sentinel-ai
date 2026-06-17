"""
Sentinel AI — Signals REST API

Public endpoints for trade signals + track record, and admin endpoints
for signal lifecycle management (pending review → active → win/loss).
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from db.supabase import (
    get_signal,
    insert_signal,
    list_pending_signals,
    list_signals,
    update_signal,
)

router = APIRouter()

# Statuses that are safe to expose publicly.
# 'pending_review' MUST NOT appear here — it must never leak to the public.
_PUBLIC_STATUSES = {"active", "win", "loss", "rejected"}

# Statuses that should be excluded from public listing when no filter is given.
_HIDDEN_STATUSES = {"pending_review"}


# ─────────────────────────────────────────
# Lazy require_admin import — avoids circular imports with main.py
# while keeping the dependency reference identical (same object).
# ─────────────────────────────────────────

def _get_require_admin():
    """Return the require_admin dependency defined in main.py."""
    import main as _main
    return _main.require_admin


# ─────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────

class SignalCreateBody(BaseModel):
    asset: str = Field(..., min_length=1, max_length=20)
    direction: str
    confidence: int
    entry_low: Optional[float] = None
    entry_high: Optional[float] = None
    target: Optional[float] = None
    stop_loss: Optional[float] = None
    explanation: Optional[str] = None
    pattern_type: Optional[str] = None
    whale_wallets: Optional[list[str]] = None
    tx_hashes: Optional[list[str]] = None

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v: str) -> str:
        if v not in ("long", "short"):
            raise ValueError("direction must be 'long' or 'short'")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("confidence must be between 1 and 5")
        return v


# ─────────────────────────────────────────
# TRACK RECORD HELPER (pure — unit-testable, no I/O)
# ─────────────────────────────────────────

def compute_track_record(signals: list[dict]) -> dict:
    """
    Compute track record stats from a list of resolved signal dicts.

    Only signals with status 'win' or 'loss' contribute to stats.
    Returns a dict with keys:
        total_signals, wins, losses, win_rate, avg_return,
        best_signal_return, worst_signal_return, per_confidence
    per_confidence maps tier 1..5 → {count, win_rate, avg_return}.
    """
    resolved = [s for s in signals if s.get("status") in ("win", "loss")]

    wins = sum(1 for s in resolved if s.get("status") == "win")
    losses = sum(1 for s in resolved if s.get("status") == "loss")
    total = wins + losses
    win_rate = round(wins / total, 4) if total else 0.0

    returns = []
    for s in resolved:
        r = s.get("outcome_return")
        if r is not None:
            try:
                returns.append(float(r))
            except (TypeError, ValueError):
                pass

    avg_return = round(sum(returns) / len(returns), 4) if returns else 0.0
    best_signal_return = round(max(returns), 4) if returns else 0.0
    worst_signal_return = round(min(returns), 4) if returns else 0.0

    # Per-confidence tier breakdown (1..5)
    per_confidence: dict[str, dict] = {}
    for tier in range(1, 6):
        tier_signals = [s for s in resolved if s.get("confidence") == tier]
        tier_wins = sum(1 for s in tier_signals if s.get("status") == "win")
        tier_total = len(tier_signals)
        tier_returns = []
        for s in tier_signals:
            r = s.get("outcome_return")
            if r is not None:
                try:
                    tier_returns.append(float(r))
                except (TypeError, ValueError):
                    pass
        per_confidence[str(tier)] = {
            "count": tier_total,
            "win_rate": round(tier_wins / tier_total, 4) if tier_total else 0.0,
            "avg_return": round(sum(tier_returns) / len(tier_returns), 4) if tier_returns else 0.0,
        }

    return {
        "total_signals": total,
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "avg_return": avg_return,
        "best_signal_return": best_signal_return,
        "worst_signal_return": worst_signal_return,
        "per_confidence": per_confidence,
    }


# ─────────────────────────────────────────
# PUBLIC ROUTES
# ─────────────────────────────────────────

@router.get("/api/signals")
async def list_public_signals(
    status: Optional[str] = None,
    limit: int = 50,
):
    """
    Public — list resolved/active signals.
    Callers CANNOT retrieve pending_review signals via this endpoint, even if
    they explicitly pass status=pending_review. Hidden statuses are blocked.
    """
    # Block any attempt to query hidden statuses from the public endpoint.
    if status and status in _HIDDEN_STATUSES:
        # Return empty list rather than a 403 — don't confirm the status exists.
        return {"signals": [], "count": 0}

    limit = max(1, min(limit, 200))

    if status:
        # Only allow known public statuses.
        if status not in _PUBLIC_STATUSES:
            return {"signals": [], "count": 0}
        signals = list_signals(status=status, limit=limit)
    else:
        # No status filter — return all non-pending results. We fetch broadly
        # and filter client-side to avoid per-status round-trips.
        # We use a high limit then trim to ensure we get `limit` public rows.
        all_signals = list_signals(status=None, limit=min(limit * 4, 800))
        signals = [s for s in all_signals if s.get("status") not in _HIDDEN_STATUSES][:limit]

    return {"signals": signals, "count": len(signals)}


@router.get("/api/signals/{signal_id}")
async def get_public_signal(signal_id: str):
    """
    Public — fetch a single signal by ID.
    404s when the signal is missing OR pending_review (never leak pending to public).
    """
    signal = get_signal(signal_id)
    if signal is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    if signal.get("status") in _HIDDEN_STATUSES:
        raise HTTPException(status_code=404, detail="Signal not found")
    return {"signal": signal}


@router.get("/api/track-record")
async def get_track_record():
    """
    Public — computed track record stats.
    Values are derived directly from resolved (win/loss) signals in the DB;
    these are the source of truth, not the cached track_record_summary table.
    """
    # Fetch all resolved signals (no limit — we want the full population).
    signals = list_signals(status=None, limit=2000)
    resolved = [s for s in signals if s.get("status") in ("win", "loss")]
    stats = compute_track_record(resolved)
    return {"track_record": stats}


# ─────────────────────────────────────────
# ADMIN ROUTES
# ─────────────────────────────────────────

@router.get("/api/admin/signals/pending")
async def list_pending(request: Request):
    """Admin — list all signals awaiting review."""
    require_admin = _get_require_admin()
    await require_admin(request)
    signals = list_pending_signals()
    return {"signals": signals, "count": len(signals)}


@router.post("/api/admin/signals/{signal_id}/approve")
async def approve_signal(signal_id: str, request: Request):
    """
    Admin — approve a pending signal.
    Sets status='active' and approved_at=now().

    TODO(twitter): After status is set active, call the Twitter/X posting
    integration here to tweet the signal. This hook is intentionally left
    empty — wiring the tweet call is a LATER task. Preserve this comment.
    """
    require_admin = _get_require_admin()
    await require_admin(request)

    existing = get_signal(signal_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Signal not found")

    updated = update_signal(signal_id, {
        "status": "active",
        "approved_at": datetime.now(timezone.utc).isoformat(),
    })

    # TODO(twitter): tweet the signal here once the Twitter integration is ready.
    # Example: await post_signal_tweet(updated)

    return {"signal": updated}


@router.post("/api/admin/signals/{signal_id}/reject")
async def reject_signal(signal_id: str, request: Request):
    """
    Admin — reject a pending signal.
    Sets status='rejected'.

    MIGRATION NOTE: The DB CHECK constraint in 20260616_signals_table.sql
    currently allows only ('pending_review', 'active', 'win', 'loss').
    Adding 'rejected' requires the migration to be updated and re-run:

        ALTER TABLE signals
          DROP CONSTRAINT IF EXISTS signals_status_check,
          ADD CONSTRAINT signals_status_check
            CHECK (status IN ('pending_review', 'active', 'win', 'loss', 'rejected'));

    This is included in the updated migration file.
    """
    require_admin = _get_require_admin()
    await require_admin(request)

    existing = get_signal(signal_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Signal not found")

    updated = update_signal(signal_id, {"status": "rejected"})
    return {"signal": updated}


@router.post("/api/admin/signals")
async def create_signal_admin(body: SignalCreateBody, request: Request):
    """
    Admin — manual signal entry.
    Inserts a new signal with status='pending_review' so it flows through
    the normal approval process.
    """
    require_admin = _get_require_admin()
    await require_admin(request)

    data = {
        "asset": body.asset,
        "direction": body.direction,
        "confidence": body.confidence,
        "status": "pending_review",
    }
    if body.entry_low is not None:
        data["entry_low"] = body.entry_low
    if body.entry_high is not None:
        data["entry_high"] = body.entry_high
    if body.target is not None:
        data["target"] = body.target
    if body.stop_loss is not None:
        data["stop_loss"] = body.stop_loss
    if body.explanation is not None:
        data["explanation"] = body.explanation
    if body.pattern_type is not None:
        data["pattern_type"] = body.pattern_type
    if body.whale_wallets is not None:
        data["whale_wallets"] = body.whale_wallets
    if body.tx_hashes is not None:
        data["tx_hashes"] = body.tx_hashes

    signal = insert_signal(data)
    return {"signal": signal}
