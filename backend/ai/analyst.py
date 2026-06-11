"""
Sentinel AI — Claude Analysis Layer
Anthropic client initialized once at app startup via init_analyst().
"""

import asyncio
import json
import os
import time
from datetime import datetime, timezone
from typing import Optional

import anthropic

from observability import log_error, log_info, log_warning
from quota import consume_global_budget, global_calls_remaining

_client: Optional[anthropic.Anthropic] = None

# Backward-compatible alias used by admin usage route
MAX_CALLS_PER_HOUR = int(os.getenv("CLAUDE_MAX_CALLS_PER_HOUR", "80"))


def _rate_limit_ok() -> bool:
    """Consume one global Claude call slot if available."""
    return consume_global_budget()


def calls_remaining() -> int:
    return global_calls_remaining()


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


async def _call_claude(prompt: str, max_tokens: int = 300, model: str = "claude-haiku-4-5-20251001",
                       retries: int = 2) -> str:
    """Run sync Anthropic SDK call without blocking the event loop.

    Retries transient failures (429 rate-limit, 5xx/529 overloaded, connection
    drops) with backoff; permanent errors (401 auth, 404 model, 400 bad request)
    fail fast so they're not masked.
    """
    client = get_client()
    for attempt in range(retries + 1):
        try:
            message = await asyncio.to_thread(
                client.messages.create,
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text.strip()
        except anthropic.APIError as e:
            status = getattr(e, "status_code", None)
            transient = (
                isinstance(e, (anthropic.RateLimitError, anthropic.APIConnectionError, anthropic.InternalServerError))
                or (status is not None and (status == 429 or status >= 500))
            )
            if transient and attempt < retries:
                await asyncio.sleep(0.8 * (attempt + 1))
                continue
            raise
    raise RuntimeError("unreachable")


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
    Checks cache first (24-hour TTL) unless force_refresh=True.
    """
    # Check cache first (skip if force_refresh)
    if address and not force_refresh:
        from db.supabase import get_cached_analysis
        cached = await get_cached_analysis(address)
        if cached:
            log_info("analysis_cache_hit", wallet=wallet_name)
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

    # Single atomic consume gates the call — no redundant peek beforehand.
    if not consume_global_budget():
        log_warning("global_claude_budget_exhausted", wallet=wallet_name)
        return {
            "signal": "NEUTRAL",
            "signal_reason": "Analysis paused — hourly API budget reached.",
            "activity_summary": "Rate limit active.",
            "key_insight": "Check back in a few minutes.",
            "risk_level": "MEDIUM",
            "risk_reason": "Cannot assess while rate-limited.",
            "tags": ["rate-limited"],
            "rate_limited": True,
        }

    try:
        text = await _call_claude(prompt, max_tokens=250, model="claude-haiku-4-5-20251001")
        result = _parse_json_response(text)
        log_info("analysis_complete", wallet=wallet_name, model="haiku")
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


async def get_market_summary(context: dict | list | None = None, *, force_refresh: bool = False) -> dict:
    """
    Feed whale + copy-trader activity to Claude.
    Returns a market-wide intelligence summary.
    Caches result for 2 hours to avoid redundant API calls.
    """
    cache = _market_summary_cache
    if not force_refresh and cache["data"] and cache["generated_at"]:
        age = (datetime.now(timezone.utc) - cache["generated_at"]).total_seconds()
        if age < 7200:  # 2 hours
            return cache["data"]

    if isinstance(context, list):
        # Legacy: plain transaction list
        ctx = {"recent_tx_count": len(context), "whale_count": 0, "copy_traders": []}
    elif isinstance(context, dict):
        ctx = context
    else:
        ctx = {}

    recent_tx_count = ctx.get("recent_tx_count", 0)
    whale_count = ctx.get("whale_count", 0)
    copy_traders = ctx.get("copy_traders") or []
    whale_signals = ctx.get("whale_signals") or []

    copy_lines = []
    for t in copy_traders[:5]:
        m = t.get("metrics") or {}
        copy_lines.append(
            f"- #{t.get('rank')} {t.get('label', 'DEX Trader')}: "
            f"{m.get('win_rate_pct')}% win rate, PF {m.get('profit_factor')}, "
            f"{m.get('track_record_days')}d track, score {t.get('copy_trading_score')}"
        )

    whale_lines = []
    for s in whale_signals[:5]:
        whale_lines.append(
            f"- {s.get('wallet_label', 'Whale')}: score {s.get('score')}, signal {s.get('signal')}"
        )

    context_text = f"""
Sentinel tracks two wallet types on Ethereum:
1. WHALE WATCHLIST — large-balance smart money wallets ({whale_count} tracked)
2. COPY TRADERS — ranked DEX traders with measurable win rate & profit factor ({len(copy_traders)} top performers in dataset)

Recent whale on-chain activity: {recent_tx_count} transactions in latest batch.

Top copy-trading performers (Dune-ranked, bots filtered):
{chr(10).join(copy_lines) if copy_lines else '- No copy trader data loaded'}

Recent whale AI signals:
{chr(10).join(whale_lines) if whale_lines else '- Run wallet scans to populate signals'}
"""
    prompt = f"""You are the AI intelligence layer for Sentinel, a professional crypto whale tracking platform.

{context_text}

Synthesize BOTH whale watchlist activity AND top copy-trader performance into one actionable brief.
Mention copy-trader quality (win rate, profit factor) when relevant — users copy-trade these wallets.
{{
  "headline": "One sharp, specific sentence about what smart money is doing right now",
  "ethereum_outlook": "2-3 sentences on ETH smart money behavior",
  "flow_state": "ACCUMULATION" | "DISTRIBUTION" | "ROTATION" | "NEUTRAL",
  "top_signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "key_themes": ["3-5 themes from the data"],
  "generated_at": "{datetime.now(timezone.utc).isoformat()}"
}}

Return ONLY valid JSON."""

    # Single atomic consume gates the call — no redundant peek beforehand.
    if not consume_global_budget():
        if cache["data"]:
            return cache["data"]
        return {
            "headline": "Intelligence paused — hourly API budget reached.",
            "ethereum_outlook": "Check back shortly.",
            "flow_state": "NEUTRAL",
            "top_signal": "NEUTRAL",
            "key_themes": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    try:
        text = await _call_claude(prompt, max_tokens=400, model="claude-sonnet-4-6")
        result = _parse_json_response(text)
        log_info("market_summary_complete", model="sonnet")
    except RuntimeError:
        raise
    except Exception as e:
        # Surface the actual Anthropic error (auth / model / billing) for logs.
        log_error("market_summary_failed", error=f"{type(e).__name__}: {str(e)[:240]}")
        # Prefer the last good summary over a scary "unavailable" message — a
        # transient blip shouldn't blank a marketing-facing page. Don't cache
        # the fallback, so the next cycle re-attempts a fresh summary.
        if cache["data"]:
            return cache["data"]
        return {
            "headline": "Intelligence is refreshing — check back in a moment.",
            "ethereum_outlook": "N/A",
            "flow_state": "NEUTRAL",
            "top_signal": "NEUTRAL",
            "key_themes": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    _market_summary_cache["data"] = result
    _market_summary_cache["generated_at"] = datetime.now(timezone.utc)
    return result
