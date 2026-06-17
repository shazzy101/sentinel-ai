from __future__ import annotations
from growth.models import RankedSignal, ContentPiece

CTA = "Live smart-money feed → hadaleum.com (free)"


def _verb(action: str) -> str:
    return {"buy": "aped into", "take_profit": "took profit on",
            "sell": "exited"}.get(action, "moved on")


def _truncate(text: str, limit: int = 280) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def make_content(rs: RankedSignal) -> ContentPiece:
    s = rs.signal

    # Win-ledger signals already carry a ready-to-post hook from marketing snapshot.
    if s.kind == "win_ledger":
        hook = (s.raw or {}).get("tweet_hook") or f"Hadaleum win ledger update. {CTA}"
        return ContentPiece(original_post=_truncate(hook), reply_variants=[_truncate(hook)],
                            cta=CTA, signal_token=s.token or "")

    tok = (s.token or "").upper()
    # Only surface a dollar figure when it's large enough to read as conviction.
    # Tiny swaps ("$222") undercut the smart-money framing, so show them qualitatively.
    size = f"${s.amount_usd:,.0f}" if (s.amount_usd and s.amount_usd >= 1000) else "a position"
    wr = f" ({s.unrealized_win_rate_pct:.0f}% win rate)" if s.unrealized_win_rate_pct else ""
    rank = f"#{s.rank} " if s.rank else ""
    verb = _verb(s.action)

    original = _truncate(
        f"Smart-money watch: a {rank}ranked wallet{wr} just {verb} {size} of ${tok}. "
        f"On-chain, verifiable. {CTA}")

    reply_variants = [
        _truncate(f"FWIW a top-ranked on-chain wallet{wr} just {verb} {size} of ${tok}. "
                  f"Tracking it live: hadaleum.com"),
        _truncate(f"${tok} flow note: ranked smart money {verb} {size} here. "
                  f"Full feed (free) → hadaleum.com"),
        _truncate(f"Worth a look — ${tok} just saw a {rank}ranked wallet {verb} {size}. "
                  f"hadaleum.com"),
    ]
    return ContentPiece(original_post=original, reply_variants=reply_variants,
                        cta=CTA, signal_token=tok)
