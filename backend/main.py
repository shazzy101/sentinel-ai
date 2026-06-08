"""
Sentinel AI — Ethereum Smart-Money Intelligence Platform
FastAPI Backend
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
import asyncio
import os

import config  # noqa: F401 — load .env before chain/API imports
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai.analyst import analyze_wallet, get_market_summary, init_analyst
from chains.ethereum import ChainAdapterError, get_eth_balance, get_eth_transactions, get_eth_transactions_since
from db.supabase import supabase_client
from responses import error, success
from scoring.engine import score_wallet


CRON_TOP_N = 40           # 6-hour pass: top 40 by score
CRON_FULL_INTERVAL = 24   # 24-hour pass: entire list

# In-memory cron state — exposed via /api/admin/cron-status
_cron_state: dict = {
    "top_last_run": None,
    "top_next_run": None,
    "full_last_run": None,
    "full_next_run": None,
}


async def _scan_wallet_list(wallets: list[dict]) -> int:
    """Sequentially scan a list of wallet dicts. Returns count of successes."""
    ok = 0
    for w in wallets:
        try:
            await persist_wallet_scan(
                w["address"], w.get("label", ""), w.get("chain", "ethereum"), w.get("tags") or []
            )
            ok += 1
        except Exception:
            pass
    return ok


async def _cron_top():
    """Every 6 hours: rescan top-40 wallets by score."""
    await asyncio.sleep(60)  # startup grace period
    while True:
        _cron_state["top_last_run"] = datetime.now(timezone.utc).isoformat()
        next_run = datetime.now(timezone.utc).timestamp() + 6 * 3600
        _cron_state["top_next_run"] = datetime.fromtimestamp(next_run, tz=timezone.utc).isoformat()
        try:
            result = (
                supabase_client.table("wallets")
                .select("address, label, chain, tags")
                .eq("chain", "ethereum")
                .order("score", desc=True)
                .limit(CRON_TOP_N)
                .execute()
            )
            await _scan_wallet_list(result.data or [])
        except Exception:
            pass
        await asyncio.sleep(6 * 3600)


async def _cron_full():
    """Every 24 hours: rescan the entire wallet list (staggered start)."""
    await asyncio.sleep(3 * 3600)  # start 3h after server up, offset from top-40 cron
    while True:
        _cron_state["full_last_run"] = datetime.now(timezone.utc).isoformat()
        next_run = datetime.now(timezone.utc).timestamp() + CRON_FULL_INTERVAL * 3600
        _cron_state["full_next_run"] = datetime.fromtimestamp(next_run, tz=timezone.utc).isoformat()
        try:
            result = (
                supabase_client.table("wallets")
                .select("address, label, chain, tags")
                .eq("chain", "ethereum")
                .order("score", desc=True)
                .execute()  # no limit — full list
            )
            await _scan_wallet_list(result.data or [])
        except Exception:
            pass
        await asyncio.sleep(CRON_FULL_INTERVAL * 3600)


async def sync_wallet_balances(limit: int = 94) -> dict:
    """Fetch live ETH balances for wallets not yet synced (balance IS NULL)."""
    result = (
        supabase_client.table("wallets")
        .select("address, balance")
        .eq("chain", "ethereum")
        .order("score", desc=True)
        .limit(min(limit, 100))
        .execute()
    )
    updated = 0
    failed = 0
    skipped = 0
    for row in result.data or []:
        if row.get("balance") is not None and float(row["balance"]) > 0:
            skipped += 1
            continue
        try:
            bal = await get_eth_balance(row["address"])
            supabase_client.table("wallets").update({"balance": bal}).eq("address", row["address"]).execute()
            updated += 1
            await asyncio.sleep(0.25)  # Etherscan rate limit headroom
        except Exception:
            failed += 1
    return {"updated": updated, "failed": failed, "skipped": skipped}


async def _startup_balance_sync():
    """Backfill balances 30s after startup so the UI shows real ETH values."""
    await asyncio.sleep(30)
    try:
        await sync_wallet_balances(limit=94)
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_analyst()
    asyncio.create_task(_cron_top())
    asyncio.create_task(_cron_full())
    asyncio.create_task(_startup_balance_sync())
    yield


app = FastAPI(
    title="Sentinel AI",
    description="Ethereum smart-money intelligence — powered by Claude",
    version="1.0.0",
    lifespan=lifespan,
)

_CORS_ORIGINS_DEFAULT = "http://localhost:5173,http://127.0.0.1:5173"
_cors_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", _CORS_ORIGINS_DEFAULT).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.pages\.dev",  # Cloudflare Pages previews + production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────

class WalletScanRequest(BaseModel):
    address: str
    label: Optional[str] = None
    chain: Optional[str] = None


class AddWalletRequest(BaseModel):
    address: str = Field(..., min_length=10)
    label: str
    chain: str
    tags: Optional[list[str]] = []


class AskRequest(BaseModel):
    message: str
    history: list[dict] = []


# ─────────────────────────────────────────
# EXCEPTION HANDLERS
# ─────────────────────────────────────────

@app.exception_handler(ChainAdapterError)
async def chain_adapter_error_handler(_request: Request, exc: ChainAdapterError):
    return error(exc.code, exc.message, status_code=502, details=exc.details)


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError):
    return error("VALIDATION_ERROR", str(exc), status_code=400)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_request: Request, exc: RuntimeError):
    return error("SERVICE_UNAVAILABLE", str(exc), status_code=503)


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def detect_chain(address: str) -> str:
    if not address.startswith("0x"):
        raise ValueError("Only Ethereum addresses (0x...) are supported.")
    return "ethereum"


async def fetch_wallet_data(
    address: str,
    chain: str = "ethereum",
    tx_days: int = 90,
    tx_limit: Optional[int] = None,
):
    if chain == "ethereum":
        tx_fetcher = (
            get_eth_transactions(address, limit=tx_limit)
            if tx_limit
            else get_eth_transactions_since(address, days=tx_days)
        )
        balance, transactions = await asyncio.gather(
            get_eth_balance(address),
            tx_fetcher,
        )
        return balance, transactions
    raise ValueError(f"Unsupported chain: {chain}. Only Ethereum is supported.")


def fetch_existing_tx_hashes(tx_hashes: list[str], chunk_size: int = 250) -> set[str]:
    """
    Supabase/PostgREST URL length can break large `in_` filters.
    Query in chunks to keep request URLs safe for very active wallets.
    """
    existing_hashes: set[str] = set()
    for i in range(0, len(tx_hashes), chunk_size):
        chunk = tx_hashes[i : i + chunk_size]
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


def fetch_latest_analyses(wallet_ids: list[str], chunk_size: int = 40) -> dict[str, dict]:
    """
    Fetch the most recent analysis row per wallet_id.
    Chunked to avoid PostgREST URL-length 403 errors with large watchlists.
    """
    latest_by_wallet: dict[str, dict] = {}
    if not wallet_ids:
        return latest_by_wallet

    for i in range(0, len(wallet_ids), chunk_size):
        chunk = wallet_ids[i : i + chunk_size]
        if not chunk:
            continue
        result = (
            supabase_client.table("analyses")
            .select(
                "wallet_id, signal, signal_reason, activity_summary, "
                "key_insight, risk_level, tags, generated_at"
            )
            .in_("wallet_id", chunk)
            .order("generated_at", desc=True)
            .execute()
        )
        for row in result.data or []:
            wallet_id = row.get("wallet_id")
            if wallet_id and wallet_id not in latest_by_wallet:
                latest_by_wallet[wallet_id] = row
    return latest_by_wallet


async def persist_wallet_scan(address: str, label: str, chain: str, tags: list[str] | None = None):
    balance, transactions = await fetch_wallet_data(address, chain)
    score_result = score_wallet(transactions, balance, chain, address=address, label=label)

    wallet_record = {
        "address": address,
        "label": label,
        "chain": chain,
        "tags": tags or [],
        "score": score_result["score"],
        "score_breakdown": score_result.get("breakdown", {}),
        "balance": balance,
        "last_scanned": datetime.now(timezone.utc).isoformat(),
    }

    existing = supabase_client.table("wallets").select("id").eq("address", address).execute()
    if existing.data:
        wallet_id = existing.data[0]["id"]
        supabase_client.table("wallets").update(wallet_record).eq("address", address).execute()
    else:
        inserted = supabase_client.table("wallets").insert(wallet_record).execute()
        wallet_id = inserted.data[0]["id"]

    if transactions:
        tx_hashes = [tx.get("hash") for tx in transactions if tx.get("hash")]
        existing_hashes: set[str] = set()
        if tx_hashes:
            existing_hashes = fetch_existing_tx_hashes(tx_hashes)

        tx_records = []
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
                "value": tx.get("value", 0),
                "value_symbol": tx.get("value_symbol", "ETH"),
                "direction": tx.get("direction", "unknown"),
                "status": tx.get("status", "unknown"),
                "raw_data": tx,
            })

        if tx_records:
            for i in range(0, len(tx_records), 100):
                supabase_client.table("transactions").upsert(
                    tx_records[i : i + 100], on_conflict="hash", ignore_duplicates=True
                ).execute()

    # Keep latest AI analysis available for intelligence feeds.
    try:
        analysis = await analyze_wallet(
            wallet_name=label,
            transactions=transactions[:50],
            balance=balance,
            chain=chain,
        )
        supabase_client.table("analyses").insert({
            "wallet_id": wallet_id,
            "signal": analysis.get("signal", "NEUTRAL"),
            "signal_reason": analysis.get("signal_reason"),
            "activity_summary": analysis.get("activity_summary"),
            "key_insight": analysis.get("key_insight"),
            "risk_level": analysis.get("risk_level"),
            "tags": analysis.get("tags", []),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        # Do not fail scan persistence just because analysis persistence failed.
        pass


# ─────────────────────────────────────────
# ROUTES — HEALTH
# ─────────────────────────────────────────

@app.get("/")
async def root():
    return success({"status": "online", "product": "Sentinel AI", "version": "1.0.0"})


@app.get("/health")
async def health():
    return success({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "apis": {
            "etherscan": bool(os.getenv("ETHERSCAN_API_KEY")),
            "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
            "supabase": bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY")),
        },
    })


# ─────────────────────────────────────────
# ROUTES — WALLET SCANNING
# ─────────────────────────────────────────

@app.post("/api/scan")
async def scan_wallet(request: WalletScanRequest):
    address = request.address.strip()
    try:
        chain = request.chain or detect_chain(address)
    except ValueError as e:
        return error("INVALID_ADDRESS", str(e), status_code=400)

    label = request.label or f"{chain[:3].upper()}:{address[:8]}..."

    try:
        # Keep UI scans responsive: use a shorter lookback in interactive flows.
        balance, transactions = await fetch_wallet_data(address, chain, tx_limit=180)
        analysis = await analyze_wallet(
            wallet_name=label,
            transactions=transactions,
            balance=balance,
            chain=chain,
        )
        score_result = score_wallet(transactions, balance, chain, address=address, label=label)
        wallet_payload = {
            "address": address,
            "label": label,
            "chain": chain,
            "tags": [],
            "score": score_result["score"],
            "score_breakdown": score_result.get("breakdown", {}),
            "balance": balance,
            "last_scanned": datetime.now(timezone.utc).isoformat(),
        }

        upserted = (
            supabase_client.table("wallets")
            .upsert(wallet_payload, on_conflict="address", ignore_duplicates=False)
            .execute()
        )
        wallet_id = (upserted.data or [{}])[0].get("id")
        if wallet_id:
            supabase_client.table("analyses").insert({
                "wallet_id": wallet_id,
                "signal": analysis.get("signal", "NEUTRAL"),
                "signal_reason": analysis.get("signal_reason"),
                "activity_summary": analysis.get("activity_summary"),
                "key_insight": analysis.get("key_insight"),
                "risk_level": analysis.get("risk_level"),
                "tags": analysis.get("tags", []),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

        return success({
            "wallet": {
                "address": address,
                "label": label,
                "chain": chain,
                "balance": balance,
                "score": score_result["score"],
                "grade": score_result["grade"],
                "score_breakdown": score_result.get("breakdown", {}),
                "last_scanned": datetime.now(timezone.utc).isoformat(),
            },
            "transactions": transactions[:10],
            "analysis": analysis,
        })
    except ChainAdapterError:
        raise
    except RuntimeError as e:
        return error("AI_UNAVAILABLE", str(e), status_code=503)
    except Exception as e:
        return error("SCAN_FAILED", str(e), status_code=500)


@app.get("/api/scan/{address}")
async def scan_wallet_get(address: str, label: Optional[str] = None):
    return await scan_wallet(WalletScanRequest(address=address, label=label))


# ─────────────────────────────────────────
# ROUTES — WATCHLIST
# ─────────────────────────────────────────

@app.get("/api/watchlist")
async def get_watchlist():
    """Return all tracked whale wallets from Supabase, sorted by score."""
    try:
        result = (
            supabase_client.table("wallets")
            .select("*")
            .eq("chain", "ethereum")
            .order("score", desc=True)
            .execute()
        )
        wallets = result.data or []
        if wallets:
            wallet_ids = [w["id"] for w in wallets if w.get("id")]
            latest_by_wallet = fetch_latest_analyses(wallet_ids)
            for wallet in wallets:
                latest = latest_by_wallet.get(wallet.get("id"))
                wallet["signal"] = latest.get("signal") if latest else None
                wallet["signal_reason"] = latest.get("signal_reason") if latest else None
                if latest:
                    wallet["analysis"] = {
                        "signal": latest.get("signal"),
                        "signal_reason": latest.get("signal_reason"),
                        "activity_summary": latest.get("activity_summary"),
                        "key_insight": latest.get("key_insight"),
                        "risk_level": latest.get("risk_level"),
                        "risk_reason": latest.get("signal_reason"),
                        "tags": latest.get("tags") or [],
                        "generated_at": latest.get("generated_at"),
                    }
        if not wallets:
            return success({
                "wallets": [],
                "count": 0,
                "note": "No wallets in database — run backend/scripts/ingest_wallets.py to seed",
            })
        return success({"wallets": wallets, "count": len(wallets)})
    except Exception as e:
        return error("DB_ERROR", "Failed to fetch watchlist", status_code=500, details={"reason": str(e)})


@app.delete("/api/watchlist/{address}")
async def remove_from_watchlist(address: str):
    """Remove a wallet and its associated data from the watchlist."""
    try:
        # Look up wallet id first
        wallet_row = (
            supabase_client.table("wallets")
            .select("id")
            .eq("address", address)
            .execute()
        )
        if not wallet_row.data:
            return error("NOT_FOUND", "Wallet not found in watchlist", status_code=404)

        wallet_id = wallet_row.data[0]["id"]

        # Cascade-delete analyses and transactions, then the wallet
        supabase_client.table("analyses").delete().eq("wallet_id", wallet_id).execute()
        supabase_client.table("transactions").delete().eq("wallet_id", wallet_id).execute()
        supabase_client.table("wallets").delete().eq("id", wallet_id).execute()

        return success({"removed": address})
    except Exception as e:
        return error("DB_ERROR", "Failed to remove wallet", status_code=500, details={"reason": str(e)})


@app.get("/api/wallets/{address}")
async def get_wallet_detail(address: str):
    """Return full wallet data with latest analysis. Fetches live balance if not recently scanned."""
    try:
        wallet_row = (
            supabase_client.table("wallets")
            .select("*")
            .eq("address", address)
            .execute()
        )
        if not wallet_row.data:
            return error("NOT_FOUND", "Wallet not found", status_code=404)

        wallet = wallet_row.data[0]
        wallet_id = wallet["id"]

        # Latest analysis
        analysis_row = (
            supabase_client.table("analyses")
            .select("*")
            .eq("wallet_id", wallet_id)
            .order("generated_at", desc=True)
            .limit(1)
            .execute()
        )
        if analysis_row.data:
            a = analysis_row.data[0]
            wallet["analysis"] = {
                "signal": a.get("signal"),
                "signal_reason": a.get("signal_reason"),
                "activity_summary": a.get("activity_summary"),
                "key_insight": a.get("key_insight"),
                "risk_level": a.get("risk_level"),
                "risk_reason": a.get("signal_reason"),
                "tags": a.get("tags") or [],
                "generated_at": a.get("generated_at"),
            }
            wallet["signal"] = a.get("signal")
            wallet["signal_reason"] = a.get("signal_reason")

        # Recent transactions (last 20 for detail view)
        tx_row = (
            supabase_client.table("transactions")
            .select("hash, timestamp, value, value_symbol, direction, status")
            .eq("wallet_id", wallet_id)
            .order("timestamp", desc=True)
            .limit(20)
            .execute()
        )
        wallet["recent_transactions"] = tx_row.data or []

        return success({"wallet": wallet})
    except Exception as e:
        return error("DB_ERROR", "Failed to fetch wallet", status_code=500, details={"reason": str(e)})


@app.post("/api/watchlist")
async def add_to_watchlist(request: AddWalletRequest, background_tasks: BackgroundTasks):
    try:
        if request.chain != "ethereum":
            return error("UNSUPPORTED_CHAIN", "Only Ethereum is supported right now", status_code=400)

        data = {
            "address": request.address.strip(),
            "label": request.label,
            "chain": request.chain,
            "tags": request.tags or [],
            "score": 0,
        }
        result = supabase_client.table("wallets").insert(data).execute()
        wallet = result.data[0] if result.data else data

        background_tasks.add_task(
            persist_wallet_scan,
            data["address"],
            data["label"],
            data["chain"],
            data["tags"],
        )

        return success({"wallet": wallet}, status_code=201)
    except Exception as e:
        return error("DB_ERROR", "Failed to add wallet", status_code=500, details={"reason": str(e)})


# ─────────────────────────────────────────
# ROUTES — CRON / ADMIN
# ─────────────────────────────────────────

@app.post("/api/admin/rescan-all")
async def rescan_all_wallets(background_tasks: BackgroundTasks):
    """Trigger a full rescan of ALL wallets in the background (applies new scoring engine)."""
    try:
        result = (
            supabase_client.table("wallets")
            .select("address, label, chain, tags")
            .eq("chain", "ethereum")
            .order("score", desc=True)
            .execute()
        )
        wallets = result.data or []
        for w in wallets:
            background_tasks.add_task(
                persist_wallet_scan,
                w["address"],
                w.get("label", ""),
                w.get("chain", "ethereum"),
                w.get("tags") or [],
            )
        return success({"queued": len(wallets), "message": f"Rescanning {len(wallets)} wallets with v3 scoring engine"})
    except Exception as e:
        return error("RESCAN_FAILED", str(e), status_code=500)


@app.post("/api/admin/backfill-balances")
async def backfill_balances(background_tasks: BackgroundTasks, limit: int = 94):
    """Fetch live ETH balances for wallets missing balance data (no AI scan)."""
    background_tasks.add_task(sync_wallet_balances, min(limit, 100))
    return success({"status": "queued", "limit": min(limit, 100)})


@app.post("/api/admin/rescan-top")
async def trigger_rescan(background_tasks: BackgroundTasks, n: int = CRON_TOP_N):
    """Manually trigger a background rescan of the top-N wallets."""
    try:
        result = (
            supabase_client.table("wallets")
            .select("address, label, chain, tags")
            .eq("chain", "ethereum")
            .order("score", desc=True)
            .limit(min(n, 50))
            .execute()
        )
        wallets = result.data or []
        for w in wallets:
            background_tasks.add_task(
                persist_wallet_scan,
                w["address"],
                w.get("label", ""),
                w.get("chain", "ethereum"),
                w.get("tags") or [],
            )
        return success({"queued": len(wallets), "addresses": [w["address"] for w in wallets]})
    except Exception as e:
        return error("RESCAN_FAILED", str(e), status_code=500)


@app.get("/api/admin/cron-status")
async def cron_status():
    """Return current cron schedule state so the frontend can display a countdown."""
    return success({
        "top_cron": {
            "interval_hours": 6,
            "top_n": CRON_TOP_N,
            "last_run": _cron_state["top_last_run"],
            "next_run": _cron_state["top_next_run"],
        },
        "full_cron": {
            "interval_hours": CRON_FULL_INTERVAL,
            "last_run": _cron_state["full_last_run"],
            "next_run": _cron_state["full_next_run"],
        },
        "server_time": datetime.now(timezone.utc).isoformat(),
    })


# ─────────────────────────────────────────
# ROUTES — AI INTELLIGENCE
# ─────────────────────────────────────────

@app.get("/api/intelligence/summary")
async def market_summary():
    try:
        result = (
            supabase_client.table("transactions")
            .select("*")
            .order("timestamp", desc=True)
            .limit(50)
            .execute()
        )
        summary = await get_market_summary(result.data or [])
        return success({
            "summary": summary,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        })
    except RuntimeError as e:
        return error("AI_UNAVAILABLE", str(e), status_code=503)
    except Exception as e:
        return error("INTELLIGENCE_FAILED", str(e), status_code=500)


@app.get("/api/intelligence/signals")
async def get_signals():
    try:
        result = (
            supabase_client.table("analyses")
            .select("signal, signal_reason, generated_at, wallet_id, wallets(label, chain, address, score)")
            .order("generated_at", desc=True)
            .limit(15)
            .execute()
        )
        # De-duplicate: keep only the most recent entry per wallet
        seen: set[str] = set()
        signals = []
        for row in result.data or []:
            wallet = row.get("wallets") or {}
            wid = row.get("wallet_id")
            if not wid or wid in seen:
                continue
            seen.add(wid)
            score = wallet.get("score") or 0
            signals.append({
                "wallet_label": wallet.get("label", "Unknown"),
                "wallet_address": wallet.get("address", ""),
                "chain": "ethereum",
                "signal": row.get("signal", "NEUTRAL"),
                "signal_reason": row.get("signal_reason"),
                "score": score,
                "generated_at": row.get("generated_at"),
            })
        return success({"signals": signals, "count": len(signals)})
    except Exception:
        return success({"signals": [], "count": 0, "note": "Run wallet scans to populate signals"})


# ─────────────────────────────────────────
# ROUTES — ASK SENTINEL AI CHAT
# ─────────────────────────────────────────

@app.post("/api/ask")
async def ask_sentinel(request: AskRequest):
    """
    Claude answers questions about wallet data.
    Pulls live wallet + signal data as context.
    Never hallucinates — only answers from real data.
    """
    try:
        from ai.analyst import get_client

        wallets_result = (
            supabase_client.table("wallets")
            .select("address, label, score, signal, balance")
            .order("score", desc=True)
            .limit(20)
            .execute()
        )
        wallets = wallets_result.data if wallets_result.data else []

        wallet_context = "\n".join([
            f"- {w['label']}: score={w.get('score', 0)}, "
            f"signal={w.get('signal', 'unknown')}, "
            f"balance={float(w.get('balance') or 0):.2f} ETH"
            for w in wallets[:20]
        ])

        system_prompt = f"""You are Sentinel AI's intelligence assistant. You answer questions about Ethereum whale wallet activity using ONLY the real data provided below. Never make up data. Be concise and direct. Use numbers when available.

CURRENT WALLET DATA (top 20 by score):
{wallet_context}

Answer in 2-4 sentences max unless the user asks for a detailed breakdown. If asked for a list, use bullet points. Always cite specific wallet names and scores from the data above."""

        client = get_client()
        messages = request.history + [{"role": "user", "content": request.message}]

        response = await asyncio.to_thread(
            client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=system_prompt,
            messages=messages,
        )

        return {
            "success": True,
            "response": response.content[0].text,
            "used_wallets": len(wallets),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
