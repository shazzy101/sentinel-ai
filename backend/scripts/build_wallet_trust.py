#!/usr/bin/env python3
"""
Sentinel AI — Ledger-Derived Wallet Trust List
================================================
Turns our own field-test data (the detected_moves win-ledger) into a trust
list that anchors the picks feed on wallets we have PROVEN, not just wallets
an external ranker scored well.

  • WHITELIST — proven winners: a real sample of decisive outcomes, net-positive
    hypothetical P&L, and a win rate clearly above a coin-flip. These get a
    score boost in the picks engine and rank first.
  • BLACKLIST — proven losers: enough decisive outcomes to be sure, and they
    bled money. Hard-excluded from the picks feed.
  • Everything else stays UNTESTED/neutral so we keep collecting data — wallets
    graduate onto the whitelist as they earn their sample.

Re-run any time the ledger grows; the lists expand toward a real top-20 on
their own. Evidence-based, NOT tuned to a target.

Usage:  python scripts/build_wallet_trust.py
Output: backend/data/wallet_trust.json
"""
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Gates — the thresholds that decide "proven". Conservative on purpose.
WHITELIST_MIN_DECISIVE = 20     # need a real sample, not a hot streak
WHITELIST_MIN_WIN_RATE = 52.0   # clearly above a coin flip
WHITELIST_MIN_NET_PNL = 0.0     # must have actually made money
BLACKLIST_MIN_DECISIVE = 12     # enough to be sure it's not variance
BLACKLIST_MAX_NET_PNL = -200.0  # and it bled real money

OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "wallet_trust.json"


def _fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fetch_ledger(sb):
    rows, step, off = [], 1000, 0
    cols = (
        "trader_address,trader_label,trader_rank,outcome_status,"
        "hypothetical_pnl_usd"
    )
    while True:
        res = sb.table("detected_moves").select(cols).range(off, off + step - 1).execute()
        batch = res.data or []
        rows += batch
        if len(batch) < step:
            break
        off += step
    return rows


def aggregate(rows):
    g = defaultdict(lambda: {"label": None, "rank": None, "w": 0, "l": 0, "pnl": 0.0})
    for r in rows:
        addr = (r.get("trader_address") or "").lower()
        if not addr:
            continue
        d = g[addr]
        d["label"] = r.get("trader_label") or d["label"]
        d["rank"] = r.get("trader_rank") if r.get("trader_rank") is not None else d["rank"]
        st = r.get("outcome_status")
        if st == "WIN":
            d["w"] += 1
        elif st == "LOSS":
            d["l"] += 1
        elif st not in ("NEUTRAL",):
            continue  # PENDING / None — not scored yet
        # Net P&L counts every resolved move (win, loss, neutral) like the page.
        if st in ("WIN", "LOSS", "NEUTRAL"):
            d["pnl"] += _fnum(r.get("hypothetical_pnl_usd")) or 0.0
    return g


def classify(g):
    whitelist, blacklist = [], []
    for addr, d in g.items():
        decisive = d["w"] + d["l"]
        if decisive == 0:
            continue
        win_rate = round(d["w"] / decisive * 100, 1)
        net = round(d["pnl"], 2)
        entry = {
            "address": addr,
            "rank": d["rank"],
            "label": d["label"],
            "win_rate_pct": win_rate,
            "decisive": decisive,
            "net_pnl_usd": net,
            "pnl_per_move": round(d["pnl"] / decisive, 1),
        }
        if (decisive >= WHITELIST_MIN_DECISIVE
                and win_rate >= WHITELIST_MIN_WIN_RATE
                and net > WHITELIST_MIN_NET_PNL):
            whitelist.append(entry)
        elif decisive >= BLACKLIST_MIN_DECISIVE and net < BLACKLIST_MAX_NET_PNL:
            blacklist.append(entry)
    whitelist.sort(key=lambda e: -e["net_pnl_usd"])
    blacklist.sort(key=lambda e: e["net_pnl_usd"])
    return whitelist, blacklist


def main():
    load_dotenv()
    from supabase import create_client

    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    rows = fetch_ledger(sb)
    g = aggregate(rows)
    whitelist, blacklist = classify(g)

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "detected_moves win-ledger (field-tested)",
        "criteria": {
            "whitelist": f">={WHITELIST_MIN_DECISIVE} decisive, win% >= {WHITELIST_MIN_WIN_RATE}, net P&L > ${WHITELIST_MIN_NET_PNL:.0f}",
            "blacklist": f">={BLACKLIST_MIN_DECISIVE} decisive, net P&L < ${BLACKLIST_MAX_NET_PNL:.0f}",
        },
        "wallets_with_data": sum(1 for d in g.values() if d["w"] + d["l"] > 0),
        "whitelist": whitelist,
        "blacklist": blacklist,
    }
    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT_PATH}")
    print(f"  wallets with decisive data: {out['wallets_with_data']}")
    print(f"  whitelist (proven winners): {len(whitelist)}")
    for e in whitelist:
        print(f"    #{e['rank']:<4} {e['win_rate_pct']:>5}% n={e['decisive']:<4} +${e['net_pnl_usd']:>7.0f}  {e['address']}")
    print(f"  blacklist (proven losers):  {len(blacklist)}")
    for e in blacklist:
        print(f"    #{e['rank']:<4} {e['win_rate_pct']:>5}% n={e['decisive']:<4} ${e['net_pnl_usd']:>8.0f}  {e['address']}")


if __name__ == "__main__":
    main()
