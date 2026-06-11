"""
Sentinel AI — Ethereum Smart-Money Intelligence Platform
FastAPI Backend
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import asyncio
import json
import logging
import os
import re

import config  # noqa: F401 — load .env before chain/API imports
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from auth_context import resolve_user
from observability import bind_request_context, log_error, log_info, new_request_id, setup_logging
from quota import (
    check_ask_quota,
    consume_global_budget,
    get_quota_status,
    record_token_usage,
    try_consume_ask_quota,
    try_consume_scan_quota,
)
from rate_limits import rate_limit_key, rate_limit_message
from responses import error, quota_error, success
from performance import (
    build_copy_trader_sparkline,
    compute_ytd_growth,
    downsample_sparkline,
    estimate_supplemental_metrics,
)
from copy_traders_store import (
    copy_traders_meta,
    find_copy_trader_by_address,
    invalidate_copy_traders_cache,
    is_exchange_trader,
    load_copy_traders,
    sync_copy_traders_to_db,
)
from copy_trader_moves import fetch_recent_copy_moves
from detected_moves import (
    get_marketing_snapshot,
    get_pending_preview,
    get_trust_pulse,
    run_trust_pipeline,
)
from scoring.engine import score_wallet
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
except ImportError:  # local dev without full requirements
    sentry_sdk = None  # type: ignore[assignment,misc]
    FastApiIntegration = None  # type: ignore[assignment,misc]

setup_logging()

from ai.analyst import analyze_wallet, calls_remaining, get_market_summary, init_analyst
from ai.ask_service import build_ask_system_prompt, fetch_ask_wallets, select_ask_model
from ai.streaming import stream_claude_text
from chains.ethereum import ChainAdapterError, get_eth_balance, get_eth_transactions, get_eth_transactions_since, get_eth_token_transfers, discover_whale_addresses
from db.supabase import supabase_client, prune_wallet_transactions, MAX_TXS_PER_WALLET
from integrations import dune

_SENTRY_DSN = os.getenv("SENTRY_DSN")
if _SENTRY_DSN and sentry_sdk is not None:
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        environment=os.getenv("ENVIRONMENT", "production"),
    )


CRON_TOP_N = 100          # 6-hour pass: top 100 by score
CRON_FULL_INTERVAL = 24   # 24-hour pass: entire list

# In-memory cron state — exposed via /api/admin/cron-status
_cron_state: dict = {
    "top_last_run": None,
    "top_next_run": None,
    "full_last_run": None,
    "full_next_run": None,
}

# Cooldown timestamps for expensive admin operations (prevents hammering Claude API)
_admin_cooldowns: dict = {
    "batch_ingest": None,
    "rescan_all": None,
    "sync_copy_traders": None,
}
_ADMIN_COOLDOWN_SECS = 3600  # 1 hour between batch operations
_track_scans_pending: set[str] = set()


async def _scan_wallet_list(wallets: list[dict], analyze: bool = False) -> int:
    """
    Sequentially refresh a list of wallets. Returns count of successes.
    Defaults to analyze=False (data only, no Claude) since this is the
    background-cron path — keeping API budget for on-demand + the top-N pass.
    """
    ok = 0
    for w in wallets:
        try:
            await persist_wallet_scan(
                w["address"], w.get("label", ""), w.get("chain", "ethereum"), w.get("tags") or [],
                analyze=analyze,
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


AI_TOP_N = 15  # only the top wallets get fresh AI signals from the background

async def _cron_ai_top():
    """
    Once every 24h: refresh Claude analysis for ONLY the top N wallets by score.
    This is the *only* background source of Claude calls — ~15/day, not the
    hundreds the data crons used to generate. Everything else gets AI on demand.
    """
    await asyncio.sleep(8 * 60)  # 8 min after startup, let data settle first
    while True:
        try:
            result = (
                supabase_client.table("wallets")
                .select("address, label, chain")
                .eq("chain", "ethereum")
                .order("score", desc=True)
                .limit(AI_TOP_N)
                .execute()
            )
            for w in result.data or []:
                try:
                    await persist_wallet_scan(
                        w["address"], w.get("label", ""), w.get("chain", "ethereum"), [],
                        analyze=True,
                    )
                except Exception:
                    pass
                await asyncio.sleep(1)
        except Exception:
            pass
        await asyncio.sleep(24 * 3600)


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


async def _startup_copy_traders():
    """Warm copy-trader cache from Supabase (or JSON fallback) on boot."""
    await asyncio.sleep(2)
    try:
        load_copy_traders(force_refresh=True)
    except Exception:
        pass


async def _run_trust_pipeline_once() -> None:
    pool = _sort_copy_traders(
        _filter_copy_traders(_load_copy_trading_wallets(), qualified_only=True, strict=True),
        "copy_score",
    )
    # Broader scan = more detections = the wins ledger fills faster.
    enriched = [_enrich_copy_trader(w) for w in pool[:120]]
    await run_trust_pipeline(enriched, limit=120)


async def _startup_trust_pipeline():
    """First ingest ~90s after boot so wins ledger fills without waiting for cron."""
    await asyncio.sleep(90)
    try:
        await _run_trust_pipeline_once()
    except Exception:
        pass


async def _cron_trust_pipeline():
    """Every 15 min: ingest copy-trader swaps + score 24h outcomes for trust ledger."""
    await asyncio.sleep(5 * 60)
    while True:
        try:
            await _run_trust_pipeline_once()
        except Exception:
            pass
        await asyncio.sleep(15 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_analyst()
    asyncio.create_task(_cron_top())
    asyncio.create_task(_cron_full())
    asyncio.create_task(_cron_ai_top())
    asyncio.create_task(_startup_balance_sync())
    asyncio.create_task(_startup_copy_traders())
    asyncio.create_task(_startup_trust_pipeline())
    asyncio.create_task(_cron_dune_refresh())
    asyncio.create_task(_cron_news())
    asyncio.create_task(_cron_trust_pipeline())
    yield


app = FastAPI(
    title="Sentinel AI",
    description="Ethereum smart-money intelligence — powered by Claude",
    version="1.0.0",
    lifespan=lifespan,
)
limiter = Limiter(key_func=rate_limit_key)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def sentinel_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return error(
        "RATE_LIMITED",
        rate_limit_message(request.url.path),
        status_code=429,
        details={"retry_after_seconds": 60, "limit": str(getattr(exc, "detail", ""))},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Always return JSON (with CORS) so the browser never masks errors as 'Failed to fetch'."""
    if isinstance(exc, HTTPException):
        raise exc
    log_error("unhandled_exception", path=request.url.path, error=str(exc))
    return error(
        "INTERNAL_ERROR",
        "Something went wrong on our side. Please try again in a moment.",
        status_code=500,
        details={"reason": str(exc)[:200]},
    )

# Production origins always included regardless of CORS_ORIGINS env var
_CORS_ALWAYS = [
    "https://hadaleum.com",
    "https://www.hadaleum.com",
    "https://sentinel-ai.pages.dev",
]
_CORS_ORIGINS_DEFAULT = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:5176,http://127.0.0.1:5176"
)
_cors_origins = list(set(
    _CORS_ALWAYS + [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", _CORS_ORIGINS_DEFAULT).split(",")
        if o.strip()
    ]
))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.pages\.dev",  # Cloudflare Pages previews + production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_log = logging.getLogger(__name__)
_ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")


async def require_admin(request: Request) -> None:
    """Gate destructive / expensive admin routes behind ADMIN_API_KEY."""
    if not _ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured")
    provided = request.headers.get("X-Admin-Key")
    if not provided or provided != _ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    import time

    rid = request.headers.get("X-Request-ID") or new_request_id()
    user = await resolve_user(request.headers.get("Authorization"))
    bind_request_context(
        request_id=rid,
        user_id=user.user_id if user else None,
        user_plan=user.plan if user else "anonymous",
    )
    request.state.user_id = user.user_id if user else None
    request.state.auth_user = user

    start = time.perf_counter()
    try:
        response = await call_next(request)
        log_info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round((time.perf_counter() - start) * 1000, 1),
        )
        response.headers["X-Request-ID"] = rid
        return response
    except Exception as exc:
        log_error(
            "http_request_failed",
            method=request.method,
            path=request.url.path,
            error=str(exc),
            duration_ms=round((time.perf_counter() - start) * 1000, 1),
        )
        raise


# ─────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────

class WalletScanRequest(BaseModel):
    address: str
    label: Optional[str] = None
    chain: Optional[str] = None
    tags: Optional[list[str]] = None


class AddWalletRequest(BaseModel):
    address: str = Field(..., min_length=10)
    label: str
    chain: str
    tags: Optional[list[str]] = []


class AskRequest(BaseModel):
    message: str
    history: list[dict] = []


class WaitlistRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=200)
    source: Optional[str] = None


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
    if not address.startswith("0x") or len(address) != 42:
        raise ValueError("Invalid Ethereum address — must be 0x followed by 40 hex characters.")
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


async def persist_wallet_scan(address: str, label: str, chain: str, tags: list[str] | None = None, analyze: bool = True):
    """
    Refresh a wallet's on-chain data + score, and store it.
    When analyze=False, skips the Claude call entirely — used by the data-refresh
    crons so background passes never burn API budget. AI analysis is layered on
    separately (on-demand scans + a small top-N daily pass).

    Transaction storage is capped at MAX_TXS_PER_WALLET per wallet to stay within
    Supabase free-tier database limits.
    """
    balance, transactions = await fetch_wallet_data(address, chain, tx_limit=MAX_TXS_PER_WALLET)
    # Token transfers feed the DeFi-engagement signal in the v4 scoring engine.
    try:
        token_transfers = await get_eth_token_transfers(address, limit=30)
    except Exception:
        token_transfers = []
    score_result = score_wallet(
        transactions + token_transfers, balance, chain, address=address, label=label
    )

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
            })

        if tx_records:
            for i in range(0, len(tx_records), 100):
                supabase_client.table("transactions").upsert(
                    tx_records[i : i + 100], on_conflict="hash", ignore_duplicates=True
                ).execute()
            prune_wallet_transactions(wallet_id, keep=MAX_TXS_PER_WALLET)

    # Persist ERC-20 flows — most DEX activity shows up here, not in native ETH value.
    if token_transfers:
        token_records = []
        seen_token_hashes: set[str] = set()
        for tx in token_transfers:
            tx_hash = tx.get("hash", "")
            sym = (tx.get("token_symbol") or "TOKEN").upper()
            dedupe_key = f"{tx_hash}:{sym}"
            if not tx_hash or dedupe_key in seen_token_hashes:
                continue
            seen_token_hashes.add(dedupe_key)
            token_records.append({
                "wallet_id": wallet_id,
                "hash": f"{tx_hash}#{sym}",
                "chain": chain,
                "timestamp": tx.get("timestamp"),
                "value": tx.get("value", 0),
                "value_symbol": sym,
                "direction": tx.get("direction", "unknown"),
                "status": "success",
            })
        if token_records:
            for i in range(0, len(token_records), 100):
                supabase_client.table("transactions").upsert(
                    token_records[i : i + 100], on_conflict="hash", ignore_duplicates=True
                ).execute()
            prune_wallet_transactions(wallet_id, keep=MAX_TXS_PER_WALLET)

    # AI analysis is OPT-IN. Background data-refresh crons pass analyze=False so
    # they never call Claude. analyze_wallet still checks the DB cache first, so
    # even when enabled, repeat scans within the TTL are free.
    if not analyze:
        return

    try:
        await analyze_wallet(
            wallet_name=label,
            transactions=transactions[:50],
            balance=balance,
            chain=chain,
            address=address,
        )
        # Link wallet_id to the analysis row that analyze_wallet just upserted.
        supabase_client.table("analyses").update({"wallet_id": wallet_id}).eq("wallet_address", address).execute()
    except Exception:
        # Do not fail scan persistence just because analysis persistence failed.
        pass


