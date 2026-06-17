"""
Sentinel AI — Pattern Detector Functions

Four PURE detector functions that operate on normalized plain-dict inputs.
No network calls. No side effects. Deterministic given the same input.

Patterns:
  A — Stablecoin Staging        (detect_stablecoin_staging)
  B — Contract Testing          (detect_contract_testing)
  C — Coordinated Accumulation  (detect_coordinated_accumulation)
  D — Quiet Whale Waking        (detect_quiet_whale_waking)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# ─────────────────────────────────────────
# THRESHOLDS (module constants)
# ─────────────────────────────────────────

# Pattern A — Stablecoin Staging
STAGING_INFLOW_THRESHOLD_USD: float = 500_000.0   # minimum stablecoin inflow to fire

# Pattern B — Contract Testing
CONTRACT_TEST_TX_MAX_USD: float = 1_000.0          # small/test tx ceiling
CONTRACT_LARGE_TX_MIN_USD: float = 100_000.0       # large follow-up tx floor

# Pattern C — Coordinated Accumulation
COORD_MIN_WALLETS: int = 3                          # wallets that must share history
COORD_WINDOW_SECONDS: float = 4 * 3600.0           # 4-hour window (in seconds)

# Pattern D — Quiet Whale Waking
WHALE_MIN_INACTIVE_DAYS: int = 30
WHALE_MIN_BALANCE_USD: float = 1_000_000.0


# ─────────────────────────────────────────
# DATA CLASS
# ─────────────────────────────────────────

@dataclass
class PatternHit:
    """Result of a single pattern detection run.

    Attributes:
        pattern_type:  One of 'stablecoin_staging', 'contract_testing',
                       'coordinated_accumulation', 'quiet_whale_waking'.
        asset:         Token/asset symbol or address that triggered the pattern.
        wallets:       List of wallet addresses involved.
        tx_hashes:     List of transaction hashes relevant to the pattern.
        strength:      Confidence score for the pattern match, in [0.0, 1.0].
                       Higher values indicate a stronger signal.
    """

    pattern_type: str
    asset: str
    wallets: list[str] = field(default_factory=list)
    tx_hashes: list[str] = field(default_factory=list)
    strength: float = 0.0


# ─────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────

def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


# ─────────────────────────────────────────
# PATTERN A — STABLECOIN STAGING
# ─────────────────────────────────────────

def detect_stablecoin_staging(wallet_activity: dict) -> Optional[PatternHit]:
    """Pattern A: Stablecoin Staging.

    Detects large USDC/USDT accumulation into a wallet that historically
    preceded buy activity, suggesting the wallet is staging dry powder for
    an imminent purchase.

    Input shape::

        {
            "wallet":                    str,   # wallet address
            "asset":                     str,   # stablecoin symbol, e.g. "USDC"
            "stablecoin_inflow_usd":     float, # total USD-value inflow of stablecoins
            "historical_buy_after_staging": bool, # True if wallet has a track record of
                                                  # buying after staging stablecoins
            "recent_txs": [             # list of recent transaction dicts (optional)
                {
                    "hash":      str,
                    "usd_value": float,
                    "asset":     str,
                }
            ]
        }

    Fires when:
        - stablecoin_inflow_usd >= STAGING_INFLOW_THRESHOLD_USD, AND
        - historical_buy_after_staging is True

    Strength scales logarithmically with inflow above the threshold,
    clamped to [0.0, 1.0].

    Returns None when criteria are not met.
    """
    try:
        inflow = float(wallet_activity.get("stablecoin_inflow_usd", 0))
        has_history: bool = bool(wallet_activity.get("historical_buy_after_staging", False))
    except (TypeError, ValueError):
        return None

    if inflow < STAGING_INFLOW_THRESHOLD_USD or not has_history:
        return None

    # Strength: 0.5 at threshold, asymptotically approaches 1.0 at 10× threshold.
    ratio = inflow / STAGING_INFLOW_THRESHOLD_USD  # >= 1.0
    import math
    strength = _clamp(0.5 + 0.5 * math.log10(ratio))

    wallet = wallet_activity.get("wallet", "")
    asset = wallet_activity.get("asset", "USDC")
    tx_hashes = [
        tx["hash"]
        for tx in wallet_activity.get("recent_txs", [])
        if isinstance(tx, dict) and tx.get("hash")
    ]

    return PatternHit(
        pattern_type="stablecoin_staging",
        asset=asset,
        wallets=[wallet] if wallet else [],
        tx_hashes=tx_hashes,
        strength=strength,
    )


# ─────────────────────────────────────────
# PATTERN B — CONTRACT TESTING
# ─────────────────────────────────────────

def detect_contract_testing(wallet_activity: dict) -> Optional[PatternHit]:
    """Pattern B: Contract Testing.

    Detects a small "probe" transaction to a contract, followed by a large
    positioning transaction involving the same wallet and contract address.
    This pattern suggests a whale confirmed contract behaviour before moving
    serious capital.

    Input shape::

        {
            "wallet":  str,            # wallet address
            "asset":   str,            # primary asset symbol or address
            "txs": [                   # ordered list of txs (ascending timestamp)
                {
                    "hash":             str,
                    "usd_value":        float,   # USD-equivalent value of the tx
                    "contract_address": str,     # contract interacted with (empty/"" if none)
                    "timestamp":        float,   # unix timestamp (seconds)
                }
            ]
        }

    Fires when:
        - A tx with usd_value < CONTRACT_TEST_TX_MAX_USD to a non-empty contract
          is followed (later timestamp) by a tx with usd_value >= CONTRACT_LARGE_TX_MIN_USD
          involving the same contract address.

    Strength scales with the large tx size relative to CONTRACT_LARGE_TX_MIN_USD,
    clamped to [0.0, 1.0].

    Returns None when no such pair is found.
    """
    txs: list[dict] = wallet_activity.get("txs", []) or []
    if not txs:
        return None

    wallet = wallet_activity.get("wallet", "")
    asset = wallet_activity.get("asset", "")

    # Index small probe txs by contract address
    probed_contracts: dict[str, dict] = {}  # contract_address -> small tx dict
    best_large_usd = 0.0
    best_pair: tuple[dict, dict] | None = None

    for tx in txs:
        try:
            usd = float(tx.get("usd_value", 0))
            contract = (tx.get("contract_address") or "").strip()
            ts = float(tx.get("timestamp", 0))
        except (TypeError, ValueError):
            continue

        if not contract:
            continue

        if usd < CONTRACT_TEST_TX_MAX_USD:
            # Record as a probe candidate; later probe for same contract replaces earlier
            if contract not in probed_contracts:
                probed_contracts[contract] = tx
        elif usd >= CONTRACT_LARGE_TX_MIN_USD:
            # Check if we already saw a small probe for this contract at an earlier ts
            probe = probed_contracts.get(contract)
            if probe is not None:
                probe_ts = float(probe.get("timestamp", 0))
                if probe_ts < ts and usd > best_large_usd:
                    best_large_usd = usd
                    best_pair = (probe, tx)

    if best_pair is None:
        return None

    probe_tx, large_tx = best_pair
    import math
    ratio = best_large_usd / CONTRACT_LARGE_TX_MIN_USD  # >= 1.0
    strength = _clamp(0.5 + 0.5 * math.log10(ratio))

    tx_hashes = []
    for tx in (probe_tx, large_tx):
        h = tx.get("hash", "")
        if h:
            tx_hashes.append(h)

    return PatternHit(
        pattern_type="contract_testing",
        asset=asset,
        wallets=[wallet] if wallet else [],
        tx_hashes=tx_hashes,
        strength=strength,
    )


# ─────────────────────────────────────────
# PATTERN C — COORDINATED ACCUMULATION
# ─────────────────────────────────────────

def detect_coordinated_accumulation(wallets_activity: list[dict]) -> Optional[PatternHit]:
    """Pattern C: Coordinated Accumulation.

    Detects 3+ distinct wallets with shared behavioural history buying the
    SAME asset within a 4-hour window — a strong indicator of coordinated
    smart-money entry.

    Input shape — a list of activity records::

        [
            {
                "wallet":         str,    # wallet address
                "asset":          str,    # asset being accumulated (same across hits)
                "timestamp":      float,  # unix timestamp of the buy tx
                "usd_value":      float,  # USD value of the buy
                "tx_hash":        str,    # transaction hash
                "shares_history": bool,   # True if wallet shares behavioral history
                                         # with other tracked wallets
            },
            ...
        ]

    Fires when:
        - At least COORD_MIN_WALLETS distinct wallets (shares_history=True)
          bought the same asset within COORD_WINDOW_SECONDS of each other
          (specifically: max_ts - min_ts <= COORD_WINDOW_SECONDS).

    Strength scales with the number of qualifying wallets above the minimum,
    clamped to [0.0, 1.0].

    Returns None when the criteria are not met.
    """
    if not wallets_activity:
        return None

    # Group by asset, filter to records with shares_history=True
    from collections import defaultdict
    asset_records: dict[str, list[dict]] = defaultdict(list)

    for record in wallets_activity:
        if not isinstance(record, dict):
            continue
        if not record.get("shares_history", False):
            continue
        asset = record.get("asset", "")
        if not asset:
            continue
        asset_records[asset].append(record)

    best_hit: Optional[PatternHit] = None
    best_wallet_count = 0

    for asset, records in asset_records.items():
        if len(records) < COORD_MIN_WALLETS:
            continue

        # Sort by timestamp to allow sliding window
        try:
            records_sorted = sorted(records, key=lambda r: float(r.get("timestamp", 0)))
        except (TypeError, ValueError):
            continue

        # Sliding window: find the largest group within COORD_WINDOW_SECONDS
        n = len(records_sorted)
        left = 0
        best_window_records: list[dict] = []

        for right in range(n):
            try:
                ts_right = float(records_sorted[right].get("timestamp", 0))
            except (TypeError, ValueError):
                continue

            # Advance left pointer until window fits
            while left <= right:
                try:
                    ts_left = float(records_sorted[left].get("timestamp", 0))
                except (TypeError, ValueError):
                    left += 1
                    continue
                if ts_right - ts_left <= COORD_WINDOW_SECONDS:
                    break
                left += 1

            window = records_sorted[left:right + 1]
            # Deduplicate by wallet address
            seen_wallets: set[str] = set()
            unique_window: list[dict] = []
            for r in window:
                w = r.get("wallet", "")
                if w and w not in seen_wallets:
                    seen_wallets.add(w)
                    unique_window.append(r)

            if len(unique_window) >= COORD_MIN_WALLETS and len(unique_window) > best_wallet_count:
                best_wallet_count = len(unique_window)
                best_window_records = unique_window

        if best_wallet_count < COORD_MIN_WALLETS:
            continue

        # Strength: scales from 0.5 at exactly 3 wallets toward 1.0 for many wallets
        import math
        excess = best_wallet_count - COORD_MIN_WALLETS  # 0 at minimum
        strength = _clamp(0.5 + 0.5 * (1 - math.exp(-excess * 0.5)))

        wallets = [r.get("wallet", "") for r in best_window_records if r.get("wallet")]
        tx_hashes = [r.get("tx_hash", "") for r in best_window_records if r.get("tx_hash")]

        if best_wallet_count > (best_hit.strength if best_hit else -1):
            best_hit = PatternHit(
                pattern_type="coordinated_accumulation",
                asset=asset,
                wallets=wallets,
                tx_hashes=tx_hashes,
                strength=strength,
            )

    return best_hit


# ─────────────────────────────────────────
# PATTERN D — QUIET WHALE WAKING
# ─────────────────────────────────────────

def detect_quiet_whale_waking(wallet_activity: dict) -> Optional[PatternHit]:
    """Pattern D: Quiet Whale Waking.

    Detects a dormant high-value wallet that just moved funds after an
    extended period of inactivity. A whale stirring from hibernation is a
    historically significant on-chain signal.

    Input shape::

        {
            "wallet":        str,    # wallet address
            "days_inactive": float,  # days since last transaction
            "balance_usd":   float,  # current USD-denominated balance
            "asset":         str,    # primary asset held (e.g. "ETH")
            "last_tx_hash":  str,    # hash of the newly detected transaction
            "just_moved":    bool,   # True if a transaction was detected now
        }

    Fires when:
        - days_inactive > WHALE_MIN_INACTIVE_DAYS, AND
        - balance_usd > WHALE_MIN_BALANCE_USD, AND
        - just_moved is True

    Strength scales logarithmically with balance_usd above the minimum threshold,
    clamped to [0.0, 1.0].

    Returns None when the criteria are not met.
    """
    try:
        days_inactive = float(wallet_activity.get("days_inactive", 0))
        balance_usd = float(wallet_activity.get("balance_usd", 0))
        just_moved: bool = bool(wallet_activity.get("just_moved", False))
    except (TypeError, ValueError):
        return None

    if days_inactive <= WHALE_MIN_INACTIVE_DAYS:
        return None
    if balance_usd <= WHALE_MIN_BALANCE_USD:
        return None
    if not just_moved:
        return None

    # Strength: 0.5 at threshold, approaches 1.0 at 10× threshold ($10M)
    import math
    ratio = balance_usd / WHALE_MIN_BALANCE_USD  # >= 1.0
    strength = _clamp(0.5 + 0.5 * math.log10(ratio))

    wallet = wallet_activity.get("wallet", "")
    asset = wallet_activity.get("asset", "ETH")
    last_tx_hash = wallet_activity.get("last_tx_hash", "")

    return PatternHit(
        pattern_type="quiet_whale_waking",
        asset=asset,
        wallets=[wallet] if wallet else [],
        tx_hashes=[last_tx_hash] if last_tx_hash else [],
        strength=strength,
    )
