"""
Populate Supabase `wallets` table from the curated ETH smart-wallet universe.

Usage:
  python scripts/populate_watchlist.py
  python scripts/populate_watchlist.py --limit 60
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: F401
from db.supabase import supabase_client

SEED_FILE = Path(__file__).resolve().parent.parent / "data" / "eth_smart_wallets.json"


def load_wallets(limit: int = 0) -> list[dict]:
    with SEED_FILE.open("r", encoding="utf-8") as f:
        rows = json.load(f)
    if limit > 0:
        rows = rows[:limit]
    return rows


def to_seed_score(rank: int, activity_score: float) -> int:
    base = max(0, 100 - min(rank, 100))
    bonus = int(min(activity_score / 2.0, 20))
    return min(99, max(45, base + bonus))


def populate(limit: int = 0) -> None:
    wallets = load_wallets(limit)
    upserts = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for w in wallets:
        upserts.append({
            "address": w["address"],
            "label": w["label"],
            "chain": "ethereum",
            "tags": w.get("tags", ["ethereum", "smart-money"]),
            "score": to_seed_score(w.get("rank", 100), w.get("seed_activity_score", 0)),
            "score_breakdown": {
                "seed_rank": w.get("rank"),
                "seed_tx_count": w.get("source_tx_count"),
                "seed_balance_eth": w.get("source_balance_eth"),
                "seed_activity_score": w.get("seed_activity_score"),
            },
            "last_scanned": now_iso,
        })

    for i in range(0, len(upserts), 200):
        batch = upserts[i:i + 200]
        supabase_client.table("wallets").upsert(
            batch, on_conflict="address", ignore_duplicates=False
        ).execute()

    print(f"Seeded/updated {len(upserts)} Ethereum smart-money wallets.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Populate wallets table from curated ETH list")
    parser.add_argument("--limit", type=int, default=0, help="Insert only first N wallets")
    args = parser.parse_args()
    populate(limit=args.limit)