async def _background_track_scan(address: str, label: str, chain: str, tags: list[str]) -> None:
    addr = address.lower()
    try:
        await persist_wallet_scan(address, label, chain, tags=tags, analyze=True)
    except Exception as exc:
        _log.warning("Background track scan failed for %s: %s", address, exc)
    finally:
        _track_scans_pending.discard(addr)


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
            "dune": dune.is_configured(),
        },
        "claude_calls_remaining": calls_remaining(),
    })


@app.get("/api/stats")
async def get_stats():
    """Lightweight stats for the sidebar — just count and last scan time."""
    try:
        def _fetch():
            count_res = supabase_client.table("wallets").select("id", count="exact").execute()
            last_res  = supabase_client.table("wallets").select("last_scanned").order("last_scanned", desc=True).limit(1).execute()
            count = count_res.count or (len(count_res.data) if count_res.data else 0)
            last_scanned = (last_res.data or [{}])[0].get("last_scanned")
            return count, last_scanned
        count, last_scanned = await asyncio.to_thread(_fetch)
        return success({"count": count, "last_scanned": last_scanned})
    except Exception:
        return success({"count": 0, "last_scanned": None})


# ─────────────────────────────────────────
# ROUTES — WALLET SCANNING
# ─────────────────────────────────────────

@limiter.limit("20/minute")
@app.post("/api/scan")
async def scan_wallet(request: Request, body: WalletScanRequest):
    user = getattr(request.state, "auth_user", None)
    ip = get_remote_address(request)

    address = body.address.strip()
    try:
        chain = body.chain or detect_chain(address)
    except ValueError as e:
        return error("INVALID_ADDRESS", str(e), status_code=400)

    label = body.label or f"{chain[:3].upper()}:{address[:8]}..."

    # Atomic gate + reserve (no TOCTOU window). Done after input validation so an
    # invalid address doesn't burn a scan from the user's hourly quota.
    allowed, scan_quota = try_consume_scan_quota(user, ip)
    if not allowed:
        return quota_error(scan_quota)

    try:
        # Fetch balance, transactions, and token transfers concurrently
        balance, transactions, token_transfers = await asyncio.gather(
            get_eth_balance(address),
            get_eth_transactions(address, limit=50),
            get_eth_token_transfers(address, limit=20),
        )
        all_transactions = transactions + token_transfers

        analysis = await analyze_wallet(
            wallet_name=label,
            transactions=transactions[:10],  # Regular txs for AI (token transfers confuse prompt)
            balance=balance,
            chain=chain,
            address=address,
        )
        score_result = score_wallet(all_transactions, balance, chain, address=address, label=label)
        wallet_payload = {
            "address": address,
            "label": label,
            "chain": chain,
            "tags": body.tags or [],
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
            # analyze_wallet already upserted an analyses row keyed by wallet_address.
            # Just link the wallet_id so intelligence queries can join by wallet_id.
            try:
                supabase_client.table("analyses").update({"wallet_id": wallet_id}).eq("wallet_address", address).execute()
            except Exception:
                pass

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
async def scan_wallet_get(request: Request, address: str, label: Optional[str] = None):
    return await scan_wallet(request, WalletScanRequest(address=address, label=label))


@app.post("/api/scan/{address}/refresh")
async def force_refresh_scan(address: str):
    """Force a fresh Claude analysis for a wallet, bypassing the 6-hour cache."""
    try:
        chain = detect_chain(address)
    except ValueError as e:
        return error("INVALID_ADDRESS", str(e), status_code=400)

    wallet_row = (
        supabase_client.table("wallets")
        .select("label, chain, tags")
        .eq("address", address)
        .execute()
    )
    label = wallet_row.data[0]["label"] if wallet_row.data else f"ETH:{address[:8]}..."
    chain = wallet_row.data[0].get("chain", "ethereum") if wallet_row.data else chain

    try:
        balance, transactions = await fetch_wallet_data(address, chain, tx_limit=50)
        analysis = await analyze_wallet(
            wallet_name=label,
            transactions=transactions,
            balance=balance,
            chain=chain,
            address=address,
            force_refresh=True,
        )
        return success({"analysis": analysis, "address": address, "force_refreshed": True})
    except Exception as e:
        return error("REFRESH_FAILED", str(e), status_code=500)


# ─────────────────────────────────────────
# ROUTES — WATCHLIST
# ─────────────────────────────────────────

def fetch_wallet_transactions(
    wallet_ids: list[str],
    limit_per_wallet: int = 40,
    max_wallets: int = 50,
) -> dict[str, list]:
    """Batch-fetch recent transactions grouped by wallet_id (capped to avoid DB timeout)."""
    grouped: dict[str, list] = {wid: [] for wid in wallet_ids[:max_wallets]}
    ids = wallet_ids[:max_wallets]
    if not ids:
        return grouped

    for i in range(0, len(ids), 15):
        chunk = ids[i : i + 15]
        result = (
            supabase_client.table("transactions")
            .select("wallet_id, hash, timestamp, value, value_symbol, direction")
            .in_("wallet_id", chunk)
            .order("timestamp", desc=True)
            .limit(limit_per_wallet * len(chunk))
            .execute()
        )
        for row in result.data or []:
            wid = row.get("wallet_id")
            if wid and len(grouped.get(wid, [])) < limit_per_wallet:
                grouped.setdefault(wid, []).append(row)
    return grouped


def enrich_wallet_performance(
    wallet: dict,
    transactions: list[dict],
    *,
    lite: bool = False,
) -> None:
    """Attach YTD growth + sparkline to a wallet dict in-place."""
    perf = compute_ytd_growth(transactions, float(wallet.get("balance") or 0))
    wallet["ytd_growth_pct"] = perf["ytd_pct"]
    wallet["ytd_start_balance"] = perf["ytd_start_balance"]
    raw_spark = downsample_sparkline(perf["sparkline"]) if lite else perf["sparkline"]
    wallet["ytd_sparkline"] = [
        {**pt, "date": pt.get("date") or pt.get("ts")}
        for pt in raw_spark
    ]
    if lite:
        return
    wallet["transactions"] = [
        {
            **tx,
            "timestamp_unix": int(
                datetime.fromisoformat(str(tx["timestamp"]).replace("Z", "+00:00")).timestamp()
            ) if tx.get("timestamp") else 0,
        }
        for tx in sorted(
            transactions,
            key=lambda t: t.get("timestamp") or "",
        )
    ]


def derive_flow_signal(score: int, breakdown: dict | None) -> tuple[str, str]:
    """
    Heuristic BULLISH/BEARISH/NEUTRAL signal derived from the v4 score
    breakdown — NO Claude call. Used to fill the signal everywhere when a
    fresh AI analysis isn't available, so the watchlist / copy-trade feeds
    never look empty. The real AI signal always takes precedence.

    Reads recency/activity/defi from the breakdown (each 0-25) plus score.
    """
    bd = breakdown or {}
    recency = bd.get("recency", 0) or 0
    activity = bd.get("activity", 0) or 0
    defi = bd.get("defi", 0) or 0

    # Actively deploying capital: recent + engaged + real activity
    if recency >= 16 and activity >= 13 and (defi >= 10 or score >= 80):
        return "BULLISH", "Actively deploying capital — recent on-chain activity with DeFi engagement."
    # Was a real wallet, has gone quiet — reducing footprint
    if recency <= 4 and score >= 45:
        return "BEARISH", "Previously active wallet has gone quiet — reduced on-chain footprint."
    # Score-only fallback when breakdown is missing
    if not bd:
        if score >= 80:
            return "BULLISH", "High-conviction wallet by Sentinel score."
        if score <= 25:
            return "NEUTRAL", "Limited recent signal."
    return "NEUTRAL", "Steady on-chain presence with no strong directional bias."


_EXCHANGE_KEYWORDS = (
    "binance", "coinbase", "kraken", "kucoin", "okx", "crypto.com", "gemini",
    "bitstamp", "bittrex", "huobi", "gate.io", "bitfinex", "bithumb", "coinone",
    "hot wallet", "mev bot", "deposit funder", "funder", "exchange",
)


def _is_exchange_wallet(label: str | None) -> bool:
    low = (label or "").lower()
    return any(k in low for k in _EXCHANGE_KEYWORDS)


def _merge_recent_activity(eth_txs: list[dict], token_txs: list[dict], limit: int = 25) -> list[dict]:
    """Combine native ETH txs and ERC-20 transfers for the activity feed."""
    merged: list[dict] = []
    for tx in eth_txs or []:
        merged.append({
            **tx,
            "activity_type": "eth",
            "value_symbol": tx.get("value_symbol") or "ETH",
        })
    for tx in token_txs or []:
        merged.append({
            "hash": tx.get("hash"),
            "timestamp": tx.get("timestamp"),
            "value": tx.get("value", 0),
            "value_symbol": tx.get("token_symbol") or tx.get("value_symbol") or "TOKEN",
            "direction": tx.get("direction", "unknown"),
            "status": tx.get("status", "success"),
            "activity_type": "token",
            "token_name": tx.get("token_name"),
        })
    merged.sort(key=lambda t: t.get("timestamp") or "", reverse=True)
    return merged[:limit]


@app.get("/api/watchlist")
async def get_watchlist(
    limit: int = 100,
    smart_only: bool = False,
    include_ytd: bool = False,
    lite: bool = True,
):
    """Return tracked whale wallets sorted by score. Fast by default (no tx payload)."""
    try:
        fetch_limit = min(max(limit, 1), 500)
        result = (
            supabase_client.table("wallets")
            .select("id, address, label, chain, tags, score, score_breakdown, balance, last_scanned, created_at")
            .eq("chain", "ethereum")
            .order("score", desc=True)
            .limit(fetch_limit if smart_only else min(fetch_limit * 3, 500))
            .execute()
        )
        wallets = result.data or []

        if smart_only:
            exchange_kw = ("binance", "coinbase", "kraken", "kucoin", "okx", "crypto.com", "gemini", "bitstamp", "bittrex", "hot wallet", "mev bot")
            wallets = [
                w for w in wallets
                if (w.get("score") or 0) > 55
                and not any(k in (w.get("label") or "").lower() for k in exchange_kw)
            ][:fetch_limit]

        total_scanned = (
            supabase_client.table("wallets")
            .select("id", count="exact")
            .eq("chain", "ethereum")
            .execute()
        )
        total_in_db = total_scanned.count if total_scanned.count is not None else len(wallets)

        if wallets:
            wallet_ids = [w["id"] for w in wallets if w.get("id")]
            latest_by_wallet = fetch_latest_analyses(wallet_ids)
            tx_by_wallet = fetch_wallet_transactions(wallet_ids) if include_ytd else {}

            for wallet in wallets:
                wid = wallet.get("id")
                latest = latest_by_wallet.get(wid)
                if latest and latest.get("signal"):
                    # Real AI analysis available — use it.
                    wallet["signal"] = latest.get("signal")
                    wallet["signal_reason"] = latest.get("signal_reason")
                    wallet["signal_source"] = "ai"
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
                else:
                    # No AI signal yet — derive a flow signal (zero Claude cost)
                    sig, reason = derive_flow_signal(
                        wallet.get("score") or 0, wallet.get("score_breakdown")
                    )
                    wallet["signal"] = sig
                    wallet["signal_reason"] = reason
                    wallet["signal_source"] = "flow"
                if include_ytd and wid:
                    enrich_wallet_performance(
                        wallet,
                        tx_by_wallet.get(wid, []),
                        lite=lite,
                    )

        if not wallets:
            return success({
                "wallets": [],
                "count": 0,
                "total_in_db": total_in_db,
                "note": "No wallets in database — run backend/scripts/ingest_wallets.py to seed",
            })
        return success({
            "wallets": wallets,
            "count": len(wallets),
            "total_in_db": total_in_db,
            "showing_top": fetch_limit,
        })
    except Exception as e:
        return error("DB_ERROR", "Failed to fetch watchlist", status_code=500, details={"reason": str(e)})


@app.delete("/api/watchlist/{address}")
@limiter.limit("30/minute")
async def remove_from_watchlist(request: Request, address: str):
    """Remove a user-tracked wallet from the watchlist (not core seeded whales)."""
    try:
        wallet_row = (
            supabase_client.table("wallets")
            .select("id, tags")
            .eq("address", address.strip().lower())
            .execute()
        )
        if not wallet_row.data:
            return error("NOT_FOUND", "Wallet not found in watchlist", status_code=404)

        tags = wallet_row.data[0].get("tags") or []
        is_user_tracked = "user-tracked" in tags
        is_copy_only = "copy-trading" in tags and "smart-money" not in tags
        if not is_user_tracked and not is_copy_only:
            return error(
                "FORBIDDEN",
                "Core whale wallets cannot be removed via this endpoint",
                status_code=403,
            )

        wallet_id = wallet_row.data[0]["id"]

        supabase_client.table("analyses").delete().eq("wallet_id", wallet_id).execute()
        supabase_client.table("transactions").delete().eq("wallet_id", wallet_id).execute()
        supabase_client.table("wallets").delete().eq("id", wallet_id).execute()

        return success({"removed": address})
    except Exception as e:
        return error("DB_ERROR", "Failed to remove wallet", status_code=500, details={"reason": str(e)})


@app.get("/api/wallets/{address}")
async def get_wallet_detail(address: str):
    """Return full wallet data with latest analysis. Refreshes live balance + token activity."""
    try:
        wallet_row = (
            supabase_client.table("wallets")
            .select("id, address, label, chain, tags, score, score_breakdown, balance, last_scanned, created_at")
            .eq("address", address)
            .execute()
        )
        if not wallet_row.data:
            return error("NOT_FOUND", "Wallet not found", status_code=404)

        wallet = wallet_row.data[0]
        wallet_id = wallet["id"]

        # Live balance (DB can be stale)
        try:
            wallet["balance"] = await get_eth_balance(address)
        except Exception:
            pass

        # Latest analysis
        analysis_row = (
            supabase_client.table("analyses")
            .select("signal, signal_reason, activity_summary, key_insight, risk_level, tags, generated_at")
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
            wallet["signal_source"] = "ai"
        else:
            sig, reason = derive_flow_signal(
                wallet.get("score") or 0, wallet.get("score_breakdown")
            )
            wallet["signal"] = sig
            wallet["signal_reason"] = reason
            wallet["signal_source"] = "flow"

        # Recent transactions from DB + live token transfers
        tx_row = (
            supabase_client.table("transactions")
            .select("hash, timestamp, value, value_symbol, direction, status")
            .eq("wallet_id", wallet_id)
            .order("timestamp", desc=True)
            .limit(40)
            .execute()
        )
        eth_txs = [
            t for t in (tx_row.data or [])
            if (t.get("value_symbol") or "ETH").upper() == "ETH"
            and "#" not in (t.get("hash") or "")
        ]

        token_txs: list[dict] = []
        try:
            token_txs = await get_eth_token_transfers(address, limit=30)
        except Exception:
            pass

        wallet["recent_transactions"] = _merge_recent_activity(eth_txs, token_txs)

        # Full tx history for YTD chart (ETH native + stored token rows)
        all_tx = (
            supabase_client.table("transactions")
            .select("hash, timestamp, value, value_symbol, direction, status")
            .eq("wallet_id", wallet_id)
            .order("timestamp", desc=True)
            .limit(120)
            .execute()
        )
        chart_txs = [
            t for t in (all_tx.data or [])
            if (t.get("value_symbol") or "ETH").upper() == "ETH"
            and "#" not in (t.get("hash") or "")
        ]
        enrich_wallet_performance(wallet, chart_txs)

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
            "tags": list(dict.fromkeys((request.tags or []) + ["user-tracked"])),
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

@app.post("/api/admin/batch-ingest", dependencies=[Depends(require_admin)])
async def batch_ingest_wallets(background_tasks: BackgroundTasks, limit: int = 500):
    """
    Queue Etherscan scans for up to 500 wallets from the seed list.
    Merges eth_smart_wallets.json + whale_expansion.json.
    """
    import json
    from pathlib import Path

    # Cooldown: max once per hour to avoid blowing Claude API budget
    last = _admin_cooldowns["batch_ingest"]
    if last is not None:
        elapsed = (datetime.now(timezone.utc) - last).total_seconds()
        if elapsed < _ADMIN_COOLDOWN_SECS:
            wait_min = int((_ADMIN_COOLDOWN_SECS - elapsed) / 60)
            return error("RATE_LIMITED", f"Batch ingest already ran recently. Try again in ~{wait_min}m.", status_code=429)
    _admin_cooldowns["batch_ingest"] = datetime.now(timezone.utc)

    seed_dir = Path(__file__).resolve().parent / "data"
    addresses: list[dict] = []
    seen: set[str] = set()

    for filename in ("world_whales.json", "eth_smart_wallets.json", "whale_expansion.json"):
        path = seed_dir / filename
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as f:
            rows = json.load(f)
        for row in rows:
            addr = (row.get("address") or "").lower()
            if addr and addr not in seen:
                seen.add(addr)
                addresses.append({
                    "address": row["address"],
                    "label": row.get("label", "Whale Wallet"),
                    "chain": "ethereum",
                    "tags": row.get("tags", ["ethereum", "smart-money"]),
                })

    to_scan = addresses[:min(limit, 500)]

    # Discover additional whales from Etherscan token holder lists
    if len(to_scan) < limit:
        try:
            discovered = await discover_whale_addresses(limit=limit - len(to_scan))
            for w in discovered:
                addr = w["address"].lower()
                if addr not in seen:
                    seen.add(addr)
                    to_scan.append(w)
        except Exception:
            pass

    for w in to_scan:
        background_tasks.add_task(
            persist_wallet_scan,
            w["address"],
            w["label"],
            w["chain"],
            w["tags"],
            False,  # analyze=False — bulk ingest never calls Claude
        )
    return success({
        "queued": len(to_scan),
        "total_seed": len(addresses),
        "message": f"Scanning {len(to_scan)} wallets via Etherscan (up to 500)",
    })


@app.post("/api/admin/rescan-all", dependencies=[Depends(require_admin)])
async def rescan_all_wallets(background_tasks: BackgroundTasks):
    """Trigger a full rescan of ALL wallets in the background (applies new scoring engine)."""
    last = _admin_cooldowns["rescan_all"]
    if last is not None:
        elapsed = (datetime.now(timezone.utc) - last).total_seconds()
        if elapsed < _ADMIN_COOLDOWN_SECS:
            wait_min = int((_ADMIN_COOLDOWN_SECS - elapsed) / 60)
            return error("RATE_LIMITED", f"Rescan already ran recently. Try again in ~{wait_min}m.", status_code=429)
    _admin_cooldowns["rescan_all"] = datetime.now(timezone.utc)
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
                False,  # analyze=False — bulk rescan never calls Claude
            )
        return success({"queued": len(wallets), "message": f"Rescanning {len(wallets)} wallets (data only, no AI)"})
    except Exception as e:
        return error("RESCAN_FAILED", str(e), status_code=500)


@app.post("/api/admin/backfill-balances", dependencies=[Depends(require_admin)])
async def backfill_balances(background_tasks: BackgroundTasks, limit: int = 94):
    """Fetch live ETH balances for wallets missing balance data (no AI scan)."""
    background_tasks.add_task(sync_wallet_balances, min(limit, 100))
    return success({"status": "queued", "limit": min(limit, 100)})


@app.post("/api/admin/sync-copy-traders", dependencies=[Depends(require_admin)])
async def admin_sync_copy_traders():
    """
    Upsert copy_trading_top_wallets.json into Supabase copy_traders table
    and refresh the in-memory leaderboard cache.
    """
    last = _admin_cooldowns["sync_copy_traders"]
    if last:
        elapsed = (datetime.now(timezone.utc) - last).total_seconds()
        if elapsed < 300:
            wait_min = max(1, int((300 - elapsed) / 60))
            return error(
                "RATE_LIMITED",
                f"Copy-trader sync ran recently. Try again in ~{wait_min}m.",
                status_code=429,
            )
    _admin_cooldowns["sync_copy_traders"] = datetime.now(timezone.utc)
    try:
        result = sync_copy_traders_to_db()
        _invalidate_copy_trading_cache()
        load_copy_traders(force_refresh=True)
        meta = copy_traders_meta()
        return success({
            "synced": result.get("synced", 0),
            "total": result.get("total", 0),
            "errors": result.get("errors") or [],
            "source": meta.get("source"),
            "count": meta.get("count"),
        })
    except Exception as e:
        return error("SYNC_FAILED", str(e), status_code=500)


@app.post("/api/admin/rescan-top", dependencies=[Depends(require_admin)])
async def trigger_rescan(background_tasks: BackgroundTasks, n: int = CRON_TOP_N):
    """Manually trigger a background rescan of the top-N wallets."""
    try:
        result = (
            supabase_client.table("wallets")
            .select("address, label, chain, tags")
            .eq("chain", "ethereum")
            .order("score", desc=True)
            .limit(min(n, 100))
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
                False,  # analyze=False — data refresh only, no Claude
            )
        return success({"queued": len(wallets), "addresses": [w["address"] for w in wallets]})
    except Exception as e:
        return error("RESCAN_FAILED", str(e), status_code=500)


@app.get("/api/admin/cron-status", dependencies=[Depends(require_admin)])
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


@app.get("/api/admin/usage", dependencies=[Depends(require_admin)])
async def api_usage():
    """Claude API call budget status for the current hour."""
    from ai.analyst import MAX_CALLS_PER_HOUR
    remaining = calls_remaining()
    return success({
        "claude_calls_remaining_this_hour": remaining,
        "claude_calls_used_this_hour": MAX_CALLS_PER_HOUR - remaining,
        "max_calls_per_hour": MAX_CALLS_PER_HOUR,
        "batch_ingest_last_run": _admin_cooldowns["batch_ingest"].isoformat() if _admin_cooldowns["batch_ingest"] else None,
        "rescan_all_last_run": _admin_cooldowns["rescan_all"].isoformat() if _admin_cooldowns["rescan_all"] else None,
    })


# ─────────────────────────────────────────
# ROUTES — AI INTELLIGENCE
# ─────────────────────────────────────────

@limiter.limit("30/minute")
@app.get("/api/intelligence/summary")
async def market_summary(request: Request, refresh: bool = False):
    try:
        from ai.analyst import _market_summary_cache

        if refresh:
            _market_summary_cache["data"] = None
            _market_summary_cache["generated_at"] = None

        tx_result = (
            supabase_client.table("transactions")
            .select("id")
            .order("timestamp", desc=True)
            .limit(50)
            .execute()
        )
        whale_count_res = supabase_client.table("wallets").select("id", count="exact").execute()
        whale_count = whale_count_res.count or 0

        signals_result = (
            supabase_client.table("analyses")
            .select("signal, signal_reason, wallet_id, wallets(label, score)")
            .order("generated_at", desc=True)
            .limit(10)
            .execute()
        )
        whale_signals = []
        seen_wids: set = set()
        for row in signals_result.data or []:
            wid = row.get("wallet_id")
            if not wid or wid in seen_wids:
                continue
            seen_wids.add(wid)
            w = row.get("wallets") or {}
            whale_signals.append({
                "wallet_label": w.get("label", "Whale"),
                "score": w.get("score", 0),
                "signal": row.get("signal", "NEUTRAL"),
            })

        copy_traders = _filter_copy_traders(
            _load_copy_trading_wallets(),
            qualified_only=True,
            strict=False,
        )[:8]

        context = {
            "recent_tx_count": len(tx_result.data or []),
            "whale_count": whale_count,
            "whale_signals": whale_signals,
            "copy_traders": copy_traders,
        }
        summary = await get_market_summary(context, force_refresh=refresh)
        return success({
            "summary": summary,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "whale_count": whale_count,
            "copy_trader_count": len(_load_copy_trading_wallets()),
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
            .select("signal, signal_reason, generated_at, wallet_id, wallets(label, chain, address, score, tags)")
            .order("generated_at", desc=True)
            .limit(20)
            .execute()
        )
        seen: set[str] = set()
        whale_signals = []
        for row in result.data or []:
            wallet = row.get("wallets") or {}
            wid = row.get("wallet_id")
            if not wid or wid in seen:
                continue
            label = wallet.get("label") or ""
            if _is_exchange_wallet(label):
                continue
            score = wallet.get("score") or 0
            if score < 55:
                continue
            signal = row.get("signal", "NEUTRAL")
            # Skip low-conviction neutral noise (micro-deposits, routine exchange flows)
            reason = (row.get("signal_reason") or "").lower()
            if signal == "NEUTRAL" and score < 70:
                if any(p in reason for p in ("micro", "single small", "routine", "insufficient", "no meaningful", "no directional")):
                    continue
            seen.add(wid)
            whale_signals.append({
                "wallet_type": "copy_trader" if "copy-trading" in (wallet.get("tags") or []) else "whale",
                "wallet_label": label or "Unknown",
                "wallet_address": wallet.get("address", ""),
                "chain": "ethereum",
                "signal": signal,
                "signal_reason": row.get("signal_reason"),
                "score": score,
                "generated_at": row.get("generated_at"),
                "signal_source": "ai",
            })

        _signal_rank = {"BULLISH": 0, "BEARISH": 1, "NEUTRAL": 2}
        whale_signals.sort(
            key=lambda s: (_signal_rank.get(s["signal"], 9), -(s["score"] or 0)),
        )
        whale_signals = whale_signals[:12]

        copy_leaders = []
        for t in _filter_copy_traders(_load_copy_trading_wallets(), qualified_only=True, strict=True)[:10]:
            m = t.get("metrics") or {}
            copy_leaders.append({
                "wallet_type": "copy_trader",
                "wallet_label": _copy_trader_label(t),
                "wallet_address": t.get("address", ""),
                "chain": "ethereum",
                "signal": "BULLISH" if (m.get("win_rate_pct") or 0) >= 70 else "NEUTRAL",
                "signal_reason": (
                    f"{m.get('win_rate_pct')}% win rate · PF {m.get('profit_factor')} · "
                    f"{m.get('track_record_days')}d track · Copy score {t.get('copy_trading_score')}"
                ),
                "score": t.get("copy_trading_score") or 0,
                "copy_metrics": m,
                "rank": t.get("rank"),
                "generated_at": _copy_trading_cache.get("loaded_at"),
            })

        return success({
            "signals": whale_signals + copy_leaders,
            "whale_signals": whale_signals,
            "copy_trader_signals": copy_leaders,
            "count": len(whale_signals) + len(copy_leaders),
        })
    except Exception:
        return success({
            "signals": [],
            "whale_signals": [],
            "copy_trader_signals": [],
            "count": 0,
            "note": "Run wallet scans to populate signals",
        })


# ─────────────────────────────────────────
# ROUTES — ASK SENTINEL AI CHAT
# ─────────────────────────────────────────

@limiter.limit("15/minute")
@app.get("/api/quota")
async def get_user_quota(request: Request):
    """Return remaining AI quotas for the current user (or IP if anonymous)."""
    user = getattr(request.state, "auth_user", None)
    ip = get_remote_address(request)
    status = get_quota_status(user, ip)
    return success({
        "plan": status.plan,
        "global_calls_remaining": status.global_calls_remaining,
        "ask_remaining": status.user_ask_remaining,
        "tokens_remaining": status.user_tokens_remaining,
        "scan_remaining": status.user_scan_remaining,
    })


@limiter.limit("15/minute")
@app.post("/api/ask")
async def ask_sentinel(request: Request, body: AskRequest):
    """
    Claude answers questions about wallet data (non-streaming fallback).
    Prefer POST /api/ask/stream for token streaming in the UI.
    """
    user = getattr(request.state, "auth_user", None)
    ip = get_remote_address(request)

    if not body.message.strip():
        return error("EMPTY_MESSAGE", "Ask a question about whale wallets or copy traders.", status_code=400)

    # Atomically reserve the per-user ask slot up front (no TOCTOU window), then
    # consume the shared global Claude budget here at the route level.
    allowed, quota = try_consume_ask_quota(user, ip)
    if not allowed:
        return quota_error(quota)
    if not consume_global_budget():
        return quota_error(check_ask_quota(user, ip))

    try:
        from ai.analyst import get_client

        wallets = await fetch_ask_wallets(supabase_client)
        system_prompt = build_ask_system_prompt(wallets)
        model, max_tokens = select_ask_model(body.message, body.history)
        messages = body.history + [{"role": "user", "content": body.message}]

        client = get_client()
        response = await asyncio.to_thread(
            client.messages.create,
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )

        usage = response.usage
        tokens = (getattr(usage, "input_tokens", 0) or 0) + (getattr(usage, "output_tokens", 0) or 0)
        # Ask slot + global budget already reserved at the gate; only record tokens.
        record_token_usage(user, ip, tokens)

        return success({
            "response": response.content[0].text,
            "used_wallets": len(wallets),
            "tokens_used": tokens,
            "quota": get_quota_status(user, ip).__dict__,
        })
    except RuntimeError as e:
        return error("AI_UNAVAILABLE", str(e), status_code=503)
    except Exception as e:
        log_error("ask_failed", error=str(e))
        return error(
            "ASK_FAILED",
            "Hadaleum AI couldn't complete that question. Try a shorter prompt or check back shortly.",
            status_code=500,
            details={"reason": str(e)[:200]},
        )


@limiter.limit("15/minute")
@app.post("/api/ask/stream")
async def ask_sentinel_stream(request: Request, body: AskRequest):
    """Stream Claude response as Server-Sent Events (token deltas)."""
    user = getattr(request.state, "auth_user", None)
    ip = get_remote_address(request)

    if not body.message.strip():
        return error("EMPTY_MESSAGE", "Ask a question about whale wallets or copy traders.", status_code=400)

    # Atomically reserve the ask slot + global budget before streaming begins.
    allowed, quota = try_consume_ask_quota(user, ip)
    if not allowed:
        return quota_error(quota)
    if not consume_global_budget():
        return quota_error(check_ask_quota(user, ip))

    wallets = await fetch_ask_wallets(supabase_client)
    system_prompt = build_ask_system_prompt(wallets)
    model, max_tokens = select_ask_model(body.message, body.history)
    messages = body.history + [{"role": "user", "content": body.message}]

    async def event_generator():
        rid = new_request_id()
        yield f"data: {json.dumps({'type': 'start', 'request_id': rid, 'used_wallets': len(wallets)})}\n\n"
        full_text: list[str] = []
        tokens_used = 0
        try:
            async for kind, payload in stream_claude_text(
                system=system_prompt,
                messages=messages,
                model=model,
                max_tokens=max_tokens,
            ):
                if kind == "delta":
                    full_text.append(payload)
                    yield f"data: {json.dumps({'type': 'delta', 'text': payload})}\n\n"
                elif kind == "done":
                    tokens_used = (payload.get("input_tokens") or 0) + (payload.get("output_tokens") or 0)
                elif kind == "error":
                    yield f"data: {json.dumps({'type': 'error', 'message': payload})}\n\n"
                    return

            # Ask slot + global budget already reserved at the gate; record tokens only.
            record_token_usage(user, ip, tokens_used)
            remaining = get_quota_status(user, ip)
            yield f"data: {json.dumps({'type': 'done', 'tokens_used': tokens_used, 'text': ''.join(full_text), 'quota': {'ask_remaining': remaining.user_ask_remaining, 'tokens_remaining': remaining.user_tokens_remaining, 'plan': remaining.plan}})}\n\n"
        except Exception as exc:
            log_error("ask_stream_failed", error=str(exc))
            yield f"data: {json.dumps({'type': 'error', 'message': 'Stream interrupted — try again.'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/market/eth")
async def get_eth_market_data():
    """
    Proxy CoinGecko ETH data through backend.
    Caches for 60 seconds to avoid rate limiting.
    """
    import httpx

    cache_key = "eth_market_data"
    if not hasattr(get_eth_market_data, "_cache"):
        get_eth_market_data._cache = {}

    cached = get_eth_market_data._cache.get(cache_key)
    if cached and (datetime.now(timezone.utc) - cached["ts"]).total_seconds() < 60:
        return cached["data"]

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.coingecko.com/api/v3/simple/price"
            "?ids=ethereum&vs_currencies=usd"
            "&include_24hr_change=true"
            "&include_market_cap=true"
        )
        resp.raise_for_status()
        data = resp.json()

    get_eth_market_data._cache[cache_key] = {
        "data": data,
        "ts": datetime.now(timezone.utc),
    }
    return data


