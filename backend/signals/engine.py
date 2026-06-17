"""
Sentinel AI — Signal Engine

Assembles detected PatternHit objects into full signal rows ready for
`db.supabase.insert_signal`.

Functions:
    confidence_from    — maps pattern strength + historical accuracy → 1..5 int
    targets_for        — computes entry zone, target, and stop_loss
    build_signal       — assembles the full signal dict (Claude call injected)
    generate_explanation — real Claude call (inject as explain_fn in production)
"""

from __future__ import annotations

import math
from typing import Callable, Optional

from signals.patterns import PatternHit

# ─────────────────────────────────────────
# PRICE LEVEL CONSTANTS
# ─────────────────────────────────────────

# Entry zone half-width (±0.5% around the given entry price)
ENTRY_ZONE_HALF_PCT: float = 0.005

# Long targets: target +10% above entry, stop -5% below entry
LONG_TARGET_PCT: float = 0.10
LONG_STOP_PCT: float = 0.05

# Short targets: target -10% below entry, stop +5% above entry
SHORT_TARGET_PCT: float = 0.10
SHORT_STOP_PCT: float = 0.05

# ─────────────────────────────────────────
# CONFIDENCE MAPPING
# ─────────────────────────────────────────

def confidence_from(hit: PatternHit, historical_accuracy: float = 0.5) -> int:
    """Map a PatternHit's strength + historical accuracy to a 1..5 confidence integer.

    Blending formula::

        blended = 0.7 * hit.strength + 0.3 * historical_accuracy

    This gives pattern strength 70% weight (it is derived directly from on-chain
    data) and historical accuracy 30% weight (broader signal-type track record).

    Mapping::

        blended in [0.00, 0.20)  → 1
        blended in [0.20, 0.40)  → 2
        blended in [0.40, 0.60)  → 3
        blended in [0.60, 0.80)  → 4
        blended in [0.80, 1.00]  → 5

    Args:
        hit:                 PatternHit with a strength in [0.0, 1.0].
        historical_accuracy: Overall accuracy rate for this pattern type, [0.0, 1.0].
                             Defaults to 0.5 (no prior knowledge).

    Returns:
        Integer in [1, 5].
    """
    strength = max(0.0, min(1.0, hit.strength))
    accuracy = max(0.0, min(1.0, historical_accuracy))

    blended = 0.7 * strength + 0.3 * accuracy

    if blended < 0.20:
        return 1
    elif blended < 0.40:
        return 2
    elif blended < 0.60:
        return 3
    elif blended < 0.80:
        return 4
    else:
        return 5


# ─────────────────────────────────────────
# TARGET / STOP CALCULATOR
# ─────────────────────────────────────────

def targets_for(entry: float, direction: str) -> dict:
    """Compute entry zone, target price, and stop-loss for a signal.

    Args:
        entry:     The mid-point entry price (e.g. current market price).
        direction: 'long' or 'short'.

    Returns a dict::

        {
            "entry":     float,  # the provided mid-point entry
            "target":    float,  # take-profit price
            "stop_loss": float,  # max-loss price
        }

    For 'long':
        target    = entry * (1 + LONG_TARGET_PCT)   # +10% (within [8%, 15%] spec band)
        stop_loss = entry * (1 - LONG_STOP_PCT)     # -5%  (within [4%,  6%] spec band)

    For 'short':
        target    = entry * (1 - SHORT_TARGET_PCT)  # -10% (within [8%, 15%] spec band)
        stop_loss = entry * (1 + SHORT_STOP_PCT)    # +5%  (within [4%,  6%] spec band)

    Percentages are fixed (deterministic and testable). The caller may pass a
    PatternHit.strength to a future overload if variable-width bands are needed.
    """
    if direction == "long":
        target = entry * (1 + LONG_TARGET_PCT)
        stop_loss = entry * (1 - LONG_STOP_PCT)
    elif direction == "short":
        target = entry * (1 - SHORT_TARGET_PCT)
        stop_loss = entry * (1 + SHORT_STOP_PCT)
    else:
        raise ValueError(f"direction must be 'long' or 'short', got: {direction!r}")

    return {
        "entry": entry,
        "target": round(target, 8),
        "stop_loss": round(stop_loss, 8),
    }


