"""
Sentinel AI — Claude Analysis Layer
Anthropic client initialized once at app startup via init_analyst().
"""

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Optional

import anthropic

_client: Optional[anthropic.Anthropic] = None


def init_analyst() -> None:
    """Called from FastAPI lifespan — instantiate the Anthropic client once."""
    global _client
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return
    _client = anthropic.Anthropic(api_key=api_key)


def get_client() -> anthropic.Anthropic:
    if _client is None:
        raise RuntimeError("Anthropic client not initialized — check ANTHROPIC_API_KEY and app startup")
    return _client


async def _call_claude(prompt: str, max_tokens: int = 600) -> str:
    """Run sync Anthropic SDK call without blocking the event loop."""
    client = get_client()
    message = await asyncio.to_thread(
        client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


def _parse_json_response(text: str) -> dict:
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


async def analyze_wallet(
    wallet_name: str,
    transactions: list[dict],
    balance: float,
    chain: str,
    address: str = None,
    force_refresh: bool = False,
) -> dict:
    """
    Run Claude analysis on a wallet's recent activity.
    Returns structured dict with signal, insights, risk.
    Checks cache first (6-hour TTL) unless force_refresh=True.
    """
    # Check cache first (skip if force_refresh)
    if address and not force_refresh:
        from db.supabase import get_cached_analysis
        cached = await get_cached_analysis(address)
        if cached:
            print(f"[Cache HIT] {wallet_name} — skipping Claude API call")
            return {
                "signal": cached.get("signal", "NEUTRAL"),
                "signal_reason": cached.get("signal_reason", ""),
                "activity_summary": cached.get("activity_summary", ""),
                "key_insight": cached.get("key_insight", ""),
                "risk_level": cached.get("risk_level", "MEDIUM"),
                "risk_reason": cached.get("risk_reason", ""),
                "tags": cached.get("tags", []),
                "cached": True,
            }

    tx_lines = []
    for tx in transactions[:5]:
        try:
            ts = (tx.get("timestamp") or "unknown")[:16]
            val = tx.get("value", 0)
            direction = tx.get("direction", "?")
            status = tx.get("status", "?")
            tx_lines.append(f"  {ts} | {val:.4f} ETH | {direction} | {status}")
        except Exception:
            continue

    tx_text = "\n".join(tx_lines) if tx_lines else "No parseable transactions."

    prompt = f"""Analyze this Ethereum wallet for smart money signals.

Wallet: {wallet_name}
Balance: {balance:.4f} ETH
Recent transactions ({len(transactions)} total):
{tx_text}

Return JSON only, no other text:
{{
  "signal": "BULLISH"|"BEARISH"|"NEUTRAL",
  "signal_reason": "one sentence max",
  "activity_summary": "one sentence max",
  "key_insight": "one actionable sentence for traders",
  "risk_level": "LOW"|"MEDIUM"|"HIGH",
  "risk_reason": "one sentence max",
  "tags": ["2-3 tags max"]
}}"""

    try:
        text = await _call_claude(prompt, max_tokens=300)
        result = _parse_json_response(text)
    except RuntimeError:
        raise
    except Exception as e:
        result = {
            "activity_summary": f"Analysis unavailable: {str(e)[:80]}",
            "signal": "NEUTRAL",
            "signal_reason": "Insufficient data",
            "key_insight": "Check back after more transaction history is available.",
            "risk_level": "MEDIUM",
            "risk_reason": "Cannot assess without analysis.",
            "tags": ["error"],
        }

    # Save to cache before returning
    if address and not force_refresh:
        from db.supabase import save_analysis_cache
        await save_analysis_cache(address, result)

    return result


_market_summary_cache: dict = {"data": None, "generated_at": None}


async def get_market_summary(recent_transactions: list[dict]) -> dict:
    """
    Feed recent cross-wallet activity to Claude.
    Returns a market-wide intelligence summary.
    Caches result for 2 hours to avoid redundant API calls.
    """
    cache = _market_summary_cache
    if cache["data"] and cache["generated_at"]:
        age = (datetime.now(timezone.utc) - cache["generated_at"]).total_seconds()
        if age < 7200:  # 2 hours
            return cache["data"]

    if not recent_transactions:
        context = "No recent transaction data available."
    else:
        eth_txs = [t for t in recent_transactions if t.get("chain") == "ethereum"]
        context = f"""
Recent activity across tracked whale wallets:
- {len(eth_txs)} Ethereum transactions
- Time range: last 24 hours
"""

    prompt = f"""You are the AI intelligence layer for Sentinel, a professional crypto whale tracking platform.

{context}

Generate a market intelligence brief for our users. Return a JSON object:
{{
  "headline": "One sharp, specific sentence about what smart money is doing right now",
  "ethereum_outlook": "2-3 sentences on ETH smart money behavior",
  "flow_state": "ACCUMULATION" | "DISTRIBUTION" | "ROTATION" | "NEUTRAL",
  "top_signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "key_themes": ["3-5 themes from the data"],
  "generated_at": "{datetime.now(timezone.utc).isoformat()}"
}}

Return ONLY valid JSON."""

    try:
        text = await _call_claude(prompt, max_tokens=500)
        result = _parse_json_response(text)
    except RuntimeError:
        raise
    except Exception:
        result = {
            "headline": "Intelligence unavailable — check API keys.",
            "ethereum_outlook": "N/A",
            "flow_state": "NEUTRAL",
            "top_signal": "NEUTRAL",
            "key_themes": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    _market_summary_cache["data"] = result
    _market_summary_cache["generated_at"] = datetime.now(timezone.utc)
    return result