# ─────────────────────────────────────────
# ROUTES — NETWORK DASHBOARD (Dune-powered)
# ─────────────────────────────────────────

# In-memory cache for Dune reads. Reads are cheap (latest-results endpoint),
# but caching avoids repeat round-trips on every dashboard load.
_network_cache: dict = {}
_NETWORK_TTL_SECS = 600  # 10 min
_copy_moves_cache: dict = {}
_COPY_MOVES_TTL_SECS = 300  # 5 min — Etherscan-backed, refresh often


async def _cached_dune(key: str, query_id: int, limit: int):
    entry = _network_cache.get(key)
    if entry and (datetime.now(timezone.utc) - entry["ts"]).total_seconds() < _NETWORK_TTL_SECS:
        return entry["rows"]
    rows = await dune.get_latest_results(query_id, limit=limit)
    if rows:  # only overwrite cache with real data; keep stale on empty
        _network_cache[key] = {"rows": rows, "ts": datetime.now(timezone.utc)}
        return rows
    return entry["rows"] if entry else []


@app.get("/api/network/pulse")
async def network_pulse():
    """24h Ethereum network vitals from Dune."""
    rows = await _cached_dune("pulse", dune.QUERY_NETWORK_PULSE, limit=1)
    if not rows:
        return success({"pulse": None, "available": False})
    r = rows[0]
    return success({
        "available": True,
        "pulse": {
            "txns_24h": r.get("txns_24h"),
            "active_senders": r.get("active_senders"),
            "median_gas_gwei": round(r.get("median_gas_gwei") or 0, 2),
            "total_fees_usd": r.get("total_fees_usd"),
            "total_fees_eth": round(r.get("total_fees_eth") or 0, 2),
        },
    })


