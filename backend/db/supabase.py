"""
Sentinel AI — Supabase Client
Connects to your Supabase project for persistent wallet + transaction storage.

Setup:
1. Create a free project at supabase.com
2. Add SUPABASE_URL and SUPABASE_KEY to your .env
3. Run the schema below in Supabase SQL editor
"""
import config  # noqa: F401 — load .env before reading Supabase credentials

import os
from datetime import datetime, timezone
from functools import lru_cache

try:
    from supabase import create_client, Client

    @lru_cache(maxsize=1)
    def get_supabase() -> Client:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY required in .env")
        return create_client(url, key)

    def reset_supabase_client() -> Client:
        """Clear cached client so startup picks up fresh .env credentials."""
        get_supabase.cache_clear()
        return get_supabase()

    supabase_client = get_supabase()

except Exception:
    # Graceful fallback if Supabase not configured yet
    class _MockClient:
        def table(self, name):
            return self
        def select(self, *args, **kwargs):
            return self
        def insert(self, *args, **kwargs):
            return self
        def order(self, *args, **kwargs):
            return self
        def limit(self, *args, **kwargs):
            return self
        def execute(self):
            class R:
                data = []
            return R()

    supabase_client = _MockClient()


# ─────────────────────────────────────────
# ANALYSIS CACHE HELPERS
# ─────────────────────────────────────────

async def get_cached_analysis(wallet_address: str) -> dict:
    """Return cached analysis if less than 6 hours old, else None."""
    try:
        result = (
            supabase_client.table("analyses")
            .select("*")
            .eq("wallet_address", wallet_address)
            .order("generated_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        cached = result.data[0]
        generated_at = datetime.fromisoformat(
            cached["generated_at"].replace("Z", "+00:00")
        )
        age_hours = (
            datetime.now(timezone.utc) - generated_at
        ).total_seconds() / 3600
        if age_hours < 6:
            return cached
        return None
    except Exception:
        return None


async def save_analysis_cache(wallet_address: str, analysis: dict) -> None:
    """Save analysis result to cache keyed by wallet_address."""
    try:
        data = {
            "wallet_address": wallet_address,
            "signal": analysis.get("signal"),
            "signal_reason": analysis.get("signal_reason"),
            "activity_summary": analysis.get("activity_summary"),
            "key_insight": analysis.get("key_insight"),
            "risk_level": analysis.get("risk_level"),
            "risk_reason": analysis.get("risk_reason"),
            "tags": analysis.get("tags", []),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase_client.table("analyses").upsert(
            data, on_conflict="wallet_address"
        ).execute()
    except Exception as e:
        print(f"[Cache] Save failed: {e}")


# ─────────────────────────────────────────
# SUPABASE SCHEMA (run once in SQL editor)
# ─────────────────────────────────────────
"""
-- Tracked whale wallets
CREATE TABLE wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    chain TEXT NOT NULL CHECK (chain IN ('ethereum')),
    tags TEXT[],
    score INTEGER DEFAULT 0,
    score_breakdown JSONB,
    balance NUMERIC DEFAULT 0,
    last_scanned TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction history
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id),
    hash TEXT UNIQUE NOT NULL,
    chain TEXT NOT NULL,
    timestamp TIMESTAMPTZ,
    value NUMERIC,
    value_symbol TEXT,
    direction TEXT,
    status TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI analysis cache (avoid re-running Claude on same data)
CREATE TABLE analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id),
    signal TEXT,
    signal_reason TEXT,
    activity_summary TEXT,
    key_insight TEXT,
    risk_level TEXT,
    tags TEXT[],
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_wallets_score ON wallets(score DESC);
"""