from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from growth.alpha_extractor import extract_signals
from growth.ranker import select_top
from growth.content import make_content
from growth.engagement import load_targets, plan
from growth.tracker import latest_delta
from growth.brief import build_brief, to_markdown
from growth.delivery import deliver
from detected_moves import get_marketing_snapshot


async def run() -> str:
    date = datetime.now(timezone.utc).date().isoformat()
    signals = await extract_signals(limit=15)
    top = select_top(signals, n=5)
    pieces = [make_content(rs) for rs in top]
    targets = load_targets()
    engagement = plan(targets, top)
    delta = latest_delta()
    snap = await get_marketing_snapshot()
    brief = build_brief(date=date, pieces=pieces, engagement=engagement,
                        metrics_delta=delta, headline=snap.get("headline"))
    md = to_markdown(brief)
    path = await deliver(date, md)
    print(f"[growth] brief written -> {path}")
    return md


if __name__ == "__main__":
    asyncio.run(run())
