"""
Claude deep-dive for high-impact news — Haiku, rate-limited, cached in the
news row. Runs ONLY when a user opens a high-impact story (importance >= 60)
that hasn't been analyzed yet, so cost stays near zero ("lean" posture).
"""

from ai.analyst import _call_claude, _rate_limit_ok, _parse_json_response


async def analyze_news(title: str, summary: str, tokens: list[str]) -> dict | None:
    """Return {executive_summary, bull_thesis, bear_thesis, market_impact,
    confidence} or None if rate-limited / parse fails."""
    if not _rate_limit_ok():
        return None

    tickers = ", ".join(tokens) if tokens else "none detected"
    prompt = f"""You are Sentinel AI's market intelligence analyst. Analyze this crypto news for active traders. Be specific and avoid hedging filler.

Headline: {title}
Summary: {summary[:600]}
Tickers in play: {tickers}

Return JSON only, no other text:
{{
  "executive_summary": "2-3 sentence overview of what happened and why it matters",
  "bull_thesis": "2-3 sentences: why this could be bullish — beneficiaries and upside catalysts",
  "bear_thesis": "2-3 sentences: the risks and downside scenarios",
  "market_impact": <integer 0-100, where 0 is irrelevant and 100 is market-moving>,
  "confidence": <integer 0-100 reflecting how clear/actionable this is>
}}"""

    try:
        text = await _call_claude(prompt, max_tokens=420, model="claude-haiku-4-5-20251001")
        result = _parse_json_response(text)
        # Coerce scores to ints in range
        for k in ("market_impact", "confidence"):
            try:
                result[k] = max(0, min(100, int(result.get(k, 0))))
            except Exception:
                result[k] = None
        return result
    except Exception:
        return None
