from __future__ import annotations
from growth.models import ContentPiece, DailyBrief


def build_brief(date: str, pieces: list[ContentPiece], engagement: list[dict],
                metrics_delta: dict, headline: str | None = None) -> DailyBrief:
    return DailyBrief(date=date, pieces=pieces, engagement=engagement,
                      metrics_delta=metrics_delta, headline=headline)


def to_markdown(b: DailyBrief) -> str:
    lines = [f"# Hadaleum Growth Brief — {b.date}", ""]
    if b.headline:
        lines += [f"> {b.headline}", ""]

    d = b.metrics_delta or {}
    lines += ["## Yesterday's movement",
              f"- followers: {d.get('followers', 0):+d}  "
              f"profile clicks: {d.get('profile_clicks', 0):+d}  "
              f"signups: {d.get('signups', 0):+d}", ""]

    lines += ["## Today's posts (send the best 2-3)", ""]
    for i, p in enumerate(b.pieces, 1):
        lines += [f"### {i}. ${p.signal_token or 'update'}",
                  "**Original post:**", "", f"> {p.original_post}", "",
                  "**Reply variants:**"]
        lines += [f"- {v}" for v in p.reply_variants]
        lines += [""]

    lines += ["## Engagement checklist (reply under FRESH posts, first 5-15 min)", ""]
    for item in b.engagement:
        lines += [f"- [ ] {item.get('handle')} ({item.get('beat', '')}) — "
                  f"lead with ${item.get('suggested_token') or 'top signal'}"]
    lines += [""]
    return "\n".join(lines)
