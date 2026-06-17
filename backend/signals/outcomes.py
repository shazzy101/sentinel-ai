"""
Sentinel AI — Signal Outcome Resolver

Runs every 60 minutes (registered in main.py) to:
  1. Query all active signals (status == 'active').
  2. Fetch the current price of each signal's asset.
  3. Resolve win/loss based on whether price reached target or stop_loss.
  4. Update the signal row in Supabase with status, outcome_return, resolved_at.
  5. Recompute and persist the global track_record_summary.
  6. Leave a TODO hook for outcome tweet replies.

All external dependencies are injectable for testability.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable, Optional

_log = logging.getLogger(__name__)

# Mapping of common asset symbols to CoinGecko coin IDs.
_SYMBOL_TO_COINGECKO_ID: dict[str, str] = {
    "ETH": "ethereum",
    "WETH": "weth",
    "BTC": "bitcoin",
    "WBTC": "wrapped-bitcoin",
    "USDC": "usd-coin",
    "USDT": "tether",
    "DAI": "dai",
    "LINK": "chainlink",
    "UNI": "uniswap",
    "AAVE": "aave",
    "CRV": "curve-dao-token",
    "MKR": "maker",
    "SNX": "havven",
    "COMP": "compound-governance-token",
    "LDO": "lido-dao",
    "ARB": "arbitrum",
    "OP": "optimism",
}


# ── Price fetch (injectable default) ──────────────────────────────────────

async def _default_price_fn(asset: str) -> Optional[float]:
    """
    Fetch current USD price for the given asset symbol via CoinGecko.
    Returns None if the price cannot be fetched.
    """
    import httpx

    coin_id = _SYMBOL_TO_COINGECKO_ID.get((asset or "").upper())
    if not coin_id:
        _log.debug("outcomes: no CoinGecko id for asset=%s", asset)
        return None

    url = (
        f"https://api.coingecko.com/api/v3/simple/price"
        f"?ids={coin_id}&vs_currencies=usd"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            price = data.get(coin_id, {}).get("usd")
            return float(price) if price is not None else None
    except Exception as exc:
        _log.warning("outcomes: price fetch failed for %s: %s", asset, exc)
        return None


def _default_update_fn(signal_id: str, data: dict) -> dict:
    from db.supabase import update_signal
    return update_signal(signal_id, data)


def _default_list_active_fn() -> list[dict]:
    from db.supabase import list_signals
    return list_signals(status="active", limit=500)


def _default_summary_fn(summary: dict) -> None:
    """Persist the track_record_summary to a signals_meta table (best-effort)."""
    try:
        from db.supabase import supabase_client
        supabase_client.table("signals_meta").upsert(
            {"key": "track_record_summary", "value": summary},
            on_conflict="key",
        ).execute()
    except Exception as exc:
        _log.warning("outcomes: summary_fn failed: %s", exc)


# ── Pure outcome decision helper (fully testable) ──────────────────────────

def decide_outcome(signal: dict, price: float) -> Optional[dict]:
    """
    Decide whether a signal has resolved to win or loss based on current price.

    For a LONG signal:
        win  → price >= target
        loss → price <= stop_loss

    For a SHORT signal:
        win  → price <= target
        loss → price >= stop_loss

    ``outcome_return`` is expressed as a fraction (e.g. 0.10 = +10%).
    It is computed from the entry midpoint (average of entry_low and entry_high,
    or entry_low if entry_high is missing).

    Returns a dict ``{"status": "win"|"loss", "outcome_return": float}``
    or ``None`` if neither target nor stop has been reached.
    """
    if not isinstance(signal, dict):
        return None
    direction = (signal.get("direction") or "").lower()
    if direction not in ("long", "short"):
        return None

    try:
        target = float(signal["target"])
        stop_loss = float(signal["stop_loss"])
        entry_low = float(signal.get("entry_low") or signal.get("entry_high") or 0)
        entry_high = float(signal.get("entry_high") or entry_low)
        entry = (entry_low + entry_high) / 2.0 if entry_high else entry_low
        if entry <= 0:
            return None
    except (TypeError, ValueError, KeyError):
        return None

    if direction == "long":
        if price >= target:
            return {
                "status": "win",
                "outcome_return": round((target - entry) / entry, 6),
            }
        if price <= stop_loss:
            return {
                "status": "loss",
                "outcome_return": round((stop_loss - entry) / entry, 6),
            }
    else:  # short
        if price <= target:
            return {
                "status": "win",
                "outcome_return": round((entry - target) / entry, 6),
            }
        if price >= stop_loss:
            return {
                "status": "loss",
                "outcome_return": round((entry - stop_loss) / entry, 6),
            }

    return None


# ── Entry point ────────────────────────────────────────────────────────────

async def resolve_outcomes(
    *,
    signals: Optional[list[dict]] = None,
    price_fn: Optional[Callable] = None,
    update_fn: Optional[Callable] = None,
    summary_fn: Optional[Callable] = None,
    list_active_fn: Optional[Callable] = None,
) -> dict:
    """
    Resolve pending win/loss outcomes for all active signals.

    Parameters
    ----------
    signals : list[dict], optional
        Override the list of active signals (for tests). If None, fetched from DB.
    price_fn : async callable(asset: str) -> float | None, optional
        Returns current USD price for the asset. Defaults to CoinGecko fetch.
    update_fn : callable(signal_id: str, data: dict) -> dict, optional
        Persists the resolved fields. Defaults to update_signal.
    summary_fn : callable(summary: dict) -> None, optional
        Persists the recomputed track record. Defaults to supabase upsert.
    list_active_fn : callable() -> list[dict], optional
        Fetches all active signals. Defaults to list_signals(status='active').

    Returns
    -------
    dict
        ``{"resolved": int, "wins": int, "losses": int, "skipped": int}``
    """
    from signals_api import compute_track_record

    _price = price_fn or _default_price_fn
    _update = update_fn or _default_update_fn
    _summary = summary_fn or _default_summary_fn
    _list_active = list_active_fn or _default_list_active_fn

    # 1. Load active signals
    if signals is None:
        try:
            active_signals = _list_active()
        except Exception as exc:
            _log.error("outcomes: list_active failed: %s", exc)
            return {"resolved": 0, "wins": 0, "losses": 0, "skipped": 0}
    else:
        active_signals = signals

    stats = {"resolved": 0, "wins": 0, "losses": 0, "skipped": 0}
    resolved_ids: list[str] = []

    # 2. Resolve each signal
    for sig in active_signals:
        sig_id = sig.get("id")
        asset = sig.get("asset", "")
        if not sig_id or not asset:
            stats["skipped"] += 1
            continue

        # Fetch price (async)
        try:
            price = await _price(asset)
        except Exception as exc:
            _log.warning("outcomes: price_fn raised for %s: %s", asset, exc)
            price = None

        if price is None:
            stats["skipped"] += 1
            continue

        # Decide outcome
        outcome = decide_outcome(sig, price)
        if outcome is None:
            # Neither target nor stop hit — still active
            stats["skipped"] += 1
            continue

        # Persist update
        update_payload = {
            "status": outcome["status"],
            "outcome_return": outcome["outcome_return"],
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            _update(sig_id, update_payload)
        except Exception as exc:
            _log.error("outcomes: update_fn failed for id=%s: %s", sig_id, exc)
            stats["skipped"] += 1
            continue

        stats["resolved"] += 1
        resolved_ids.append(sig_id)
        if outcome["status"] == "win":
            stats["wins"] += 1
        else:
            stats["losses"] += 1

        # TODO: Outcome tweet reply hook — wire up when Twitter reply function exists.
        # if sig.get("tweet_id"):
        #     await reply_to_tweet(sig["tweet_id"], outcome["status"], outcome["outcome_return"])

        _log.info(
            "outcomes: resolved signal id=%s status=%s return=%.4f",
            sig_id,
            outcome["status"],
            outcome["outcome_return"],
        )

    # 3. Recompute and persist track record summary (always, even if nothing resolved)
    if stats["resolved"] > 0 or True:  # run every time so track record stays fresh
        try:
            from db.supabase import list_signals as _ls
            all_resolved = _ls(status=None, limit=1000)
            summary = compute_track_record(all_resolved)
            try:
                _summary(summary)
            except Exception as exc:
                _log.warning("outcomes: summary_fn raised: %s", exc)
        except Exception as exc:
            _log.warning("outcomes: track_record recompute failed: %s", exc)

    _log.info(
        "outcomes: cycle done resolved=%d wins=%d losses=%d skipped=%d",
        stats["resolved"],
        stats["wins"],
        stats["losses"],
        stats["skipped"],
    )
    return stats
