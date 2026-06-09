"""
Sentinel AI — Bulk Seed from Etherscan Top Accounts

Loads backend/data/etherscan_top_accounts.json (825 real verified addresses),
fetches live balance + recent tx history + token transfers from Etherscan,
scores each with the v4 "find the alpha" engine, and upserts to Supabase.

Claude is NOT called here — this is a pure data seed. AI analysis is layered
on later by the cron / manual scan only for the wallets that matter.

Usage:
    python scripts/seed_top_accounts.py                 # seed all (resumable)
    python scripts/seed_top_accounts.py --limit 100     # first 100 only
    python scripts/seed_top_accounts.py --only-missing  # skip already-scored
    python scripts/seed_top_accounts.py --skip-entities # whales only, no exchanges
    python scripts/seed_top_accounts.py --dry-run       # fetch + score, no DB write
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: F401 — load .env before chain/db imports

from chains.ethereum import (
    get_eth_balance,
    get_eth_transactions,
    get_eth_token_transfers,
)
from scoring.engine import score_wallet
from db.supabase import supabase_client

SEED_FILE = Path(__file__).resolve().parent.parent / "data" / "etherscan_top_accounts.json"
TX_HISTORY_DAYS = 90
THROTTLE_SECS = 0.3  # Etherscan free tier headroom (≈3 req/s)

stats = {"processed": 0, "inserted": 0, "updated": 0, "skipped": 0, "errors": 0, "txns": 0}


def load_seed() -> list[dict]:
    with SEED_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


def already_scored_addresses() -> set[str]:
    """Addresses that already have a real score (>0) — used by --only-missing."""
    done: set[str] = set()
    try:
        page = 0
        while True:
            res = (
                supabase_client.table("wallets")
                .select("address, score")
                .eq("chain", "ethereum")
                .gt("score", 0)
                .range(page * 1000, page * 1000 + 999)
                .execute()
            )
            rows = res.data or []
            for r in rows:
                if r.get("address"):
                    done.add(r["address"].lower())
            if len(rows) < 1000:
                break
            page += 1
    except Exception:
        pass
    return done


async def seed_one(entry: dict, dry_run: bool) -> None:
    address = entry["address"]
    label = entry["label"]
    chain = entry.get("chain", "ethereum")
    is_entity = entry.get("is_infra", False)
    tags = entry.get("tags", ["ethereum"])

    # Sequential + fault-tolerant: one slow/failed call must not drop the wallet.
    # Single-page recent fetch (no deep pagination) keeps us under Etherscan's
    # rate limit and is plenty for recency/activity/DeFi signals.
    async def _safe(coro, default):
        try:
            return await coro
        except Exception:
            return default

    txns = await _safe(get_eth_transactions(address, limit=100), [])
    await asyncio.sleep(0.2)
    tokens = await _safe(get_eth_token_transfers(address, limit=40), [])
    await asyncio.sleep(0.2)
    balance = await _safe(get_eth_balance(address), 0.0)

    if not txns and balance == 0.0:
        stats["errors"] += 1
        print(f"  ✗ {label[:26]:26} no data returned (rate limit or inactive)")
        return

    combined = (txns or []) + (tokens or [])
    score_result = score_wallet(
        combined, balance, chain, address=address, label=label, known_entity=is_entity
    )
    score = score_result["score"]
    grade = score_result["grade"]

    tag = "ENTITY" if is_entity else "whale "
    print(f"  • {label[:26]:26} {tag} score={score:>3}({grade}) "
          f"bal={balance:>10,.0f} txns={len(txns or []):>4} tokens={len(tokens or [])}")

    if dry_run:
        stats["processed"] += 1
        return

    record = {
        "address": address,
        "label": label,
        "chain": chain,
        "tags": tags,
        "score": score,
        "score_breakdown": score_result.get("breakdown", {}),
        "balance": balance,
        "last_scanned": datetime.now(timezone.utc).isoformat(),
    }

    try:
        existing = supabase_client.table("wallets").select("id").eq("address", address).execute()
        if existing.data:
            wallet_id = existing.data[0]["id"]
            supabase_client.table("wallets").update(record).eq("address", address).execute()
            stats["updated"] += 1
        else:
            inserted = supabase_client.table("wallets").insert(record).execute()
            wallet_id = inserted.data[0]["id"]
            stats["inserted"] += 1
    except Exception as e:
        stats["errors"] += 1
        print(f"  ✗ {label[:26]:26} DB upsert error: {str(e)[:50]}")
        return

    # Store normal ETH transactions (not token transfers) for the YTD chart + feeds.
    if txns:
        records = []
        seen: set[str] = set()
        for tx in txns:
            h = tx.get("hash", "")
            if not h or h in seen:
                continue
            seen.add(h)
            records.append({
                "wallet_id": wallet_id,
                "hash": h,
                "chain": chain,
                "timestamp": tx.get("timestamp"),
                "value": tx.get("value", 0),
                "value_symbol": tx.get("value_symbol", "ETH"),
                "direction": tx.get("direction", "unknown"),
                "status": tx.get("status", "unknown"),
                "raw_data": tx,
            })
        for i in range(0, len(records), 100):
            try:
                supabase_client.table("transactions").upsert(
                    records[i:i + 100], on_conflict="hash", ignore_duplicates=True
                ).execute()
            except Exception:
                pass
        stats["txns"] += len(records)

    stats["processed"] += 1


async def run(limit: int, only_missing: bool, skip_entities: bool, dry_run: bool, start: int):
    seed = load_seed()
    if skip_entities:
        seed = [e for e in seed if not e.get("is_infra")]
    seed = seed[start:]
    if limit:
        seed = seed[:limit]

    skip_set: set[str] = already_scored_addresses() if only_missing else set()

    print("=" * 70)
    print("  SENTINEL AI — BULK SEED (Etherscan top accounts → v4 alpha scoring)")
    print(f"  Mode: {'DRY RUN' if dry_run else 'LIVE'} | Queued: {len(seed)} | "
          f"Already scored (skipping): {len(skip_set)}")
    print("=" * 70)

    for i, entry in enumerate(seed, 1):
        if only_missing and entry["address"].lower() in skip_set:
            stats["skipped"] += 1
            continue
        await seed_one(entry, dry_run)
        if i % 25 == 0:
            print(f"  … {i}/{len(seed)} processed "
                  f"(ins={stats['inserted']} upd={stats['updated']} err={stats['errors']})")
        await asyncio.sleep(THROTTLE_SECS)

    print("\n" + "=" * 70)
    print("  SEED COMPLETE")
    print("=" * 70)
    print(f"  Processed:   {stats['processed']}")
    print(f"  Inserted:    {stats['inserted']}")
    print(f"  Updated:     {stats['updated']}")
    print(f"  Skipped:     {stats['skipped']}")
    print(f"  Txns stored: {stats['txns']:,}")
    print(f"  Errors:      {stats['errors']}")
    print()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Bulk-seed Sentinel from Etherscan top accounts")
    p.add_argument("--limit", type=int, default=0, help="Only process first N (after --start)")
    p.add_argument("--start", type=int, default=0, help="Skip the first N seed entries")
    p.add_argument("--only-missing", action="store_true", help="Skip addresses already scored")
    p.add_argument("--skip-entities", action="store_true", help="Whales only, skip exchanges/contracts")
    p.add_argument("--dry-run", action="store_true", help="Fetch + score but don't write to DB")
    args = p.parse_args()

    asyncio.run(run(args.limit, args.only_missing, args.skip_entities, args.dry_run, args.start))
