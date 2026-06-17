from __future__ import annotations
from datetime import datetime, timezone
from growth.models import Signal, RankedSignal

# Tokens that read as boring/non-tweetable when they're the headline asset.
_DULL = frozenset({"USDC", "USDT", "DAI", "BUSD", "FRAX", "TUSD", "USDP",
                   "LUSD", "GHO", "PYUSD", "FDUSD"})


def _parse(ts: str) -> datetime | None:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def tweetability_score(s: Signal, now: str | None = None) -> tuple[float, list[str]]:
    """Deterministic score for how tweet-worthy a signal is on crypto X.
    Rewards specific tokens, size, recency, trader quality, and fresh entries."""
    score = 0.0
    reasons: list[str] = []

    tok = (s.token or "").upper()
    if tok and tok not in _DULL:
        score += 2.0
        reasons.append(f"specific token ${tok}")
    else:
        score += 0.3

    if s.amount_usd:
        size_pts = min(s.amount_usd / 20000.0, 1.0) * 3.0
        score += size_pts
        if s.amount_usd >= 25000:
            reasons.append(f"large size ${s.amount_usd:,.0f}")

    now_dt = _parse(now) if now else datetime.now(timezone.utc)
    ts_dt = _parse(s.ts)
    if now_dt and ts_dt:
        mins = (now_dt - ts_dt).total_seconds() / 60.0
        if mins < 60:
            score += 2.0
            reasons.append("very recent (<1h)")
        elif mins < 360:
            score += 1.0
            reasons.append("recent (<6h)")

    if s.unrealized_win_rate_pct is not None:
        score += (s.unrealized_win_rate_pct / 100.0) * 2.0
        if s.unrealized_win_rate_pct >= 65:
            reasons.append(f"{s.unrealized_win_rate_pct:.0f}% win-rate trader")

    if s.rank is not None and s.rank > 0:
        score += min(3.0 / s.rank, 1.5)
        if s.rank <= 3:
            reasons.append(f"top-{s.rank} ranked trader")

    if s.action == "buy":
        score += 1.5
        reasons.append("fresh entry")
    elif s.action == "take_profit":
        score += 0.5

    return round(score, 3), reasons


def select_top(signals: list[Signal], n: int = 5, now: str | None = None) -> list[RankedSignal]:
    ranked = []
    for s in signals:
        score, reasons = tweetability_score(s, now=now)
        ranked.append(RankedSignal(signal=s, tweetability=score, reasons=reasons))
    ranked.sort(key=lambda r: r.tweetability, reverse=True)
    return ranked[:n]
