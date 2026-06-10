#!/usr/bin/env python3
"""
Sentinel AI — Dune Analytics Wallet Fetcher
=============================================
Queries Dune's dex.trades spellbook to find the top Ethereum DEX traders
with the best copy-trading signals, then merges them into your existing
copy_trading_candidates files.

Run from your terminal (NOT the Cowork sandbox — needs direct internet access):

    cd /path/to/Sentinel/backend
    pip install requests python-dotenv
    python3 scripts/dune_wallet_fetch.py

What it does:
  1. Creates a Dune query via API targeting dex.trades (Ethereum, 180-day window)
  2. Executes the query and polls until complete (~30–90 seconds)
  3. Downloads up to 10,000 wallet addresses with on-chain trading stats
  4. Merges with existing copy_trading_candidates.json (deduplicates)
  5. Re-ranks everything and writes fresh CSV + JSON to backend/data/

SQL targets wallets with:
  • 30+ trades in the last 180 days
  • 90+ day track record (first → last trade)
  • 20+ distinct active trading days
  • $500–$500k per trade (filters dust and whale/arb outliers)
  • Ranked by trades/day × log(avg_trade_usd) — active consistent traders first
"""

import json
import os
import sys
import time
import csv
import math
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests -q")
    import requests

try:
    from dotenv import load_dotenv
except ImportError:
    os.system(f"{sys.executable} -m pip install python-dotenv -q")
    from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────

BASE_DIR  = Path(__file__).resolve().parent.parent
DATA_DIR  = BASE_DIR / "data"
ENV_FILE  = BASE_DIR / ".env"

load_dotenv(ENV_FILE)
DUNE_API_KEY = os.getenv("DUNE_API_KEY")

DUNE_BASE    = "https://api.dune.com/api/v1"
HEADERS      = {"x-dune-api-key": DUNE_API_KEY, "Content-Type": "application/json"}

POLL_INTERVAL = 5    # seconds between status checks
MAX_POLLS     = 60   # give up after 5 minutes
RESULT_LIMIT  = 10000

# ── The SQL query ─────────────────────────────────────────────────────────────

DUNE_SQL = """
WITH activity AS (
  SELECT
    taker AS trader,
    COUNT(*) AS total_trades,
    ROUND(SUM(amount_usd), 2) AS total_volume_usd,
    ROUND(AVG(amount_usd), 2) AS avg_trade_usd,
    ROUND(approx_percentile(amount_usd, 0.5), 2) AS median_trade_usd,
    MIN(block_time) AS first_trade,
    MAX(block_time) AS last_trade,
    date_diff('day', MIN(block_time), MAX(block_time)) AS track_record_days,
    COUNT(DISTINCT DATE_TRUNC('day', block_time)) AS active_days,
    COUNT(DISTINCT token_bought_address) AS tokens_bought,
    COUNT(DISTINCT token_sold_address) AS tokens_sold,
    COUNT(DISTINCT project) AS dex_count
  FROM dex.trades
  WHERE blockchain = 'ethereum'
    AND block_time >= NOW() - INTERVAL '180' DAY
    AND amount_usd >= 500
    AND amount_usd <= 500000
    AND taker IS NOT NULL
    AND taker != from_hex('0000000000000000000000000000000000000000')
  GROUP BY taker
  HAVING COUNT(*) >= 30
    AND date_diff('day', MIN(block_time), MAX(block_time)) >= 90
    AND COUNT(DISTINCT DATE_TRUNC('day', block_time)) >= 20
),
buys AS (
  SELECT
    d.taker AS trader,
    d.token_bought_address AS token,
    ROUND(AVG(d.amount_usd), 2) AS avg_buy_usd
  FROM dex.trades d
  INNER JOIN activity a ON d.taker = a.trader
  WHERE d.blockchain = 'ethereum'
    AND d.block_time >= NOW() - INTERVAL '180' DAY
    AND d.amount_usd >= 500
  GROUP BY d.taker, d.token_bought_address
),
sells AS (
  SELECT
    d.taker AS trader,
    d.token_sold_address AS token,
    ROUND(AVG(d.amount_usd), 2) AS avg_sell_usd
  FROM dex.trades d
  INNER JOIN activity a ON d.taker = a.trader
  WHERE d.blockchain = 'ethereum'
    AND d.block_time >= NOW() - INTERVAL '180' DAY
    AND d.amount_usd >= 500
  GROUP BY d.taker, d.token_sold_address
),
win_stats AS (
  SELECT
    b.trader,
    COUNT(*) AS matched_pairs,
    SUM(CASE WHEN s.avg_sell_usd > b.avg_buy_usd THEN 1 ELSE 0 END) AS wins,
    ROUND(
      CAST(SUM(CASE WHEN s.avg_sell_usd > b.avg_buy_usd THEN 1 ELSE 0 END) AS DOUBLE)
      / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate_pct,
    ROUND(
      SUM(CASE WHEN s.avg_sell_usd > b.avg_buy_usd THEN s.avg_sell_usd - b.avg_buy_usd ELSE 0 END) /
      NULLIF(SUM(CASE WHEN s.avg_sell_usd <= b.avg_buy_usd THEN b.avg_buy_usd - s.avg_sell_usd ELSE 0 END), 0)
    , 2) AS profit_factor
  FROM buys b
  INNER JOIN sells s ON b.trader = s.trader AND b.token = s.token
  GROUP BY b.trader
  HAVING COUNT(*) >= 3
)
SELECT
  CAST(a.trader AS VARCHAR) AS trader,
  a.total_trades,
  a.total_volume_usd,
  a.avg_trade_usd,
  a.median_trade_usd,
  a.first_trade,
  a.last_trade,
  a.track_record_days,
  a.active_days,
  a.tokens_bought,
  a.tokens_sold,
  a.dex_count,
  w.win_rate_pct,
  w.profit_factor,
  COALESCE(w.matched_pairs, 0) AS matched_token_pairs
FROM activity a
LEFT JOIN win_stats w ON a.trader = w.trader
ORDER BY
  a.total_trades DESC,
  COALESCE(w.win_rate_pct, 0) DESC
LIMIT 10000
"""

