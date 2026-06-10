#!/usr/bin/env python3
"""
Sync copy_trading_top_wallets.json → Supabase copy_traders table.

Usage (from repo root):
  python3 backend/scripts/sync_copy_traders_to_db.py
  python3 backend/scripts/sync_copy_traders_to_db.py --json path/to/file.json
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..")))

from copy_traders_store import sync_copy_traders_to_db, load_copy_traders, copy_traders_meta
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Sync copy traders JSON to Supabase")
    parser.add_argument(
        "--json",
        default=None,
        help="Path to copy_trading_top_wallets.json (default: backend/data/...)",
    )
    args = parser.parse_args()

    json_path = Path(args.json) if args.json else None
    print("Syncing copy traders to Supabase...")
    result = sync_copy_traders_to_db(json_path=json_path)
    meta = copy_traders_meta()
    print(f"  Synced: {result.get('synced', 0)} / {result.get('total', 0)}")
    if result.get("errors"):
        print(f"  Errors: {result['errors']}")
    print(f"  Cache source: {meta.get('source')} · count: {meta.get('count')}")
    load_copy_traders(force_refresh=True)
    print("Done.")


if __name__ == "__main__":
    main()