@app.get("/api/network/top-tokens")
async def network_top_tokens():
    """Top tokens by 24h DEX volume on Ethereum."""
    rows = await _cached_dune("top_tokens", dune.QUERY_TOP_TOKENS, limit=20)
    majors = {"WETH", "ETH", "WBTC", "weETH", "wstETH", "cbBTC", "tBTC", "LBTC"}
    tokens = [{
        "symbol": r.get("symbol"),
        "address": r.get("token_address"),
        "trades": r.get("trades"),
        "buyers": r.get("distinct_buyers"),
        "volume_usd": r.get("volume_usd"),
        "is_major": r.get("symbol") in majors,
    } for r in rows]
    return success({"tokens": tokens, "available": bool(tokens)})


@app.get("/api/network/large-trades")
async def network_large_trades():
    """
    Largest whale DEX trades (24h), cross-referenced against Sentinel's tracked
    wallets so users see big moves *in context* of wallets they follow.
    """
    rows = await _cached_dune("large_trades", dune.QUERY_WHALE_TRADES, limit=30)
    if not rows:
        return success({"trades": [], "available": False})

    # Map trader addresses to our tracked wallets (label + score) in one query.
    traders = list({(r.get("trader") or "").lower() for r in rows if r.get("trader")})
    tracked: dict[str, dict] = {}
    if traders:
        try:
            for i in range(0, len(traders), 50):
                chunk = traders[i:i + 50]
                res = (
                    supabase_client.table("wallets")
                    .select("address, label, score")
                    .in_("address", chunk)
                    .execute()
                )
                for w in res.data or []:
                    tracked[(w.get("address") or "").lower()] = w
        except Exception:
            pass

    trades = []
    for r in rows:
        addr = (r.get("trader") or "").lower()
        match = tracked.get(addr)
        trades.append({
            "time": r.get("block_time"),
            "tx_hash": r.get("tx_hash"),
            "trader": r.get("trader"),
            "sold": r.get("token_sold_symbol"),
            "bought": r.get("token_bought_symbol"),
            "pair": r.get("token_pair"),
            "amount_usd": r.get("amount_usd"),
            "project": r.get("project"),
            "is_tracked": bool(match),
            "trader_label": match.get("label") if match else None,
            "trader_score": match.get("score") if match else None,
        })
    return success({"trades": trades, "available": True})


