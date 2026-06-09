"""
Sentinel AI — Wallet Ingestion Pipeline
Run once to seed your Supabase DB with all tracked wallets + 90 days of tx history.

Usage:
    python scripts/ingest_wallets.py
    python scripts/ingest_wallets.py --wallet "Paradigm Fund"   # single wallet
    python scripts/ingest_wallets.py --dry-run                  # print only, no DB writes
"""

import asyncio
import argparse
import sys
import os
import json
import time
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: F401 — load .env before chain/db imports

from datetime import datetime, timezone

from chains.ethereum import get_eth_balance, get_eth_transactions_since
from scoring.engine import score_wallet
from db.supabase import supabase_client
from data.wallets import SMART_MONEY_WALLETS

DEBUG_LOG_PATH = "/Users/shazaibamlani/Sentinel/.cursor/debug-10b0bc.log"
TX_HISTORY_DAYS = 90

# Use verified smart money wallets — convert to standard format
SEED_WALLETS = [
    {
        "label": w["label"],
        "address": w["address"],
        "chain": "ethereum",
        "tags": w.get("tags", ["ethereum", "smart-money"]),
    }
    for w in SMART_MONEY_WALLETS
]

stats = {
    "wallets_processed": 0,
    "wallets_inserted": 0,
    "wallets_updated": 0,
    "transactions_inserted": 0,
    "errors": [],
}


def fetch_existing_tx_hashes(tx_hashes: list[str], chunk_size: int = 250) -> set[str]:
    """Query existing transaction hashes in chunks to avoid URL length limits."""
    existing_hashes: set[str] = set()
    for i in range(0, len(tx_hashes), chunk_size):
        chunk = tx_hashes[i:i + chunk_size]
        if not chunk:
            continue
        existing_result = (
            supabase_client.table("transactions")
            .select("hash")
            .in_("hash", chunk)
            .execute()
        )
        existing_hashes.update(row["hash"] for row in (existing_result.data or []))
    return existing_hashes


def _debug_log(location: str, message: str, data: dict, hypothesis_id: str):
    # #region agent log
    try:
        payload = {
            "sessionId": "10b0bc",
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
            "hypothesisId": hypothesis_id,
        }
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
    # #endregion


async def ingest_wallet(wallet: dict, dry_run: bool = False) -> dict:
    """
    Full pipeline for one wallet:
    1. Fetch balance
    2. Fetch transactions (90-day history via pagination)
    3. Score wallet
    4. Upsert wallet record to DB
    5. Insert new transactions to DB
    """
    label = wallet["label"]
    address = wallet["address"]
    chain = wallet["chain"]

    print(f"\n  {'[DRY RUN] ' if dry_run else ''}Processing: {label}")
    print(f"  Chain: {chain.upper()} | {address[:14]}...{address[-6:]}")

    result = {"wallet": label, "success": False, "tx_count": 0, "score": 0}

    # #region agent log
    _debug_log(
        "ingest_wallets.py:ingest_wallet:entry",
        "Starting wallet ingest",
        {"label": label, "address_prefix": address[:10], "dry_run": dry_run, "has_api_key": bool(os.getenv("ETHERSCAN_API_KEY"))},
        "A",
    )
    # #endregion

    try:
        balance, transactions = await asyncio.gather(
            get_eth_balance(address),
            get_eth_transactions_since(address, days=TX_HISTORY_DAYS),
        )

        print(f"  Balance: {balance:,.4f} ETH")
        print(f"  Transactions fetched ({TX_HISTORY_DAYS}d): {len(transactions)}")

        if balance == 0.0 and not transactions:
            msg = f"{label}: no balance or transactions returned from Etherscan"
            stats["errors"].append(msg)
            print(f"  WARNING: {msg}")
            result["error"] = msg
            # #region agent log
            _debug_log(
                "ingest_wallets.py:ingest_wallet:empty",
                "Wallet returned no on-chain data",
                {"label": label, "address_prefix": address[:10]},
                "C",
            )
            # #endregion
            return result

        score_result = score_wallet(transactions, balance, chain)
        score = score_result["score"]
        print(f"  Score: {score}/100 (Grade {score_result['grade']})")

        # #region agent log
        _debug_log(
            "ingest_wallets.py:ingest_wallet:fetched",
            "Wallet data fetched",
            {"label": label, "balance": balance, "tx_count": len(transactions), "score": score},
            "C",
        )
        # #endregion

        if dry_run:
            result.update({"success": True, "tx_count": len(transactions), "score": score})
            return result

        wallet_record = {
            "address": address,
            "label": label,
            "chain": chain,
            "tags": wallet.get("tags", []),
            "score": score,
            "score_breakdown": score_result.get("breakdown", {}),
            "balance": balance,
            "last_scanned": datetime.now(timezone.utc).isoformat(),
        }

        existing = supabase_client.table("wallets").select("id").eq("address", address).execute()

        if existing.data:
            wallet_id = existing.data[0]["id"]
            supabase_client.table("wallets").update(wallet_record).eq("address", address).execute()
            stats["wallets_updated"] += 1
            print(f"  DB: Updated existing wallet (id: {wallet_id[:8]}...)")
        else:
            inserted = supabase_client.table("wallets").insert(wallet_record).execute()
            wallet_id = inserted.data[0]["id"]
            stats["wallets_inserted"] += 1
            print(f"  DB: Inserted new wallet (id: {wallet_id[:8]}...)")

        tx_records = []
        if transactions:
            tx_hashes = [tx.get("hash") for tx in transactions if tx.get("hash")]
            existing_hashes: set[str] = set()

            if tx_hashes:
                existing_hashes = fetch_existing_tx_hashes(tx_hashes)

            seen_hashes: set[str] = set()
            for tx in transactions:
                tx_hash = tx.get("hash", "")
                if not tx_hash or tx_hash in existing_hashes or tx_hash in seen_hashes:
                    continue
                seen_hashes.add(tx_hash)
                tx_records.append({
                    "wallet_id": wallet_id,
                    "hash": tx_hash,
                    "chain": chain,
                    "timestamp": tx.get("timestamp"),
                    "value": tx.get("value", tx.get("fee", 0)),
                    "value_symbol": tx.get("value_symbol", tx.get("fee_symbol", "?")),
                    "direction": tx.get("direction", "unknown"),
                    "status": tx.get("status", "unknown"),
                    "raw_data": tx,
                })

            if tx_records:
                batch_size = 100
                for i in range(0, len(tx_records), batch_size):
                    batch = tx_records[i:i + batch_size]
                    supabase_client.table("transactions").upsert(
                        batch, on_conflict="hash", ignore_duplicates=True
                    ).execute()
                stats["transactions_inserted"] += len(tx_records)
                print(f"  DB: Inserted {len(tx_records)} new transactions")
            else:
                print(f"  DB: All {len(transactions)} transactions already in DB")

        # #region agent log
        _debug_log(
            "ingest_wallets.py:ingest_wallet:complete",
            "Wallet ingest complete",
            {
                "label": label,
                "tx_stored": len(tx_records) if transactions else 0,
                "success": True,
            },
            "E",
        )
        # #endregion

        result.update({"success": True, "tx_count": len(transactions), "score": score})
        stats["wallets_processed"] += 1

    except Exception as e:
        error_msg = f"{label}: {str(e)}"
        stats["errors"].append(error_msg)
        print(f"  ERROR: {e}")
        result["error"] = str(e)
        # #region agent log
        _debug_log(
            "ingest_wallets.py:ingest_wallet:error",
            "Wallet ingest failed",
            {"label": label, "error": str(e)},
            "E",
        )
        # #endregion

    return result


