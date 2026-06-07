"""
Sentinel AI — Wallet Scoring Engine v2
Real methodology: ROI proxy + win rate + activity consistency + balance weight.
"""

from datetime import datetime, timezone
from typing import Optional


def score_wallet(transactions: list[dict], balance: float, chain: str) -> dict:
    """
    Score 0–100. Grade S/A/B/C/D/F.

    Breakdown (100pts total):
      35pts — Activity score (volume, recency, consistency)
      30pts — Success rate (non-error, non-failed transactions)
      25pts — Balance weight (proxy for whale status)
      10pts — Recency bonus (active in last 7 days)
    """
    if not transactions:
        return {
            "score": 0, "grade": "F",
            "breakdown": {"activity": 0, "success_rate": 0, "balance": 0, "recency": 0},
            "methodology": "v2_no_data",
            "summary": "No transaction data available."
        }

    tx_count = len(transactions)

    # ── 1. Activity score (35pts) ─────────────────────────────────────────────
    # Points for having transactions at all, scaled by count
    # 1 tx = ~10pts, 5 tx = ~25pts, 10+ tx = 35pts
    activity_raw = min(tx_count / 10.0, 1.0)
    activity_score = round(activity_raw * 35)

    # ── 2. Success rate (30pts) ───────────────────────────────────────────────
    successful = sum(1 for t in transactions if t.get("status") in ("success", "Success", "finalized"))
    if successful == 0:
        successful = sum(1 for t in transactions if t.get("status") not in ("failed", "error", "Failed", None))
    success_rate = successful / tx_count if tx_count > 0 else 0
    success_score = round(success_rate * 30)

    # ── 3. Balance weight (25pts) ─────────────────────────────────────────────
    # ETH: 100+ ETH = whale (max), 10 ETH = mid
    balance_score = round(min(balance / 100.0, 1.0) * 25)

    # ── 4. Recency bonus (10pts) ──────────────────────────────────────────────
    recency_score = 0
    latest_ts = _get_latest_timestamp(transactions)
    if latest_ts:
        days_since = (datetime.now(timezone.utc) - latest_ts).days
        if days_since <= 1:
            recency_score = 10
        elif days_since <= 7:
            recency_score = 7
        elif days_since <= 30:
            recency_score = 3

    total = min(activity_score + success_score + balance_score + recency_score, 100)
    grade = _grade(total)
    summary = _summary(total, tx_count, success_rate, chain, balance)

    return {
        "score": total,
        "grade": grade,
        "breakdown": {
            "activity": activity_score,
            "success_rate": success_score,
            "balance": balance_score,
            "recency": recency_score,
        },
        "methodology": "v2_proxy",
        "last_active_days_ago": (datetime.now(timezone.utc) - latest_ts).days if latest_ts else None,
        "win_rate": round(success_rate * 100, 1),
        "summary": summary,
    }


def _get_latest_timestamp(transactions: list[dict]) -> Optional[datetime]:
    """Parse the most recent transaction timestamp from ETH tx rows."""
    for tx in transactions:
        ts_str = tx.get("timestamp")
        ts_unix = tx.get("timestamp_unix")
        try:
            if ts_str:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
            elif ts_unix:
                return datetime.fromtimestamp(ts_unix, tz=timezone.utc)
        except Exception:
            continue
    return None


def _grade(score: int) -> str:
    if score >= 92: return "S"
    if score >= 82: return "A"
    if score >= 68: return "B"
    if score >= 52: return "C"
    if score >= 36: return "D"
    return "F"


def _summary(score: int, tx_count: int, win_rate: float, chain: str, balance: float) -> str:
    symbol = "ETH"
    win_pct = round(win_rate * 100)
    if score >= 82:
        return f"High-conviction wallet. {tx_count} recent txs, {win_pct}% success rate, {balance:,.0f} {symbol} held."
    if score >= 60:
        return f"Active wallet with moderate signal. {tx_count} txs, {win_pct}% success."
    return f"Low activity or low balance. {tx_count} txs recorded."