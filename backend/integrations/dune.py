"""
Sentinel AI — Dune Analytics client

Cost-smart design for the free tier (2,500 credits/mo):
  • READS serve from Dune's "latest results" endpoint, which returns the most
    recent execution WITHOUT spending execution credits.
  • EXECUTIONS (which cost credits) are triggered on a slow background schedule
    in main.py, not on user requests.

So user-facing dashboard loads are effectively free; only the scheduled
refresh spends the (tiny) ~2.4 credits per full cycle.
"""

import os
from typing import Optional

import httpx

DUNE_API_BASE = "https://api.dune.com/api/v1"

# Saved Dune query IDs (authored + validated for Sentinel)
QUERY_TOP_TOKENS = 7686306      # Top tokens by 24h DEX volume (Ethereum)
QUERY_WHALE_TRADES = 7686308    # Largest whale DEX trades 24h (>$250k)
QUERY_NETWORK_PULSE = 7686309   # 24h network vitals: txns, gas, fees

ALL_QUERY_IDS = (QUERY_TOP_TOKENS, QUERY_WHALE_TRADES, QUERY_NETWORK_PULSE)


def _api_key() -> Optional[str]:
    return os.getenv("DUNE_API_KEY")


def is_configured() -> bool:
    return bool(_api_key())


async def get_latest_results(query_id: int, limit: int = 50) -> list[dict]:
    """
    Return rows from the most recent execution of a saved query.
    Does NOT trigger a new execution — cheap, safe to call on every request.
    Returns [] if Dune is unconfigured, never executed, or errors.
    """
    key = _api_key()
    if not key:
        return []
    url = f"{DUNE_API_BASE}/query/{query_id}/results"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                url,
                headers={"X-Dune-API-Key": key},
                params={"limit": limit},
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            return (data.get("result") or {}).get("rows") or []
    except Exception:
        return []


async def trigger_execution(query_id: int, performance: str = "free") -> Optional[str]:
    """
    Kick off a fresh execution of a saved query (spends credits).
    Called only by the scheduled refresh task. Returns execution_id or None.
    """
    key = _api_key()
    if not key:
        return None
    url = f"{DUNE_API_BASE}/query/{query_id}/execute"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                url,
                headers={"X-Dune-API-Key": key},
                json={"performance": performance},
            )
            if resp.status_code not in (200, 201):
                return None
            return resp.json().get("execution_id")
    except Exception:
        return None
