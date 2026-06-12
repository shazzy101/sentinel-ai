"""
Copy-trader leaderboard storage — Supabase primary, JSON fallback.

All API routes should load wallets via load_copy_traders() so the product
uses one normalized dataset regardless of source.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from observability import log_error, log_info, log_warning

_DATA_DIR = Path(__file__).resolve().parent / "data"
_DEFAULT_JSON = _DATA_DIR / "copy_trading_top_wallets.json"
_CACHE_TTL_SECONDS = 30 * 60  # re-load ranked traders at most every 30 min

_EXCHANGE_KEYWORDS = (
    "binance", "coinbase", "kraken", "kucoin", "okx", "crypto.com", "gemini",
    "bitstamp", "huobi", "gate.io", "bitfinex", "bybit", "bitmex", "upbit",
    "poloniex", "bittrex", "hot wallet", "deposit funder", "mev bot", "bridge",
    "treasury", "multisig",
)

_cache: dict[str, Any] = {"data": None, "loaded_at": None, "source": None}


def invalidate_copy_traders_cache() -> None:
    _cache["data"] = None
    _cache["loaded_at"] = None
    _cache["source"] = None


def is_exchange_trader(wallet: dict) -> bool:
    label = (wallet.get("label") or "").lower()
    return any(kw in label for kw in _EXCHANGE_KEYWORDS)


def normalize_copy_trader(raw: dict, *, rank: int | None = None) -> dict:
    """Normalize Dune JSON, ranker JSON, or Supabase row to canonical API shape."""
    addr = (raw.get("address") or "").strip().lower()
    if not addr:
        raise ValueError("copy trader missing address")

    metrics_in = dict(raw.get("metrics") or {})
    # Ranker uses win_rate; Dune export uses win_rate_pct
    wr = metrics_in.get("win_rate_pct")
    if wr is None and metrics_in.get("win_rate") is not None:
        wr = metrics_in["win_rate"]
    metrics = {
        "win_rate_pct": wr,
        "unrealized_win_rate_pct": metrics_in.get("unrealized_win_rate_pct"),
        "profit_factor": metrics_in.get("profit_factor"),
        "max_drawdown_pct": metrics_in.get("max_drawdown_pct"),
        "avg_trade_duration_hrs": metrics_in.get("avg_trade_duration_hrs"),
        "track_record_days": metrics_in.get("track_record_days"),
        "trade_count": metrics_in.get("trade_count"),
        "net_pnl_usd": metrics_in.get("net_pnl_usd"),
        "gross_profit_usd": metrics_in.get("gross_profit_usd"),
        "gross_loss_usd": metrics_in.get("gross_loss_usd"),
    }

    oc = dict(raw.get("on_chain_data") or {})
    if not oc and metrics.get("trade_count"):
        tr_days = int(metrics.get("track_record_days") or 30)
        tc = int(metrics.get("trade_count") or 0)
        oc = {
            "total_trades": tc,
            "active_days": tr_days,
            "trades_per_day": round(tc / max(tr_days, 1), 2),
        }

    resolved_rank = rank if rank is not None else raw.get("rank") or raw.get("copy_trading_rank")
    score = raw.get("copy_trading_score")
    if score is None:
        score = raw.get("composite_score", 0)

    out: dict[str, Any] = {
        "rank": int(resolved_rank) if resolved_rank is not None else 0,
        "address": addr,
        "label": raw.get("label") or "",
        "chain": raw.get("chain") or "ethereum",
        "tags": list(raw.get("tags") or ["ethereum", "copy-trading", "dex-trader"]),
        "copy_trading_score": float(score or 0),
        "wallet_type": raw.get("wallet_type") or "DEX Trader",
        "source": raw.get("source") or "ranker",
        "metrics": metrics,
        "on_chain_data": oc,
    }

    if raw.get("pnl_sparkline"):
        out["pnl_sparkline"] = raw["pnl_sparkline"]
    if raw.get("estimated_return_pct") is not None:
        out["estimated_return_pct"] = raw["estimated_return_pct"]
    if raw.get("metrics_meta"):
        out["metrics_meta"] = raw["metrics_meta"]

    return out


def _load_json_file(path: Path | None = None) -> list[dict]:
    json_path = path or _DEFAULT_JSON
    if not json_path.exists():
        return []
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        return []
    normalized = []
    for i, row in enumerate(data):
        try:
            rank = row.get("rank") or row.get("copy_trading_rank") or (i + 1)
            normalized.append(normalize_copy_trader(row, rank=int(rank)))
        except ValueError:
            continue
    normalized.sort(key=lambda w: w.get("rank") or 999999)
    return normalized


def _load_from_supabase() -> list[dict] | None:
    try:
        from db.supabase import supabase_client

        # Supabase/PostgREST caps each response at ~1000 rows regardless of
        # .limit(), so page through with .range() until a short page is returned.
        page_size = 1000
        max_rows = 10000  # safety ceiling
        rows: list[dict] = []
        start = 0
        while start < max_rows:
            res = (
                supabase_client.table("copy_traders")
                .select("*")
                .order("rank", desc=False)
                .range(start, start + page_size - 1)
                .execute()
            )
            page = res.data or []
            rows.extend(page)
            if len(page) < page_size:
                break  # last page
            start += page_size

        if not rows:
            return None
        log_info("copy_traders_loaded", source="supabase", count=len(rows))
        return [normalize_copy_trader(row) for row in rows]
    except Exception as e:
        log_error("copy_traders_supabase_load_failed", error=str(e)[:200])
        return None


def find_copy_trader_by_address(address: str) -> dict | None:
    """Resolve a copy trader by address — cache, then direct Supabase lookup."""
    addr = (address or "").strip().lower()
    if not addr:
        return None
    for w in load_copy_traders():
        if (w.get("address") or "").lower() == addr:
            return w
    try:
        from db.supabase import supabase_client

        res = (
            supabase_client.table("copy_traders")
            .select("*")
            .eq("address", addr)
            .limit(1)
            .execute()
        )
        if res.data:
            return normalize_copy_trader(res.data[0])
    except Exception:
        pass
    return None


def _cache_age_seconds() -> float | None:
    loaded = _cache.get("loaded_at")
    if not loaded:
        return None
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(loaded)).total_seconds()
    except ValueError:
        return None


def load_copy_traders(*, force_refresh: bool = False, json_path: Path | None = None) -> list[dict]:
    """Load ranked copy traders — memory cache (30-min TTL) → Supabase → JSON file."""
    age = _cache_age_seconds()
    if not force_refresh and _cache["data"] is not None and age is not None and age < _CACHE_TTL_SECONDS:
        log_info("copy_traders_cache_hit", source=_cache.get("source"), age_s=round(age))
        return _cache["data"]

    log_info("copy_traders_cache_miss", force=force_refresh, age_s=round(age) if age is not None else None)
    db_rows = _load_from_supabase()
    if db_rows:
        _cache["data"] = db_rows
        _cache["source"] = "supabase"
    else:
        log_warning("copy_traders_supabase_fallback_to_json")
        _cache["data"] = _load_json_file(json_path)
        _cache["source"] = "json"

    _cache["loaded_at"] = datetime.now(timezone.utc).isoformat()
    return _cache["data"]


def copy_traders_meta() -> dict[str, Any]:
    return {
        "loaded_at": _cache.get("loaded_at"),
        "source": _cache.get("source") or "unknown",
        "count": len(_cache.get("data") or []),
    }


def row_for_db(wallet: dict) -> dict:
    """Map canonical wallet to Supabase upsert row."""
    return {
        "address": wallet["address"],
        "rank": int(wallet.get("rank") or 0),
        "label": wallet.get("label") or "",
        "chain": wallet.get("chain") or "ethereum",
        "tags": wallet.get("tags") or [],
        "copy_trading_score": wallet.get("copy_trading_score") or 0,
        "wallet_type": wallet.get("wallet_type") or "DEX Trader",
        "source": wallet.get("source") or "ranker",
        "metrics": wallet.get("metrics") or {},
        "on_chain_data": wallet.get("on_chain_data") or {},
        "pnl_sparkline": wallet.get("pnl_sparkline"),
        "estimated_return_pct": wallet.get("estimated_return_pct"),
        "metrics_meta": wallet.get("metrics_meta") or {},
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }


def sync_copy_traders_to_db(wallets: list[dict] | None = None, *, json_path: Path | None = None) -> dict:
    """
    Upsert normalized wallets into Supabase copy_traders table.
    Returns summary dict with counts and errors.
    """
    from db.supabase import supabase_client

    source_wallets = wallets if wallets is not None else _load_json_file(json_path)
    if not source_wallets:
        return {"synced": 0, "error": "no wallets to sync"}

    now = datetime.now(timezone.utc).isoformat()
    synced = 0
    errors: list[str] = []

    batch_size = 100
    for i in range(0, len(source_wallets), batch_size):
        batch = source_wallets[i : i + batch_size]
        rows = []
        for w in batch:
            row = row_for_db(w)
            row["refreshed_at"] = now
            rows.append(row)
        try:
            supabase_client.table("copy_traders").upsert(rows, on_conflict="address").execute()
            synced += len(rows)
        except Exception as e:
            errors.append(str(e)[:200])

    invalidate_copy_traders_cache()
    load_copy_traders(force_refresh=True)
    return {"synced": synced, "total": len(source_wallets), "errors": errors}
