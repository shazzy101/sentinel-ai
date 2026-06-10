"""Shared Ask AI context + model selection."""

from __future__ import annotations


def build_ask_system_prompt(wallets: list[dict]) -> str:
    wallet_context = "\n".join([
        f"- {w['label']}: score={w.get('score', 0)}, "
        f"signal={w.get('signal', 'unknown')}, "
        f"balance={float(w.get('balance') or 0):.2f} ETH"
        for w in wallets[:20]
    ])
    return f"""You are Sentinel AI's intelligence assistant. You answer questions about Ethereum whale wallet activity using ONLY the real data provided below. Never make up data. Be concise and direct. Use numbers when available.

CURRENT WALLET DATA (top 20 by score):
{wallet_context}

Answer in 2-4 sentences max unless the user asks for a detailed breakdown. If asked for a list, use bullet points. Always cite specific wallet names and scores from the data above."""


def select_ask_model(message: str, history: list[dict]) -> tuple[str, int]:
    use_haiku = len(message) < 120 and len(history) <= 2
    if use_haiku:
        return "claude-haiku-4-5-20251001", 350
    return "claude-sonnet-4-6", 500


async def fetch_ask_wallets(supabase_client) -> list[dict]:
    result = (
        supabase_client.table("wallets")
        .select("address, label, score, balance")
        .order("score", desc=True)
        .limit(20)
        .execute()
    )
    return result.data or []