async def run_ingestion(target_label: str = None, dry_run: bool = False):
    print("=" * 60)
    print("  SENTINEL AI — WALLET INGESTION PIPELINE")
    print(f"  Mode: {'DRY RUN (no DB writes)' if dry_run else 'LIVE'}")
    print(f"  Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"  Tx history window: {TX_HISTORY_DAYS} days")
    print("=" * 60)

    wallets_to_process = SEED_WALLETS
    if target_label:
        wallets_to_process = [w for w in SEED_WALLETS if w["label"].lower() == target_label.lower()]
        if not wallets_to_process:
            print(f"\nNo wallet found with label: '{target_label}'")
            print(f"Available: {[w['label'] for w in SEED_WALLETS]}")
            return

    print(f"\nQueued: {len(wallets_to_process)} Ethereum wallet(s)")

    results = []
    print(f"\n── ETHEREUM ───────────────────────────────")
    for wallet in wallets_to_process:
        result = await ingest_wallet(wallet, dry_run=dry_run)
        results.append(result)
        await asyncio.sleep(0.5)

    print(f"\n{'=' * 60}")
    print(f"  INGESTION COMPLETE")
    print(f"{'=' * 60}")
    if not dry_run:
        print(f"  Wallets inserted:     {stats['wallets_inserted']}")
        print(f"  Wallets updated:      {stats['wallets_updated']}")
        print(f"  Transactions stored:  {stats['transactions_inserted']}")
    print(f"  Successful:           {sum(1 for r in results if r.get('success'))}/{len(results)}")

    if stats["errors"]:
        print(f"\n  Warnings/Errors ({len(stats['errors'])}):")
        for e in stats["errors"]:
            print(f"    - {e}")

    print()
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sentinel wallet ingestion pipeline")
    parser.add_argument("--wallet", type=str, help="Ingest a single wallet by label")
    parser.add_argument("--limit", type=int, default=0, help="Only ingest first N wallets from seed list")
    parser.add_argument("--tx-days", type=int, default=90, help="How many days of tx history to ingest")
    parser.add_argument("--dry-run", action="store_true", help="Fetch data but don't write to DB")
    args = parser.parse_args()

    TX_HISTORY_DAYS = max(1, args.tx_days)
    if args.limit and args.limit > 0:
        SEED_WALLETS[:] = SEED_WALLETS[:args.limit]

    asyncio.run(run_ingestion(target_label=args.wallet, dry_run=args.dry_run))
