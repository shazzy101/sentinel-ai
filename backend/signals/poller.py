"""
Sentinel AI — Signal Poller

Runs every 5 minutes (registered in main.py) to:
  1. Pull large transactions (>$500k) for tracked whale wallets.
  2. Normalise into detector input shapes.
  3. Run all Task 14 pattern detectors.
  4. Build a signal for each PatternHit and insert it via Supabase.
  5. Dedupe: skip signals whose wallet+asset+pattern_type were already
     inserted within the last few hours.

All external dependencies (fetch_large_txs, insert_fn) are injectable so
tests pass fakes — no network calls during testing.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

_log = logging.getLogger(__name__)

# ── Configurable thresholds ────────────────────────────────────────────────

# Minimum USD value (approx) to qualify as a "large" transaction for polling.
# Etherscan returns values in ETH; we use a rough conversion floor.
# $500k / $3,000 per ETH ≈ 166 ETH minimum.
_LARGE_TX_ETH_FLOOR: float = 100.0   # conservative lower bound (≈$300k at $3k/ETH)

# How many hours back to look for recent signals when deduping.
_DEDUPE_WINDOW_HOURS: int = 6

# Default entry price used when no live price is available (avoids crashing).
_FALLBACK_ENTRY_PRICE: float = 1.0


# ── Real default implementations (injectable) ──────────────────────────────

def _default_fetch_large_txs(wallets: list[dict]) -> list[dict]:
    """
    Fetch recent large transactions for the given whale wallets via Etherscan.
    Returns a flat list of normalised tx dicts::

        {
            "wallet":       str,   # wallet address
            "tx_hash":      str,
            "value_eth":    float, # ETH value of the transaction
            "timestamp":    float, # unix timestamp (seconds)
            "asset":        str,   # "ETH" for native transfers
            "direction":    str,   # "in" | "out"
            "usd_value":    float, # approximate USD value
        }
    """
    import asyncio
    from chains.ethereum import get_eth_transactions

    results: list[dict] = []
    eth_price = 3_000.0  # rough default; acceptable for threshold checks

    # Attempt to grab live ETH price for better USD estimates
    try:
        import httpx
        resp = httpx.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
            timeout=5,
        )
        eth_price = float(resp.json().get("ethereum", {}).get("usd", eth_price))
    except Exception:
        pass

    async def _fetch_all():
        nonlocal results
        for w in wallets:
            addr = w.get("address", "")
            if not addr:
                continue
            try:
                txs = await get_eth_transactions(addr, limit=20)
                for tx in txs:
                    value_eth = float(tx.get("value", 0))
                    if value_eth < _LARGE_TX_ETH_FLOOR:
                        continue
                    try:
                        ts = float(
                            datetime.fromisoformat(
                                str(tx.get("timestamp", "")).replace("Z", "+00:00")
                            ).timestamp()
                        )
                    except Exception:
                        ts = time.time()
                    results.append({
                        "wallet": addr,
                        "tx_hash": tx.get("hash", ""),
                        "value_eth": value_eth,
                        "timestamp": ts,
                        "asset": tx.get("value_symbol", "ETH"),
                        "direction": tx.get("direction", "unknown"),
                        "usd_value": value_eth * eth_price,
                    })
            except Exception as exc:
                _log.warning("poller: fetch failed for %s: %s", addr, exc)

    asyncio.run(_fetch_all())
    return results


def _default_insert_fn(signal_data: dict) -> dict:
    """Insert a signal via the real Supabase helper."""
    from db.supabase import insert_signal
    return insert_signal(signal_data)


def _default_list_signals_fn(status: str | None = None, limit: int = 200) -> list[dict]:
    """List recent signals via the real Supabase helper."""
    from db.supabase import list_signals
    return list_signals(status=status, limit=limit)


# ── Dedupe helper (pure — testable) ───────────────────────────────────────

def _is_duplicate(
    wallet: str,
    asset: str,
    pattern_type: str,
    recent_signals: list[dict],
    window_hours: int = _DEDUPE_WINDOW_HOURS,
) -> bool:
    """
    Return True if a recent signal for the same wallet+asset+pattern_type
    already exists within the deduplication window.

    Reads ``created_at`` from each signal dict; skips rows missing that field.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    wallet_norm = (wallet or "").lower()

    for sig in recent_signals:
        if (sig.get("pattern_type") or "") != pattern_type:
            continue
        if (sig.get("asset") or "").upper() != (asset or "").upper():
            continue
        wallets_in_sig = sig.get("whale_wallets") or []
        if not any((w or "").lower() == wallet_norm for w in wallets_in_sig):
            continue
        # Check timestamp
        raw = sig.get("created_at", "")
        if not raw:
            continue
        try:
            created = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            if created >= cutoff:
                return True
        except Exception:
            continue

    return False


