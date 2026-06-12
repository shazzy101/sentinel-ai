"""Shared Ask AI context + model selection."""

from __future__ import annotations

import asyncio


def build_ask_system_prompt(wallets: list[dict]) -> str:
    wallet_context = "\n".join([
        f"- {w['label']}: behavioral_score={w.get('score', 0)}, "
        f"signal={w.get('signal', 'unknown')}, "
        f"balance={float(w.get('balance') or 0):.2f} ETH"
        for w in wallets[:20]
    ])
    return f"""You are Hadaleum's on-chain SCREENER. The user asks in plain English; you return a short, ranked, scannable answer drawn ONLY from the real data below. You are a filter over real wallets, not a chatbot — no chit-chat, no preamble, no made-up data.

WHALE WATCHLIST (top 20 by behavioral score):
{wallet_context}

CRITICAL ACCURACY RULES:
- The whale "behavioral_score" (0-100) measures on-chain ACTIVITY (recency, transaction frequency, DeFi engagement, tx reliability). It is NOT profitability and NOT a win rate. Never describe a high behavioral score as "profitable", "winning", or "high conviction".
- For actual profitability, refer users to the Copy page (copy-trader leaderboard ranked on realized Dune P&L).
- If you mention a trader win rate, only ever use UNREALIZED win rate. Never cite realized win rate or a "100% win rate" — realized rates are gameable and only shown in a wallet's deep-dive.
- Never invent numbers. If the data doesn't answer the question, say so and suggest where to look (Watchlist, Copy, News).

FORMAT: Lead with the ranked list (bullets, most-relevant first), each line citing the specific wallet name + its real number. Then at most one summary sentence. Keep it tight."""


def select_ask_model(message: str, history: list[dict]) -> tuple[str, int]:
    use_haiku = len(message) < 120 and len(history) <= 2
    if use_haiku:
        return "claude-haiku-4-5-20251001", 350
    return "claude-sonnet-4-6", 500


async def fetch_ask_wallets(supabase_client) -> list[dict]:
    # The Supabase client is synchronous (blocking HTTP). Run it off the event
    # loop so it doesn't stall other requests while the query is in flight.
    def _query():
        return (
            supabase_client.table("wallets")
            .select("address, label, score, balance")
            .order("score", desc=True)
            .limit(20)
            .execute()
        )

    result = await asyncio.to_thread(_query)
    return result.data or []
