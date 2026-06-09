"""
Sentinel AI — Entity Cleanup

Demotes exchanges / custodians / protocol contracts to score 20 and repairs
stale labels left by older ingestion runs. Pure DB operation — no Etherscan,
no Claude — runs in seconds.

Two passes:
  1. Seed truth: every address tagged is_infra in etherscan_top_accounts.json
     is forced to its correct label + score 20 (fixes e.g. WETH that an old
     run mislabeled "Smart Money 6").
  2. Label sweep: any wallet in the DB whose label matches the entity keyword
     set (Coinhako, Bitso, …) is capped at 20 even if not in the seed.

Usage:
    python scripts/fix_entities.py            # apply
    python scripts/fix_entities.py --dry-run  # report only
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: F401 — load .env before db import

from scoring.engine import _is_known_entity, _entity_result
from db.supabase import supabase_client

SEED_FILE = Path(__file__).resolve().parent.parent / "data" / "etherscan_top_accounts.json"


def all_wallets() -> list[dict]:
    rows: list[dict] = []
    page = 0
    while True:
        res = (
            supabase_client.table("wallets")
            .select("id, address, label, score")
            .range(page * 1000, page * 1000 + 999)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < 1000:
            break
        page += 1
    return rows


def run(dry_run: bool):
    seed = json.load(SEED_FILE.open(encoding="utf-8"))
    seed_by_addr = {s["address"].lower(): s for s in seed}
    entity_payload = _entity_result("")

    db = all_wallets()
    print(f"Loaded {len(db)} DB wallets, {len(seed)} seed entries\n")

    fixed = 0
    relabeled = 0
    for w in db:
        addr = (w.get("address") or "").lower()
        label = w.get("label") or ""
        score = w.get("score") or 0

        seed_entry = seed_by_addr.get(addr)
        seed_is_entity = bool(seed_entry and seed_entry.get("is_infra"))
        correct_label = seed_entry["label"] if seed_entry else label

        is_entity = seed_is_entity or _is_known_entity(addr, correct_label)
        if not is_entity:
            continue
        if score <= 20 and label == correct_label:
            continue  # already correct

        update = {
            "score": 20,
            "score_breakdown": entity_payload["breakdown"],
            "label": correct_label,
        }
        if label != correct_label:
            relabeled += 1
        action = "would fix" if dry_run else "fixed"
        print(f"  {action}: {label[:28]:28} → {correct_label[:24]:24} score {score}→20")
        if not dry_run:
            try:
                supabase_client.table("wallets").update(update).eq("id", w["id"]).execute()
            except Exception as e:
                print(f"    ✗ update failed: {str(e)[:60]}")
                continue
        fixed += 1

    print(f"\n{'DRY RUN — ' if dry_run else ''}Entities demoted to 20: {fixed} ({relabeled} relabeled)")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    run(args.dry_run)