# ── Dune API helpers ──────────────────────────────────────────────────────────

def create_query() -> int:
    """Create a new Dune query and return its query_id."""
    resp = requests.post(
        f"{DUNE_BASE}/query",
        headers=HEADERS,
        json={
            "name":        "Sentinel AI — Top Copy Trading Wallets",
            "description": "Top Ethereum DEX traders ranked by activity, track record, and win rate proxy.",
            "query_sql":   DUNE_SQL,
            "is_private":  False,
        },
        timeout=30,
    )
    resp.raise_for_status()
    query_id = resp.json()["query_id"]
    print(f"  ✓ Query created: https://dune.com/queries/{query_id}")
    return query_id


def execute_query(query_id: int) -> str:
    """Trigger query execution. Returns execution_id."""
    resp = requests.post(
        f"{DUNE_BASE}/query/{query_id}/execute",
        headers=HEADERS,
        json={},   # no performance param — use account default
        timeout=30,
    )
    if not resp.ok:
        print(f"  ✗ HTTP {resp.status_code}: {resp.text}")
        resp.raise_for_status()
    execution_id = resp.json()["execution_id"]
    print(f"  ✓ Execution started: {execution_id}")
    return execution_id


def poll_execution(execution_id: str) -> bool:
    """Poll until query finishes. Returns True on success."""
    for i in range(MAX_POLLS):
        resp = requests.get(
            f"{DUNE_BASE}/execution/{execution_id}/status",
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        state = resp.json().get("state", "")
        elapsed = (i + 1) * POLL_INTERVAL

        if state == "QUERY_STATE_COMPLETED":
            print(f"  ✓ Query completed in {elapsed}s")
            return True
        elif state in ("QUERY_STATE_FAILED", "QUERY_STATE_CANCELLED"):
            status_data = resp.json()
            err = status_data.get("error") or status_data.get("result", {})
            print(f"  ✗ Query {state} after {elapsed}s")
            print(f"  Error details: {json.dumps(err, indent=2)}")
            return False
        else:
            print(f"  … {state} ({elapsed}s elapsed)", end="\r")
            time.sleep(POLL_INTERVAL)

    print("\n  ✗ Timed out waiting for query")
    return False


def fetch_results(execution_id: str) -> list[dict]:
    """Download all result rows (paginates automatically)."""
    rows = []
    offset = 0
    limit  = 1000

    while True:
        resp = requests.get(
            f"{DUNE_BASE}/execution/{execution_id}/results",
            headers=HEADERS,
            params={"limit": limit, "offset": offset},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        page = data.get("result", {}).get("rows", [])
        rows.extend(page)

        total = data.get("result", {}).get("metadata", {}).get("total_row_count", 0)
        offset += len(page)
        print(f"  Downloaded {offset}/{total} rows…", end="\r")

        if len(page) < limit or offset >= RESULT_LIMIT:
            break

    print(f"\n  ✓ Downloaded {len(rows)} rows")
    return rows


# ── Scoring ───────────────────────────────────────────────────────────────────

def score_dune_row(row: dict) -> float:
    """
    Composite copy-trading score from Dune metrics (0–100).
    Mirrors the 5-metric weighting from the user's requirements.
    """
    win_rate      = float(row.get("win_rate_pct")  or 50)   # default neutral if missing
    profit_factor = float(row.get("profit_factor") or 1.0)
    track_days    = float(row.get("track_record_days") or 0)
    total_trades  = float(row.get("total_trades") or 0)
    avg_usd       = float(row.get("avg_trade_usd") or 0)
    active_days   = float(row.get("active_days") or 0)

    # Win rate (0–30 pts)
    wr_score = min(win_rate / 100 * 30, 30)

    # Profit factor (0–30 pts, log-scaled)
    pf_score = min(math.log1p(profit_factor) / math.log1p(5) * 30, 30)

    # Track record (0–15 pts)
    tr_score = min(math.log1p(track_days) / math.log1p(180) * 15, 15)

    # Activity consistency: trades per active day (0–15 pts)
    tpd = total_trades / max(active_days, 1)
    act_score = min(math.log1p(tpd) / math.log1p(10) * 15, 15)

    # Trade size — moderate sizes are best for copy trading (0–10 pts)
    # Sweet spot: $1k–$50k avg trade
    if 1000 <= avg_usd <= 50000:
        size_score = 10
    elif 500 <= avg_usd < 1000 or 50000 < avg_usd <= 200000:
        size_score = 6
    else:
        size_score = 2

    return round(wr_score + pf_score + tr_score + act_score + size_score, 1)


# ── Merge with existing candidates ───────────────────────────────────────────

def load_existing() -> dict:
    path = DATA_DIR / "copy_trading_candidates.json"
    if not path.exists():
        return {}
    with open(path) as f:
        data = json.load(f)
    return {w["address"].lower(): w for w in data}


def format_dune_wallet(row: dict, rank: int, score: float) -> dict:
    trader = (row.get("trader") or "").lower()
    win_rate = row.get("win_rate_pct")
    pf       = row.get("profit_factor")
    return {
        "address":          trader,
        "label":            f"Dune DEX Trader #{rank}",
        "chain":            "ethereum",
        "tags":             ["ethereum", "copy-trading", "dex-trader", "smart-money"],
        "copy_trading_rank": rank,
        "proxy_score":      score,
        "wallet_type":      "DEX Trader",
        "trading_signal":   "Active Trader",
        "source":           "dune_dex_trades",
        "on_chain_data": {
            "txn_count":         int(row.get("total_trades") or 0),
            "balance_eth":       None,
            "est_track_record":  f"{row.get('track_record_days', '?')} days",
            "total_volume_usd":  row.get("total_volume_usd"),
            "avg_trade_usd":     row.get("avg_trade_usd"),
            "active_days":       row.get("active_days"),
            "tokens_traded":     row.get("tokens_bought"),
            "dex_count":         row.get("dex_count"),
            "first_trade":       str(row.get("first_trade") or ""),
            "last_trade":        str(row.get("last_trade") or ""),
        },
        "metrics_status": "partial",
        "metrics": {
            "win_rate":               win_rate,
            "profit_factor":          pf,
            "max_drawdown_pct":       None,   # needs copy_trading_ranker.py
            "avg_trade_duration_hrs": None,   # needs copy_trading_ranker.py
            "track_record_days":      row.get("track_record_days"),
        },
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Sentinel AI — Dune Wallet Fetcher")
    print("=" * 60)

    if not DUNE_API_KEY:
        print("✗ DUNE_API_KEY not found in .env")
        sys.exit(1)

    # Step 1: Create query (SQL was updated — creating fresh query)
    # Once this runs successfully, paste the returned query_id here to reuse it next time.
    EXISTING_QUERY_ID = 7686456  # created 2026-06-09 — reuse to skip recreation
    print("\n[1/5] Creating Dune query…")
    query_id = EXISTING_QUERY_ID if EXISTING_QUERY_ID else create_query()

    # Step 2: Execute
    print("\n[2/5] Executing query (this takes ~30–90 seconds)…")
    execution_id = execute_query(query_id)

    # Step 3: Poll
    print("\n[3/5] Waiting for results…")
    if not poll_execution(execution_id):
        print("✗ Query did not complete successfully.")
        sys.exit(1)

    # Step 4: Download results
    print("\n[4/5] Downloading results…")
    rows = fetch_results(execution_id)
    if not rows:
        print("✗ No rows returned.")
        sys.exit(1)

    # Step 5: Score, merge, output
    print("\n[5/5] Scoring and merging with existing candidates…")
    existing = load_existing()
    print(f"  Existing candidates: {len(existing)}")

    new_wallets = {}
    for row in rows:
        addr = (row.get("trader") or "").lower()
        if not addr or len(addr) != 42:
            continue
        score = score_dune_row(row)
        new_wallets[addr] = (score, row)

    print(f"  New from Dune: {len(new_wallets)}")

    # Merge: Dune data takes precedence for new addresses;
    # existing addresses keep their data but get score updated
    merged = dict(existing)
    added  = 0
    for addr, (score, row) in new_wallets.items():
        if addr not in merged:
            merged[addr] = format_dune_wallet(row, 0, score)
            added += 1
        else:
            # Enrich existing entry with Dune metrics if it has none
            existing_entry = merged[addr]
            if existing_entry.get("metrics", {}).get("win_rate") is None:
                existing_entry["metrics"]["win_rate"]       = row.get("win_rate_pct")
                existing_entry["metrics"]["profit_factor"]  = row.get("profit_factor")
                existing_entry["metrics"]["track_record_days"] = row.get("track_record_days")
                existing_entry["source"]                   = "dune_dex_trades+existing"
            existing_entry["proxy_score"] = max(
                existing_entry.get("proxy_score", 0), score
            )

    print(f"  Added {added} new addresses | Total pool: {len(merged)}")

    # Re-rank by score
    all_wallets = list(merged.values())
    all_wallets.sort(key=lambda w: w.get("proxy_score", 0), reverse=True)
    for i, w in enumerate(all_wallets, 1):
        w["copy_trading_rank"] = i

    # Write JSON
    json_path = DATA_DIR / "copy_trading_candidates.json"
    with open(json_path, "w") as f:
        json.dump(all_wallets, f, indent=2)
    print(f"\n  ✓ JSON: {json_path} ({len(all_wallets)} wallets)")

    # Write CSV
    csv_path = DATA_DIR / "copy_trading_candidates.csv"
    fieldnames = [
        "rank", "address", "label", "proxy_score", "wallet_type", "trading_signal",
        "win_rate_pct", "profit_factor", "track_record_days",
        "txn_count", "total_volume_usd", "avg_trade_usd", "active_days",
        "tokens_traded", "dex_count", "source",
    ]
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for w in all_wallets:
            od  = w.get("on_chain_data") or {}
            met = w.get("metrics") or {}
            writer.writerow({
                "rank":              w.get("copy_trading_rank", ""),
                "address":           w.get("address", ""),
                "label":             w.get("label", ""),
                "proxy_score":       w.get("proxy_score", ""),
                "wallet_type":       w.get("wallet_type", ""),
                "trading_signal":    w.get("trading_signal", ""),
                "win_rate_pct":      met.get("win_rate") or "",
                "profit_factor":     met.get("profit_factor") or "",
                "track_record_days": met.get("track_record_days") or od.get("est_track_record") or "",
                "txn_count":         od.get("txn_count") or "",
                "total_volume_usd":  od.get("total_volume_usd") or "",
                "avg_trade_usd":     od.get("avg_trade_usd") or "",
                "active_days":       od.get("active_days") or "",
                "tokens_traded":     od.get("tokens_traded") or "",
                "dex_count":         od.get("dex_count") or "",
                "source":            w.get("source", ""),
            })
    print(f"  ✓ CSV: {csv_path}")

    print(f"\n{'=' * 60}")
    print(f"Done! {len(all_wallets)} total wallets ranked.")
    print(f"\nNext step: run copy_trading_ranker.py to compute")
    print(f"Max Drawdown and Avg Trade Duration for all wallets.")
    print(f"  python3 scripts/copy_trading_ranker.py")
    print("=" * 60)

    # Preview top 10
    print("\nTop 10 preview:")
    print(f"  {'Rank':<5} {'Score':<7} {'WinRate':<10} {'ProfFactor':<12} {'TrackDays':<11} {'Trades':<8} {'Address'}")
    print(f"  {'-'*5} {'-'*7} {'-'*10} {'-'*12} {'-'*11} {'-'*8} {'-'*42}")
    for w in all_wallets[:10]:
        met = w.get("metrics") or {}
        od  = w.get("on_chain_data") or {}
        print(f"  {w['copy_trading_rank']:<5} {w.get('proxy_score',''):<7} "
              f"{str(met.get('win_rate') or '—'):<10} "
              f"{str(met.get('profit_factor') or '—'):<12} "
              f"{str(met.get('track_record_days') or od.get('est_track_record') or '—'):<11} "
              f"{str(od.get('txn_count') or '—'):<8} "
              f"{w.get('address','')}")


if __name__ == "__main__":
    main()
