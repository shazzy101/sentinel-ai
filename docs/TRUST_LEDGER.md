# Hadaleum Trust Ledger

**Live public page:** https://hadaleum.com/wins  
**API:** `GET /api/trust-pulse/marketing`  
**Last updated:** 2026-06-11 (initial ingest)

---

## What this tracks

Every row in `detected_moves` is an **on-chain swap** Hadaleum detected from a ranked Ethereum copy trader at the moment it happened. Each move is scored **24 hours later** using CoinGecko prices:

| Outcome | Rule |
|---------|------|
| **WIN** | Token moved ≥3% in the trader's favor |
| **LOSS** | Token moved ≤−3% against |
| **NEUTRAL** | Between −3% and +3% |

Hypothetical P&L assumes a **$1,000 copy** per move.

---

## Current snapshot

| Metric | Value |
|--------|-------|
| Total detections (ledger) | **50** |
| Pending 24h score | **50** |
| Verified wins (24h) | 0 *(scores unlock ~24h after each detection)* |
| Copy traders synced | 2,796 |
| Pipeline status | ✅ Running (cron every 30 min + boot ingest) |

### First ingest (2026-06-11)

- **50 on-chain swaps** logged from top-ranked DEX traders via Etherscan
- Moves include real tx hashes — verifiable on Etherscan
- Scoring begins automatically when each move is 24h old

---

## Marketing copy (auto-generated when wins land)

Use the **Copy for pitch** button on [/wins](https://hadaleum.com/wins), or:

```bash
curl -s https://backend-production-250bf.up.railway.app/api/trust-pulse/marketing | jq .data.headline
```

Example once wins score:

> *Hadaleum detected 12 winning copy-trader moves in the last 24 hours, averaging +8.3% per win — $1,000 copies would have returned +$9,960 hypothetically.*

Tweet hooks are included in the marketing API response.

---

## Ops

```bash
# Manual pipeline (local — uses backend/.env)
cd backend && python3 scripts/run_trust_pipeline.py

# Manual pipeline (production — needs Railway ADMIN_API_KEY)
curl -X POST https://backend-production-250bf.up.railway.app/api/admin/run-trust-pipeline \
  -H "X-Admin-Key: YOUR_KEY"

# Watch pending moves trending toward WIN
curl -s https://backend-production-250bf.up.railway.app/api/trust-pulse/pending | jq '.data.on_track_count'
```

---

## Timeline for customer demos

| When | What to show |
|------|----------------|
| **Now** | `/wins` — "50 moves detected, scoring in progress" + Etherscan proof |
| **+24h** | First verified WIN badges with % return and hypo P&L |
| **+3–4 days** | Strong headline stats for pitches, X posts, and sales calls |

---

*This file is updated after major pipeline runs. All stats are derived from the `detected_moves` Supabase table — not fabricated.*
