#!/usr/bin/env python3
"""Run trust pipeline locally (ingest + score) against production Supabase."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import config  # noqa: F401 — load_dotenv

from copy_traders_store import load_copy_traders
from detected_moves import get_marketing_snapshot, get_trust_pulse, run_trust_pipeline


def _pool() -> list[dict]:
    wallets = load_copy_traders() or []
    wallets.sort(
        key=lambda w: float(w.get("copy_trading_score") or w.get("copy_score") or 0),
        reverse=True,
    )
    return wallets[:50]


async def main() -> None:
    load_copy_traders(force_refresh=True)
    enriched = _pool()
    print(f"Copy traders in pool: {len(enriched)}")

    result = await run_trust_pipeline(enriched, limit=50)
    print("Pipeline:", json.dumps(result, indent=2))

    pulse = await get_trust_pulse()
    marketing = await get_marketing_snapshot()
    print("\n--- Marketing headline ---")
    print(marketing.get("headline") or "(building ledger — check back after more detections)")
    print("\n--- 24h stats ---")
    print(json.dumps(pulse.get("last_24h"), indent=2))
    print("\n--- Pending ---")
    print(f"Pending scoring: {pulse.get('pending_scoring')}")
    print(f"On track for WIN (live): {marketing.get('on_track_count')}")


if __name__ == "__main__":
    asyncio.run(main())