# ─────────────────────────────────────────
# ROUTES — PRO WAITLIST (early-access capture; Stripe billing later)
# ─────────────────────────────────────────

import re as _re

_EMAIL_RE = _re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.post("/api/waitlist")
async def join_waitlist(request: WaitlistRequest, background_tasks: BackgroundTasks):
    """Capture a Pro early-access signup. Stores email in Supabase and sends a
    welcome email via Resend (best-effort, in the background)."""
    email = (request.email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        return error("INVALID_EMAIL", "Please enter a valid email address.", status_code=400)
    try:
        supabase_client.table("waitlist").upsert(
            {
                "email": email,
                "source": (request.source or "app")[:80],
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="email",
        ).execute()

        # Fire the welcome email in the background — never block or fail the signup.
        from integrations import resend
        if resend.is_configured():
            background_tasks.add_task(
                resend.send_email,
                email,
                "You're on the Sentinel Pro waitlist 🎉",
                resend.waitlist_welcome_html(),
            )

        return success({"joined": True, "email": email, "emailed": resend.is_configured()})
    except Exception as e:
        # Table may not exist yet — surface a clear, non-crashing error.
        return error(
            "WAITLIST_UNAVAILABLE",
            "Could not save your signup right now. Please try again shortly.",
            status_code=503,
            details={"reason": str(e)[:160]},
        )


@app.get("/api/admin/waitlist-count", dependencies=[Depends(require_admin)])
async def waitlist_count():
    """Founder view: how many Pro early-access signups so far."""
    try:
        res = supabase_client.table("waitlist").select("email", count="exact").execute()
        return success({"count": res.count if res.count is not None else len(res.data or [])})
    except Exception as e:
        return error("WAITLIST_UNAVAILABLE", "Waitlist table not available.", status_code=503, details={"reason": str(e)[:160]})


# ─────────────────────────────────────────
# ROUTES — NEWS INTELLIGENCE
# ─────────────────────────────────────────

@app.get("/api/news")
async def list_news(
    category: Optional[str] = None,
    source: Optional[str] = None,
    sort: str = "recent",  # recent | importance
    limit: int = 40,
):
    """Scored news feed. Heuristic scores only — no Claude here."""
    try:
        order_col = "importance_score" if sort == "importance" else "published_at"
        q = (
            supabase_client.table("news")
            .select(
                "id, title, summary, source, url, published_at, category, sentiment, "
                "bull_score, importance_score, ethereum_relevance, affected_tokens"
            )
            .order(order_col, desc=True)
            .limit(min(max(limit, 1), 100))
        )
        if category and category not in ("All News", "All"):
            if category == "Ethereum":
                q = q.gte("ethereum_relevance", 30)
            else:
                q = q.eq("category", category)
        if source:
            q = q.eq("source", source)
        res = q.execute()
        return success({"articles": res.data or []})
    except Exception as e:
        return error("NEWS_UNAVAILABLE", "News feed not available yet.", status_code=503, details={"reason": str(e)[:160]})


@app.get("/api/news/pulse")
async def news_pulse():
    """Market Pulse: sentiment split, fear/greed-style meter, ETH sentiment, top narrative."""
    try:
        res = (
            supabase_client.table("news")
            .select("sentiment, bull_score, importance_score, ethereum_relevance, category, title, affected_tokens, source")
            .order("published_at", desc=True)
            .limit(120)
            .execute()
        )
        arts = res.data or []
        if not arts:
            return success({"available": False})

        bullish = sum(1 for a in arts if "Bull" in (a.get("sentiment") or ""))
        bearish = sum(1 for a in arts if "Bear" in (a.get("sentiment") or ""))
        neutral = len(arts) - bullish - bearish

        # Importance-weighted sentiment meter (0-100, fear→greed)
        wsum = sum((a.get("importance_score") or 1) for a in arts) or 1
        meter = round(sum((a.get("bull_score") or 50) * (a.get("importance_score") or 1) for a in arts) / wsum)

        eth_arts = [a for a in arts if (a.get("ethereum_relevance") or 0) >= 30]
        eth_sentiment = round(sum(a.get("bull_score") or 50 for a in eth_arts) / len(eth_arts)) if eth_arts else None

        # Top narrative = most-mentioned token among higher-importance stories
        from collections import Counter
        tok = Counter()
        for a in arts:
            if (a.get("importance_score") or 0) >= 40:
                for t in (a.get("affected_tokens") or []):
                    tok[t] += 1
        top_token = tok.most_common(1)[0][0] if tok else None
        top_headline = max(arts, key=lambda a: a.get("importance_score") or 0).get("title")

        return success({
            "available": True,
            "total": len(arts),
            "bullish": bullish,
            "bearish": bearish,
            "neutral": neutral,
            "sentiment_meter": meter,  # 0=extreme fear, 100=extreme greed
            "eth_sentiment": eth_sentiment,
            "top_token": top_token,
            "top_headline": top_headline,
            "eth_relevant_count": len(eth_arts),
        })
    except Exception as e:
        return error("NEWS_UNAVAILABLE", "News pulse not available yet.", status_code=503, details={"reason": str(e)[:160]})


async def _news_wallet_reactions(tokens: list[str]) -> list[dict]:
    """Recent large on-chain DEX moves in the article's affected tokens, from the
    cached Dune whale-trades feed. Correlated activity — not claimed causation."""
    if not tokens:
        return []
    toks = {t.upper() for t in tokens}
    if "ETH" in toks:
        toks.add("WETH")  # ETH article → also surface WETH moves
    try:
        rows = await _cached_dune("large_trades", dune.QUERY_WHALE_TRADES, limit=30)
    except Exception:
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for r in rows:
        bought = (r.get("token_bought_symbol") or "").upper()
        sold = (r.get("token_sold_symbol") or "").upper()
        if bought in toks:
            side, action, tok = "buy", "bought", bought
        elif sold in toks:
            side, action, tok = "sell", "sold", sold
        else:
            continue
        trader = r.get("trader") or ""
        if trader in seen:
            continue
        seen.add(trader)
        usd = r.get("amount_usd") or 0
        amt = f"${usd / 1e6:.2f}M" if usd >= 1e6 else f"${usd / 1e3:.0f}K"
        out.append({
            "label": f"{trader[:6]}…{trader[-4:]}" if trader else "Whale",
            "side": side,
            "action": f"{action} {tok}",
            "amount": amt,
        })
        if len(out) >= 6:
            break
    return out


@app.get("/api/news/{article_id}")
async def get_news_article(article_id: str):
    """Single article with on-demand AI deep-dive (high-impact only, cached) +
    whale reactions in the affected tokens."""
    try:
        res = supabase_client.table("news").select("*").eq("id", article_id).limit(1).execute()
        if not res.data:
            return error("NOT_FOUND", "Article not found.", status_code=404)
        a = res.data[0]

        # AI deep-dive: only for high-impact stories, only once (cached in the row).
        if not a.get("ai_summary") and (a.get("importance_score") or 0) >= 60:
            try:
                from ai.news_analyst import analyze_news
                analysis = await analyze_news(
                    a["title"], a.get("summary") or "", a.get("affected_tokens") or []
                )
                if analysis and analysis.get("executive_summary"):
                    ai_fields = {
                        "ai_summary": analysis.get("executive_summary"),
                        "bull_thesis": analysis.get("bull_thesis"),
                        "bear_thesis": analysis.get("bear_thesis"),
                        "market_impact": analysis.get("market_impact"),
                        "confidence": analysis.get("confidence"),
                        "ai_generated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    a.update(ai_fields)
                    supabase_client.table("news").update(ai_fields).eq("id", article_id).execute()
            except Exception:
                pass

        a["wallet_reactions"] = await _news_wallet_reactions(a.get("affected_tokens") or [])
        return success({"article": a})
    except Exception as e:
        return error("NEWS_UNAVAILABLE", "Article not available.", status_code=503, details={"reason": str(e)[:160]})


@app.post("/api/admin/ingest-news", dependencies=[Depends(require_admin)])
async def ingest_news():
    """Fetch + score the latest news from all RSS sources (no Claude)."""
    try:
        from news.ingestor import ingest_all
        stats = await ingest_all(supabase_client)
        return success(stats)
    except Exception as e:
        return error("INGEST_FAILED", str(e), status_code=500)


async def _cron_news():
    """Refresh the news feed every 30 minutes (heuristic only, zero Claude)."""
    await asyncio.sleep(45)  # startup grace
    while True:
        try:
            from news.ingestor import ingest_all
            await ingest_all(supabase_client)
        except Exception:
            pass
        await asyncio.sleep(30 * 60)


async def _cron_dune_refresh():
    """Refresh Dune executions every 6h (≈4 cycles/day × ~2.4 credits = tiny)."""
    await asyncio.sleep(120)  # startup grace
    while True:
        if dune.is_configured():
            for qid in dune.ALL_QUERY_IDS:
                try:
                    await dune.trigger_execution(qid)
                    await asyncio.sleep(2)
                except Exception:
                    pass
        await asyncio.sleep(6 * 3600)


def _build_copy_suggestion(tx: dict, wallet: dict, signal: str | None) -> dict | None:
    """Map a whale on-chain move to an actionable copy-trade for the Invest UI."""
    value = float(tx.get("value") or 0)
    if value < 5:
        return None

    direction = tx.get("direction", "unknown")
    sig = (signal or wallet.get("signal") or "NEUTRAL").upper()

    if direction == "out":
        whale_action = f"Sent {value:,.2f} ETH"
        if sig == "BEARISH":
            from_t, to_t = "ETH", "USDC"
            reason = "Whale taking profit → mirror into stables"
        else:
            from_t, to_t = "ETH", "WETH"
            reason = "Whale deploying capital → mirror position"
    elif direction == "in":
        whale_action = f"Received {value:,.2f} ETH"
        from_t, to_t = "USDC", "ETH"
        reason = "Whale accumulating ETH → mirror buy"
    else:
        return None

    suggested = round(min(max(value * 0.01, 0.01), 2.0), 4)

    return {
        "id": tx.get("hash") or f"{wallet.get('address')}-{tx.get('timestamp')}",
        "whaleLabel": wallet.get("label") or "Unknown whale",
        "whaleAddress": wallet.get("address"),
        "whaleScore": wallet.get("score") or 0,
        "signal": sig,
        "whaleAction": whale_action,
        "suggestedFrom": from_t,
        "suggestedTo": to_t,
        "suggestedAmount": suggested,
        "copyPct": 1,
        "reason": reason,
        "timestamp": tx.get("timestamp"),
        "txHash": tx.get("hash"),
    }


@app.get("/api/invest/whale-trades")
async def get_whale_trades():
    """
    Recent significant whale moves with suggested copy-trades for the Invest page.
    Non-custodial: suggestions only — user executes via MetaMask.
    """
    try:
        tx_rows = (
            supabase_client.table("transactions")
            .select("hash, timestamp, value, value_symbol, direction, wallet_id")
            .order("timestamp", desc=True)
            .limit(80)
            .execute()
        )
        txs = tx_rows.data or []
        if not txs:
            return success({"trades": [], "count": 0})

        wallet_ids = list({t["wallet_id"] for t in txs if t.get("wallet_id")})
        wallets_by_id: dict = {}
        if wallet_ids:
            w_rows = (
                supabase_client.table("wallets")
                .select("id, address, label, score")
                .in_("id", wallet_ids)
                .execute()
            )
            wallets_by_id = {w["id"]: w for w in (w_rows.data or [])}

        signals_by_wallet = fetch_latest_analyses(wallet_ids)

        trades: list[dict] = []
        seen_whales: set[str] = set()

        for tx in txs:
            wid = tx.get("wallet_id")
            wallet = wallets_by_id.get(wid)
            if not wallet:
                continue

            # One copy suggestion per whale (most recent move)
            addr = wallet.get("address", "")
            if addr in seen_whales:
                continue

            analysis = signals_by_wallet.get(wid) or {}
            signal = analysis.get("signal")

            suggestion = _build_copy_suggestion(tx, wallet, signal)
            if not suggestion:
                continue

            seen_whales.add(addr)
            trades.append(suggestion)
            if len(trades) >= 12:
                break

        return success({"trades": trades, "count": len(trades)})
    except Exception as e:
        return error("WHALE_TRADES_FAILED", str(e), status_code=500)


# ─────────────────────────────────────────
# ROUTES — COPY TRADING INTELLIGENCE
# ─────────────────────────────────────────
# COPY TRADING — ranked DEX traders (Supabase → JSON fallback)
# ─────────────────────────────────────────

_copy_trading_cache: dict = {"loaded_at": None, "source": None, "freshness": None}

# Credibility guards for the ranked leaderboard:
#  - MIN_TRUSTED_TRADES: a wallet needs this many completed trades before its
#    win-rate / profit-factor are trustworthy (blocks 11-trade "100% win" flukes).
#  - PF_DISPLAY_CAP: profit factor is capped for display so the ranker's "no
#    realized losses" sentinel (999) and absurd values never show to users.
MIN_TRUSTED_TRADES = 25
PF_DISPLAY_CAP = 50.0


def _load_copy_trading_wallets() -> list[dict]:
    """Load ranked copy-trading candidates — DB primary, JSON fallback."""
    wallets = load_copy_traders()
    meta = copy_traders_meta()
    _copy_trading_cache["loaded_at"] = meta.get("loaded_at")
    _copy_trading_cache["source"] = meta.get("source")
    return wallets


def _invalidate_copy_trading_cache() -> None:
    invalidate_copy_traders_cache()
    _copy_trading_cache["loaded_at"] = None
    _copy_trading_cache["source"] = None
    _copy_trading_cache["freshness"] = None


def _find_copy_trader(address: str) -> dict | None:
    return find_copy_trader_by_address(address)


def _copy_trader_label(trader: dict) -> str:
    rank = trader.get("rank")
    label = trader.get("label") or ""
    if label.startswith("Dune DEX Trader") or not label.strip():
        return f"DEX Trader #{rank}" if rank else "DEX Trader"
    return label


# ── Copy-trader recency ──────────────────────────────────────────────
# The ranked dataset is a periodic Dune export, so each wallet's `last_trade`
# is frozen at export time. Measuring "recently active" against wall-clock now
# would mark the whole list stale once the export ages. Instead we anchor
# recency to the dataset's own freshness (its newest trade), which correctly
# flags wallets that went quiet *relative to their peers* and stays stable
# between exports.

def _parse_trade_ts(ts) -> datetime | None:
    if not ts:
        return None
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    s = str(ts).strip().replace(" UTC", "").replace("T", " ")
    if "." in s:
        s = s.split(".")[0]
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _copy_dataset_freshness() -> datetime | None:
    """Newest last_trade across the loaded dataset (memoized per cache load)."""
    cached = _copy_trading_cache.get("freshness")
    if cached is not None:
        return cached if cached != "none" else None
    newest: datetime | None = None
    for w in _load_copy_trading_wallets():
        dt = _parse_trade_ts((w.get("on_chain_data") or {}).get("last_trade"))
        if dt and (newest is None or dt > newest):
            newest = dt
    _copy_trading_cache["freshness"] = newest or "none"
    return newest


def _last_active_days(wallet: dict, ref: datetime | None = None) -> int | None:
    """Days since this wallet's last trade, measured against dataset freshness."""
    ref = ref or _copy_dataset_freshness()
    if ref is None:
        return None
    dt = _parse_trade_ts((wallet.get("on_chain_data") or {}).get("last_trade"))
    if dt is None:
        return None
    return max(0, (ref - dt).days)


def _filter_copy_traders(
    wallets: list[dict],
    *,
    min_win_rate: float = 0,
    min_profit_factor: float = 0,
    min_track_days: int = 0,
    max_drawdown: float | None = None,
    max_inactive_days: int | None = None,
    qualified_only: bool = True,
    strict: bool = False,
) -> list[dict]:
    """
    Filter copy-trading wallets.
    qualified_only: exclude MEV/arb bots (>100 trades/day) — dataset is already pre-ranked.
    strict: apply trader-quality thresholds (60% WR, 2.0 PF, 90d track, 45d activity).
    max_inactive_days: drop wallets that went quiet relative to dataset freshness
        (and wallets missing a last_trade timestamp entirely).
    """
    if strict:
        min_win_rate = max(min_win_rate, 60)
        min_profit_factor = max(min_profit_factor, 2.0)
        min_track_days = max(min_track_days, 90)
        if max_drawdown is None:
            max_drawdown = 20
        if max_inactive_days is None:
            max_inactive_days = 45

    ref = _copy_dataset_freshness() if max_inactive_days is not None else None
    # If the dataset carries no last_trade timestamps at all (ref is None), recency
    # is unmeasurable — disable the recency filter rather than excluding everything.
    recency_enabled = max_inactive_days is not None and ref is not None

    # Require enough completed trades before trusting win-rate / profit-factor, so
    # thin-sample "100% win / 999 PF" flukes don't dominate the leaderboard.
    min_trade_count = MIN_TRUSTED_TRADES if strict else 0

    filtered = []
    for w in wallets:
        if is_exchange_trader(w):
            continue

        m = w.get("metrics") or {}
        oc = w.get("on_chain_data") or {}
        tpd = float(oc.get("trades_per_day") or 0)

        if qualified_only and tpd > 100:
            continue

        wr = float(m.get("win_rate_pct") or 0)
        pf = float(m.get("profit_factor") or 0)
        tr = int(m.get("track_record_days") or 0)
        dd = m.get("max_drawdown_pct")
        tc = int(m.get("trade_count") or oc.get("total_trades") or 0)

        if wr < min_win_rate or pf < min_profit_factor or tr < min_track_days:
            continue
        if min_trade_count and tc < min_trade_count:
            continue
        if max_drawdown is not None and dd is not None and float(dd) > max_drawdown:
            continue
        if recency_enabled:
            age = _last_active_days(w, ref)
            # No timestamp = can't prove recent activity → exclude under recency filter.
            if age is None or age > max_inactive_days:
                continue
        filtered.append(w)
    return filtered


def _sort_copy_traders(wallets: list[dict], sort: str) -> list[dict]:
    if sort == "recency":
        ref = _copy_dataset_freshness()
        # Most recently active first; unknown activity sinks to the bottom.
        return sorted(
            wallets,
            key=lambda w: (-(_last_active_days(w, ref) if _last_active_days(w, ref) is not None else 10_000),
                           float(w.get("copy_trading_score") or 0)),
            reverse=True,
        )
    key_map = {
        "copy_score": lambda w: float(w.get("copy_trading_score") or 0),
        "win_rate": lambda w: float((w.get("metrics") or {}).get("win_rate_pct") or 0),
        "profit_factor": lambda w: float((w.get("metrics") or {}).get("profit_factor") or 0),
        "track_record": lambda w: int((w.get("metrics") or {}).get("track_record_days") or 0),
        "drawdown": lambda w: float((w.get("metrics") or {}).get("max_drawdown_pct") or 999),
        "duration": lambda w: float((w.get("metrics") or {}).get("avg_trade_duration_hrs") or 0),
    }
    if sort == "copy_score":
        # Score primary, but a recently-active wallet edges out a slightly-stale
        # peer at a near-identical score so the top of the list never looks dead.
        ref = _copy_dataset_freshness()

        def _score_recency(w):
            age = _last_active_days(w, ref)
            recency_bonus = 0.0
            if age is not None:
                recency_bonus = max(0.0, 1.0 - age / 90.0)  # 0..1 over a 90d window
            return (float(w.get("copy_trading_score") or 0), recency_bonus)

        return sorted(wallets, key=_score_recency, reverse=True)
    fn = key_map.get(sort, key_map["copy_score"])
    reverse = sort != "drawdown"
    return sorted(wallets, key=fn, reverse=reverse)


def _enrich_copy_trader(wallet: dict) -> dict:
    """Attach performance sparkline and human-readable label for list/detail views."""
    metrics_meta = dict(wallet.get("metrics_meta") or {})
    metrics, est_meta = estimate_supplemental_metrics(
        wallet.get("metrics") or {},
        wallet.get("on_chain_data") or {},
    )
    for k, v in est_meta.items():
        metrics_meta.setdefault(k, v)

    sparkline, return_pct = build_copy_trader_sparkline({**wallet, "metrics": metrics})
    if wallet.get("pnl_sparkline"):
        metrics_meta.setdefault("performance_sparkline", "on_chain")

    # Clamp profit factor for display so the ranker's 999 "no-losses" sentinel
    # (and other absurd values) never surface as a fake-looking number.
    metrics = dict(metrics)
    raw_pf = metrics.get("profit_factor")
    if raw_pf is not None and float(raw_pf) > PF_DISPLAY_CAP:
        metrics["profit_factor"] = PF_DISPLAY_CAP
        metrics_meta["profit_factor"] = "capped"

    out = {**wallet, "metrics": metrics}
    out["performance_sparkline"] = sparkline
    out["estimated_return_pct"] = return_pct if return_pct is not None else wallet.get("estimated_return_pct")
    if metrics_meta:
        out["metrics_meta"] = metrics_meta
    out["label"] = _copy_trader_label(wallet)

    # Flag thin-sample wallets so the UI can show a "small sample" caveat.
    trade_count = int(metrics.get("trade_count") or (wallet.get("on_chain_data") or {}).get("total_trades") or 0)
    out["trade_count"] = trade_count
    out["small_sample"] = 0 < trade_count < MIN_TRUSTED_TRADES

    # Recency surface: days since last trade (vs dataset freshness) + last_trade passthrough.
    last_active = _last_active_days(wallet)
    out["last_active_days"] = last_active
    out["last_trade"] = (wallet.get("on_chain_data") or {}).get("last_trade")
    out["is_recently_active"] = last_active is not None and last_active <= 14
    return out


# ─────────────────────────────────────────
# ROUTES — TRUST PULSE (detected wins ledger)
# ─────────────────────────────────────────

@limiter.limit("60/minute")
@app.get("/api/trust-pulse")
async def trust_pulse(request: Request):
    """Public stats: on-chain moves detected + 24h scored wins."""
    data = await get_trust_pulse()
    return success(data)


@limiter.limit("60/minute")
@app.get("/api/detected-wins")
async def detected_wins(request: Request, limit: int = 20):
    """Recent scored WIN moves from the detected_moves ledger."""
    pulse = await get_trust_pulse()
    wins = (pulse.get("recent_wins") or [])[: min(limit, 50)]
    return success({
        "wins": wins,
        "last_24h": pulse.get("last_24h"),
        "last_7d": pulse.get("last_7d"),
        "methodology": pulse.get("methodology"),
        "updated_at": pulse.get("updated_at"),
    })


@limiter.limit("60/minute")
@app.get("/api/trust-pulse/pending")
async def trust_pulse_pending(request: Request, limit: int = 40):
    """Live preview of PENDING moves — current return vs detection price."""
    data = await get_pending_preview(limit=min(limit, 50))
    return success(data)


@limiter.limit("60/minute")
@app.get("/api/trust-pulse/marketing")
async def trust_pulse_marketing(request: Request):
    """Polished stats + tweet hooks for GTM / customer demos."""
    data = await get_marketing_snapshot()
    return success(data)


@app.get("/api/trust/og.svg")
async def trust_og_image(request: Request):
    """Shareable 1200×630 stats card (SVG) for /wins — win rate, net P&L, sample."""
    m = await get_marketing_snapshot()
    d30 = m.get("stats_30d") or {}
    wr = d30.get("win_rate_pct")
    wins = d30.get("wins") or 0
    losses = d30.get("losses") or 0
    decisive = wins + losses
    net = d30.get("net_hypothetical_pnl_usd") or 0
    biggest = m.get("biggest_win") or {}
    big_pct = biggest.get("return_pct_24h")
    big_tok = biggest.get("token_bought") or biggest.get("token_sold") or ""

    wr_str = f"{wr:.0f}%" if (wr is not None and decisive >= 1) else "—"
    sample = f"{wins} of {decisive} scored moves · 30d" if decisive else "ledger building"
    net_str = f"{'+' if net >= 0 else '−'}${abs(net):,.0f}"
    big_str = f"+{float(big_pct):.1f}% on {big_tok}" if big_pct else "—"

    def esc(s: str) -> str:
        return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#050509"/>
  <circle cx="980" cy="120" r="380" fill="#00D992" opacity="0.06"/>
  <circle cx="200" cy="560" r="300" fill="#627EEA" opacity="0.05"/>
  <text x="80" y="110" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="700" fill="#EEEEF4">Hadaleum</text>
  <text x="80" y="150" font-family="JetBrains Mono,monospace" font-size="20" fill="#00D992" letter-spacing="2">LIVE · VERIFIED ON-CHAIN</text>
  <text x="80" y="300" font-family="Inter,Arial,sans-serif" font-size="150" font-weight="800" fill="#00D992">{esc(wr_str)}</text>
  <text x="80" y="350" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="600" fill="#EEEEF4">win rate on flagged copy-trader moves</text>
  <text x="80" y="392" font-family="Inter,Arial,sans-serif" font-size="24" fill="#9898A8">{esc(sample)}</text>
  <line x1="80" y1="450" x2="1120" y2="450" stroke="#8282C8" stroke-opacity="0.12"/>
  <text x="80"  y="510" font-family="Inter,Arial,sans-serif" font-size="22" fill="#606070">NET HYPOTHETICAL P&amp;L ($1K/move)</text>
  <text x="80"  y="556" font-family="JetBrains Mono,monospace" font-size="40" font-weight="700" fill="{'#00D992' if net >= 0 else '#EF4444'}">{esc(net_str)}</text>
  <text x="640" y="510" font-family="Inter,Arial,sans-serif" font-size="22" fill="#606070">BIGGEST DETECTED WIN</text>
  <text x="640" y="556" font-family="JetBrains Mono,monospace" font-size="40" font-weight="700" fill="#00D992">{esc(big_str)}</text>
  <text x="80" y="600" font-family="Inter,Arial,sans-serif" font-size="20" fill="#606070">hadaleum.com/wins · scored 24h later via CoinGecko · not financial advice</text>
</svg>"""
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300"},
    )


@app.post("/api/admin/run-trust-pipeline", dependencies=[Depends(require_admin)])
async def admin_run_trust_pipeline():
    """Ingest copy-trader swaps + score pending 24h outcomes (manual trigger)."""
    await _run_trust_pipeline_once()
    pulse = await get_trust_pulse()
    pending = await get_pending_preview()
    return success({
        "pulse": pulse,
        "pending_preview": pending,
        "marketing": await get_marketing_snapshot(),
    })


@app.get("/api/copy-trading/top")
async def copy_trading_top(
    limit: int = 50,
    offset: int = 0,
    sort: str = "copy_score",
    min_win_rate: float = 0,
    min_profit_factor: float = 0,
    min_track_days: int = 0,
    max_drawdown: float | None = None,
    max_inactive_days: int | None = None,
    qualified_only: bool = True,
    strict: bool = True,
):
    """
    Top-ranked DEX traders for copy-trading.
    Default strict=true: 60% WR, 2.0 PF, 90d track, max 20% drawdown when known,
    and active within 45 days of the dataset's freshness (drops quiet wallets).
    Pass max_inactive_days to tighten/relax the activity window.
    """
    all_wallets = _load_copy_trading_wallets()
    pool = _filter_copy_traders(
        all_wallets,
        min_win_rate=min_win_rate,
        min_profit_factor=min_profit_factor,
        min_track_days=min_track_days,
        max_drawdown=max_drawdown,
        max_inactive_days=max_inactive_days,
        qualified_only=qualified_only,
        strict=strict,
    )

    pool = _sort_copy_traders(pool, sort)
    page_limit = max(1, min(limit, 300))
    page_offset = max(0, offset)
    page = pool[page_offset : page_offset + page_limit]
    enriched = [_enrich_copy_trader(w) for w in page]

    return success({
        "wallets": enriched,
        "count": len(enriched),
        "total_qualified": len(pool),
        "total_in_dataset": len(all_wallets),
        "stats_labels": [
            "Win Rate",
            "Profit Factor",
            "Max Drawdown",
            "Avg Duration",
            "Track Record",
        ],
        "source": _copy_trading_cache.get("source") or "ranker",
        "loaded_at": _copy_trading_cache.get("loaded_at"),
    })


@app.get("/api/copy-trading/featured")
async def copy_trading_featured():
    """Top 3 elite copy traders for hero cards — strict quality filters."""
    pool = _sort_copy_traders(
        _filter_copy_traders(_load_copy_trading_wallets(), qualified_only=True, strict=True),
        "copy_score",
    )[:3]
    enriched = [_enrich_copy_trader(w) for w in pool]
    return success({
        "traders": enriched,
        "count": len(enriched),
        "loaded_at": _copy_trading_cache.get("loaded_at"),
    })


@limiter.limit("10/minute")
@app.get("/api/copy-trading/recent-moves")
async def copy_trading_recent_moves(request: Request, limit: int = 15):
    """
    Recent DEX swaps from top ranked copy traders — no whale/$250k gate.
    Scans latest on-chain token transfers for elite traders (Etherscan).
    """
    limit = max(1, min(limit, 30))
    cache_key = f"moves_{limit}"
    entry = _copy_moves_cache.get(cache_key)
    if entry and (datetime.now(timezone.utc) - entry["ts"]).total_seconds() < _COPY_MOVES_TTL_SECS:
        moves = entry["moves"]
        return success({
            "moves": moves,
            "count": len(moves),
            "available": bool(moves),
            "source": "etherscan",
            "cached": True,
        })

    all_wallets = _load_copy_trading_wallets()
    pool = _sort_copy_traders(
        _filter_copy_traders(
            all_wallets,
            min_win_rate=60,
            min_profit_factor=2,
            min_track_days=90,
            qualified_only=True,
            strict=True,
        ),
        "copy_score",
    )
    enriched_pool = [_enrich_copy_trader(w) for w in pool[:50]]

    # Best-effort live ETH price (cached 60s); falls back to the module constant.
    eth_usd = 3500.0
    try:
        eth_usd = float((await get_eth_market_data())["ethereum"]["usd"]) or eth_usd
    except Exception:
        pass

    served_stale = False
    try:
        moves = await fetch_recent_copy_moves(
            enriched_pool,
            limit=limit,
            traders_to_scan=40,
            transfer_limit=25,
            eth_usd=eth_usd,
        )
    except Exception as e:
        log_error("recent_moves_fetch_failed", error=str(e)[:200])
        moves = entry["moves"] if entry else []
        served_stale = bool(entry)

    if moves and not served_stale:
        _copy_moves_cache[cache_key] = {"moves": moves, "ts": datetime.now(timezone.utc)}

    return success({
        "moves": moves,
        "count": len(moves),
        "available": bool(moves),
        "source": "etherscan",
        "cached": served_stale,
    })


@app.get("/api/copy-trading/{address}")
async def copy_trading_detail(address: str):
    """Full copy-trader profile by address."""
    addr = address.strip().lower()
    for w in _load_copy_trading_wallets():
        if (w.get("address") or "").lower() == addr:
            enriched = _enrich_copy_trader(w)
            try:
                enriched["eth_balance"] = await get_eth_balance(addr)
            except Exception:
                enriched["eth_balance"] = None
            oc = enriched.get("on_chain_data") or {}
            enriched["capital_note"] = (
                "Copy traders are ranked by DEX trading performance, not ETH balance. "
                "Most keep capital in USDC/WETH/tokens between trades — low native ETH is normal."
            )
            if oc.get("total_volume_usd"):
                enriched["trading_volume_usd"] = oc["total_volume_usd"]
            elif oc.get("avg_trade_usd") and oc.get("total_trades"):
                enriched["trading_volume_usd"] = round(
                    float(oc["avg_trade_usd"]) * int(oc["total_trades"]), 2
                )
            return success({"wallet": enriched})
    return error("NOT_FOUND", "Copy trader not found", status_code=404)


@app.get("/api/copy-trading/{address}/metrics")
async def copy_trading_live_metrics(address: str):
    """
    Compute real on-chain copy-trading metrics (incl. Max Drawdown and Avg
    Trade Duration) for a single wallet, on demand. Fills the metrics the
    offline Dune dataset leaves null.
    """
    addr = address.strip().lower()
    if not _re.match(r"^0x[a-f0-9]{40}$", addr):
        return error("BAD_ADDRESS", "Invalid Ethereum address", status_code=400)
    try:
        from copy_trading_live import compute_live_metrics
        metrics = await compute_live_metrics(addr)
    except Exception as e:
        return error("METRICS_FAILED", str(e), status_code=500)
    if not metrics:
        return success({"metrics": None, "available": False})
    return success({"metrics": metrics, "available": True})


@app.post("/api/copy-trading/{address}/track")
@limiter.limit("20/minute")
async def track_copy_trader(request: Request, address: str, background_tasks: BackgroundTasks):
    """
    Add a ranked copy trader to the watchlist.
    Returns immediately after persisting a stub row; full scan + AI run in background.
    """
    try:
        addr = (address or "").strip().lower()
        if not re.match(r"^0x[a-f0-9]{40}$", addr):
            return error("BAD_ADDRESS", "Invalid Ethereum address", status_code=400)

        trader = _find_copy_trader(addr)
        if not trader:
            return error("NOT_FOUND", "Copy trader not found in ranked dataset", status_code=404)

        label = _copy_trader_label(trader)
        tags = list(dict.fromkeys((trader.get("tags") or []) + ["copy-trading", "dex-trader", "user-tracked"]))
        chain = "ethereum"

        existing = (
            supabase_client.table("wallets")
            .select("id, address, label, tags, chain, score, balance, last_scanned")
            .eq("address", addr)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
            merged_tags = list(dict.fromkeys((row.get("tags") or []) + tags))
            if merged_tags != (row.get("tags") or []):
                supabase_client.table("wallets").update({"tags": merged_tags}).eq("address", addr).execute()
                row = {**row, "tags": merged_tags}
            if not row.get("last_scanned") and addr not in _track_scans_pending:
                _track_scans_pending.add(addr)
                background_tasks.add_task(_background_track_scan, addr, label, chain, tags)
            try:
                enriched = _enrich_copy_trader({**trader, **row, "scan_status": "scanning" if not row.get("last_scanned") else "ready"})
            except Exception:
                enriched = {**trader, **row, "label": label, "scan_status": "scanning" if not row.get("last_scanned") else "ready"}
            return success({
                "wallet": enriched,
                "trader": _enrich_copy_trader(trader) if trader else trader,
                "already_tracked": True,
                "scan_status": "scanning" if not row.get("last_scanned") else "ready",
            })

        score_hint = int(float(trader.get("copy_trading_score") or trader.get("score") or 0))
        stub = {
            "address": addr,
            "label": label,
            "chain": chain,
            "tags": tags,
            "score": score_hint,
            "balance": 0,
        }
        try:
            inserted = supabase_client.table("wallets").insert(stub).execute()
            row = inserted.data[0]
        except Exception as e:
            retry = supabase_client.table("wallets").select("*").eq("address", addr).execute()
            if retry.data:
                row = retry.data[0]
            else:
                log_error("track_insert_failed", address=addr, error=str(e))
                return error(
                    "TRACK_FAILED",
                    "Could not save wallet to watchlist. Check database connection and try again.",
                    status_code=500,
                    details={"reason": str(e)[:200]},
                )

        if addr not in _track_scans_pending:
            _track_scans_pending.add(addr)
            background_tasks.add_task(_background_track_scan, addr, label, chain, tags)
        try:
            enriched = _enrich_copy_trader({**trader, **row, "scan_status": "scanning"})
            trader_out = _enrich_copy_trader(trader)
        except Exception:
            enriched = {**trader, **row, "label": label, "scan_status": "scanning"}
            trader_out = {**trader, "label": label}
        return success({
            "wallet": enriched,
            "trader": trader_out,
            "already_tracked": False,
            "scan_status": "scanning",
        })
    except Exception as exc:
        log_error("track_unhandled", address=address, error=str(exc))
        return error(
            "TRACK_FAILED",
            "Could not add trader to watchlist. Please try again.",
            status_code=500,
            details={"reason": str(exc)[:200]},
        )


@app.get("/api/transactions/latest")
async def latest_transactions(limit: int = 15):
    """Most recent on-chain moves across Sentinel's tracked watchlist."""
    try:
        tx_rows = (
            supabase_client.table("transactions")
            .select("hash, timestamp, value, value_symbol, direction, status, wallet_id")
            .order("timestamp", desc=True)
            .limit(max(1, min(limit, 50)))
            .execute()
        )
        txs = tx_rows.data or []
        if not txs:
            return success({"transactions": [], "count": 0})

        wallet_ids = list({t["wallet_id"] for t in txs if t.get("wallet_id")})
        wallets_by_id: dict = {}
        if wallet_ids:
            w_rows = (
                supabase_client.table("wallets")
                .select("id, address, label, score")
                .in_("id", wallet_ids)
                .execute()
            )
            wallets_by_id = {w["id"]: w for w in (w_rows.data or [])}

        enriched = []
        for tx in txs:
            w = wallets_by_id.get(tx.get("wallet_id")) or {}
            enriched.append({
                **tx,
                "wallet_address": w.get("address"),
                "wallet_label": w.get("label"),
                "wallet_score": w.get("score"),
                "wallet_signal": w.get("signal"),
            })
        return success({"transactions": enriched, "count": len(enriched)})
    except Exception as e:
        return error("LATEST_TX_FAILED", str(e), status_code=500)