# ─────────────────────────────────────────
# SIGNAL BUILDER
# ─────────────────────────────────────────

def build_signal(
    hit: PatternHit,
    *,
    entry: float,
    direction: str,
    explain_fn: Optional[Callable] = None,
    historical_accuracy: float = 0.5,
) -> dict:
    """Assemble a signal row dict ready for ``db.supabase.insert_signal``.

    The Claude explanation call is injected via ``explain_fn`` so that tests
    can mock it without hitting the network.  In production, pass
    ``explain_fn=generate_explanation``.

    Args:
        hit:                 Detected pattern.
        entry:               Mid-point entry price.
        direction:           'long' or 'short'.
        explain_fn:          Optional callable ``(hit, market_context) -> str``.
                             Receives the PatternHit and an empty market context
                             dict. If None, a default explanation string is used.
        historical_accuracy: Passed to ``confidence_from``.

    Returns:
        dict with all columns expected by ``insert_signal``::

            asset, direction, confidence, entry_low, entry_high,
            target, stop_loss, explanation, pattern_type,
            whale_wallets, tx_hashes, status
    """
    confidence = confidence_from(hit, historical_accuracy)
    levels = targets_for(entry, direction)

    entry_low = round(entry * (1 - 0.005), 8)
    entry_high = round(entry * (1 + 0.005), 8)

    if explain_fn is not None:
        explanation = explain_fn(hit, {})
    else:
        explanation = (
            f"{hit.pattern_type.replace('_', ' ').title()} detected on {hit.asset}. "
            f"Wallets: {', '.join(hit.wallets[:3]) or 'unknown'}. "
            f"Signal strength: {hit.strength:.2f}."
        )

    return {
        "asset": hit.asset,
        "direction": direction,
        "confidence": confidence,
        "entry_low": entry_low,
        "entry_high": entry_high,
        "target": levels["target"],
        "stop_loss": levels["stop_loss"],
        "explanation": explanation,
        "pattern_type": hit.pattern_type,
        "whale_wallets": hit.wallets,
        "tx_hashes": hit.tx_hashes,
        "status": "pending_review",
    }


# ─────────────────────────────────────────
# REAL CLAUDE EXPLANATION (inject in production)
# ─────────────────────────────────────────

def generate_explanation(hit: PatternHit, market_context: dict) -> str:
    """Generate a 2-sentence human-readable explanation using Claude (claude-sonnet-4-6).

    This function makes a REAL network call to the Anthropic API.
    Pass it as ``explain_fn`` in production.  In tests, mock it instead.

    The function reuses the ``_client`` already initialised by
    ``ai.analyst.init_analyst()`` via ``ai.analyst.get_client()``.

    Falls back to a deterministic string if:
        - ANTHROPIC_API_KEY is not set
        - The API call fails for any reason

    Args:
        hit:            The PatternHit to describe.
        market_context: Optional extra market data (passed as JSON context).
                        May be empty — it's included for forward-compatibility.

    Returns:
        A 2-sentence explanation string (never raises).
    """
    _FALLBACK = (
        f"{hit.pattern_type.replace('_', ' ').title()} detected on {hit.asset} "
        f"by {len(hit.wallets)} whale wallet(s). "
        f"Signal strength is {hit.strength:.2f} — treat as a leading indicator "
        f"and await confirmation before entering."
    )

    try:
        from ai.analyst import get_client
        client = get_client()
    except (ImportError, RuntimeError):
        return _FALLBACK

    prompt = (
        f"You are the AI intelligence layer for Sentinel, a professional crypto "
        f"whale tracking platform. Describe the following detected on-chain pattern "
        f"in exactly 2 concise sentences suitable for a professional trader. "
        f"Be specific about the pattern type, asset, and what it implies.\n\n"
        f"Pattern type: {hit.pattern_type}\n"
        f"Asset: {hit.asset}\n"
        f"Wallets involved: {len(hit.wallets)}\n"
        f"Signal strength: {hit.strength:.2f} (0=weak, 1=strong)\n"
        f"Relevant tx hashes: {', '.join(hit.tx_hashes[:3]) or 'none'}\n"
        f"Market context: {market_context or 'none provided'}\n\n"
        f"Respond with exactly 2 sentences. No bullet points, no headers."
    )

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception:
        return _FALLBACK