# ── Entry point ────────────────────────────────────────────────────────────

def run_signal_poll(
    *,
    fetch_large_txs: Optional[Callable] = None,
    detectors: Optional[list[Callable]] = None,
    insert_fn: Optional[Callable] = None,
    list_signals_fn: Optional[Callable] = None,
) -> list[dict]:
    """
    Pull large transactions, detect patterns, insert signals.

    Parameters
    ----------
    fetch_large_txs : callable(wallets: list[dict]) -> list[dict]
        Injected data-fetch; defaults to _default_fetch_large_txs.
        Each returned dict must contain at minimum:
        ``wallet``, ``tx_hash``, ``value_eth``, ``timestamp``, ``asset``,
        ``direction``, ``usd_value``.
    detectors : list of callables, optional
        Overrides the default set of four pattern detectors (for tests).
    insert_fn : callable(signal_data: dict) -> dict, optional
        Injected insert function; defaults to insert_signal from db.supabase.
    list_signals_fn : callable(status, limit) -> list[dict], optional
        Injected list function for dedupe check; defaults to list_signals.

    Returns
    -------
    list[dict]
        Signal dicts that were actually inserted this run.
    """
    from data.wallets import SMART_MONEY_WALLETS
    from signals.patterns import (
        detect_stablecoin_staging,
        detect_contract_testing,
        detect_coordinated_accumulation,
        detect_quiet_whale_waking,
    )
    from signals.engine import build_signal, generate_explanation

    _fetch = fetch_large_txs or _default_fetch_large_txs
    _insert = insert_fn or _default_insert_fn
    _list_sigs = list_signals_fn or _default_list_signals_fn

    if detectors is None:
        _detectors = [
            detect_stablecoin_staging,
            detect_contract_testing,
            detect_quiet_whale_waking,
        ]
        _coordinated_detector = detect_coordinated_accumulation
    else:
        _detectors = detectors
        _coordinated_detector = None

    inserted: list[dict] = []

    # 1. Fetch large transactions
    try:
        raw_txs: list[dict] = _fetch(SMART_MONEY_WALLETS)
    except Exception as exc:
        _log.error("poller: fetch_large_txs raised: %s", exc)
        return inserted

    if not raw_txs:
        _log.info("poller: no large transactions found this run")
        return inserted

    # 2. Load recent signals for dedupe check
    try:
        recent_signals = _list_sigs(status=None, limit=200)
    except Exception as exc:
        _log.warning("poller: list_signals failed (dedupe disabled): %s", exc)
        recent_signals = []

    # Within-run seen set: keyed by (wallet_lower, asset_upper, pattern_type)
    # so two detectors/wallets producing the same identity in one run don't
    # both insert (recent_signals is fetched once and never refreshed).
    _seen_this_run: set[tuple[str, str, str]] = set()

    # 3. Group by wallet for per-wallet detectors (A, B, D)
    wallet_txs: dict[str, list[dict]] = {}
    for tx in raw_txs:
        w = tx.get("wallet", "")
        wallet_txs.setdefault(w, []).append(tx)

    # 4. Per-wallet detectors (A, B, D) — run individually per wallet
    for wallet_addr, txs in wallet_txs.items():
        asset = (txs[0].get("asset") or "ETH").upper() if txs else "ETH"
        total_usd = sum(t.get("usd_value", 0) for t in txs)

        # Build input shapes for each detector
        per_wallet_inputs = [
            # Pattern A — Stablecoin Staging
            {
                "wallet": wallet_addr,
                "asset": asset,
                "stablecoin_inflow_usd": total_usd,
                "historical_buy_after_staging": True,
                "recent_txs": [
                    {
                        "hash": tx.get("tx_hash", ""),
                        "usd_value": tx.get("usd_value", 0),
                        "asset": tx.get("asset", "ETH"),
                    }
                    for tx in txs
                ],
            },
            # Pattern B — Contract Testing
            {
                "wallet": wallet_addr,
                "asset": asset,
                "txs": [
                    {
                        "hash": tx.get("tx_hash", ""),
                        "usd_value": tx.get("usd_value", 0),
                        "contract_address": "",  # Etherscan txlist doesn't give contract addr
                        "timestamp": tx.get("timestamp", 0),
                    }
                    for tx in txs
                ],
            },
            # Pattern D — Quiet Whale Waking
            {
                "wallet": wallet_addr,
                "days_inactive": 35,        # assume waking given large tx detected
                "balance_usd": total_usd,
                "asset": asset,
                "last_tx_hash": txs[0].get("tx_hash", "") if txs else "",
                "just_moved": True,
            },
        ]

        for detector, inp in zip(_detectors, per_wallet_inputs):
            try:
                hit = detector(inp)
            except Exception as exc:
                _log.warning("poller: detector %s raised: %s", detector.__name__, exc)
                continue
            if hit is None:
                continue

            # Dedupe — check both DB-loaded recent signals and within-run inserts
            primary_wallet = hit.wallets[0] if hit.wallets else wallet_addr
            run_key = (primary_wallet.lower(), (hit.asset or "").upper(), hit.pattern_type)
            if run_key in _seen_this_run or _is_duplicate(primary_wallet, hit.asset, hit.pattern_type, recent_signals):
                _log.info(
                    "poller: deduped %s/%s/%s",
                    primary_wallet,
                    hit.asset,
                    hit.pattern_type,
                )
                continue

            # Build & insert signal
            entry = txs[0].get("usd_value", _FALLBACK_ENTRY_PRICE) if txs else _FALLBACK_ENTRY_PRICE
            entry = max(entry, _FALLBACK_ENTRY_PRICE)
            try:
                signal_data = build_signal(
                    hit,
                    entry=entry,
                    direction="long",
                    explain_fn=generate_explanation,
                )
                created = _insert(signal_data)
                inserted.append(created)
                _seen_this_run.add(run_key)
                # Also append to recent_signals so _is_duplicate sees it for later candidates
                recent_signals.append({
                    "pattern_type": hit.pattern_type,
                    "asset": hit.asset,
                    "whale_wallets": list(hit.wallets),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                _log.info(
                    "poller: inserted signal id=%s pattern=%s asset=%s",
                    created.get("id"),
                    hit.pattern_type,
                    hit.asset,
                )
            except Exception as exc:
                _log.error("poller: insert failed for %s/%s: %s", hit.pattern_type, hit.asset, exc)

    # 5. Coordinated accumulation detector (Pattern C) — cross-wallet
    if _coordinated_detector is not None and raw_txs:
        coord_input = [
            {
                "wallet": tx.get("wallet", ""),
                "asset": (tx.get("asset") or "ETH").upper(),
                "timestamp": tx.get("timestamp", 0),
                "usd_value": tx.get("usd_value", 0),
                "tx_hash": tx.get("tx_hash", ""),
                "shares_history": True,
            }
            for tx in raw_txs
        ]
        try:
            coord_hit = _coordinated_detector(coord_input)
        except Exception as exc:
            _log.warning("poller: coordinated_accumulation detector raised: %s", exc)
            coord_hit = None

        if coord_hit is not None:
            primary_wallet = coord_hit.wallets[0] if coord_hit.wallets else ""
            coord_run_key = (primary_wallet.lower(), (coord_hit.asset or "").upper(), coord_hit.pattern_type)
            if coord_run_key not in _seen_this_run and not _is_duplicate(primary_wallet, coord_hit.asset, coord_hit.pattern_type, recent_signals):
                entry = raw_txs[0].get("usd_value", _FALLBACK_ENTRY_PRICE) if raw_txs else _FALLBACK_ENTRY_PRICE
                entry = max(entry, _FALLBACK_ENTRY_PRICE)
                try:
                    signal_data = build_signal(
                        coord_hit,
                        entry=entry,
                        direction="long",
                        explain_fn=generate_explanation,
                    )
                    created = _insert(signal_data)
                    inserted.append(created)
                    _seen_this_run.add(coord_run_key)
                    recent_signals.append({
                        "pattern_type": coord_hit.pattern_type,
                        "asset": coord_hit.asset,
                        "whale_wallets": list(coord_hit.wallets),
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    _log.info(
                        "poller: inserted coordinated signal id=%s asset=%s",
                        created.get("id"),
                        coord_hit.asset,
                    )
                except Exception as exc:
                    _log.error("poller: coordinated insert failed: %s", exc)

    return inserted
