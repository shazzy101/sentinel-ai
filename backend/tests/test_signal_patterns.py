"""
Tests for backend/signals/patterns.py — Pattern A through D detectors.

Each detector gets:
  - a POSITIVE fixture (fires, correct PatternHit fields)
  - a NEGATIVE fixture (returns None)

Pattern C (coordinated accumulation) also gets boundary tests:
  - 2 wallets → None
  - 3 wallets within 4-hour window → fires
  - 3 wallets outside 4-hour window → None
"""

import sys
import math
from pathlib import Path

# Make backend/ importable when run from repo root or tests/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from signals.patterns import (
    PatternHit,
    detect_stablecoin_staging,
    detect_contract_testing,
    detect_coordinated_accumulation,
    detect_quiet_whale_waking,
    STAGING_INFLOW_THRESHOLD_USD,
    CONTRACT_TEST_TX_MAX_USD,
    CONTRACT_LARGE_TX_MIN_USD,
    COORD_MIN_WALLETS,
    COORD_WINDOW_SECONDS,
    WHALE_MIN_INACTIVE_DAYS,
    WHALE_MIN_BALANCE_USD,
)


# ─────────────────────────────────────────
# Pattern A — Stablecoin Staging
# ─────────────────────────────────────────

class TestDetectStablecoinStaging:
    def _positive_input(self, inflow=1_000_000.0):
        return {
            "wallet": "0xALICE",
            "asset": "USDC",
            "stablecoin_inflow_usd": inflow,
            "historical_buy_after_staging": True,
            "recent_txs": [
                {"hash": "0xTX1", "usd_value": inflow, "asset": "USDC"},
            ],
        }

    def test_fires_on_valid_input(self):
        hit = detect_stablecoin_staging(self._positive_input())
        assert hit is not None

    def test_returns_pattern_hit_type(self):
        hit = detect_stablecoin_staging(self._positive_input())
        assert isinstance(hit, PatternHit)

    def test_pattern_type_is_correct(self):
        hit = detect_stablecoin_staging(self._positive_input())
        assert hit.pattern_type == "stablecoin_staging"

    def test_wallet_is_included(self):
        hit = detect_stablecoin_staging(self._positive_input())
        assert "0xALICE" in hit.wallets

    def test_tx_hash_is_included(self):
        hit = detect_stablecoin_staging(self._positive_input())
        assert "0xTX1" in hit.tx_hashes

    def test_asset_is_set(self):
        hit = detect_stablecoin_staging(self._positive_input())
        assert hit.asset == "USDC"

    def test_strength_in_range(self):
        hit = detect_stablecoin_staging(self._positive_input())
        assert 0.0 <= hit.strength <= 1.0

    def test_strength_at_threshold_is_0_5(self):
        """At exactly the threshold, strength should be 0.5 (log10(1) = 0)."""
        inp = self._positive_input(inflow=STAGING_INFLOW_THRESHOLD_USD)
        hit = detect_stablecoin_staging(inp)
        assert hit is not None
        assert abs(hit.strength - 0.5) < 1e-9

    def test_strength_increases_with_inflow(self):
        hit_small = detect_stablecoin_staging(self._positive_input(inflow=600_000))
        hit_large = detect_stablecoin_staging(self._positive_input(inflow=5_000_000))
        assert hit_large.strength > hit_small.strength

    # NEGATIVE fixtures
    def test_returns_none_below_threshold(self):
        inp = self._positive_input(inflow=STAGING_INFLOW_THRESHOLD_USD - 1)
        assert detect_stablecoin_staging(inp) is None

    def test_returns_none_without_historical_buy(self):
        inp = self._positive_input()
        inp["historical_buy_after_staging"] = False
        assert detect_stablecoin_staging(inp) is None

    def test_returns_none_on_empty_input(self):
        assert detect_stablecoin_staging({}) is None

    def test_returns_none_on_missing_inflow_key(self):
        inp = {
            "wallet": "0xALICE",
            "asset": "USDC",
            "historical_buy_after_staging": True,
        }
        assert detect_stablecoin_staging(inp) is None


# ─────────────────────────────────────────
# Pattern B — Contract Testing
# ─────────────────────────────────────────

BASE_TS = 1_700_000_000.0  # arbitrary unix timestamp


class TestDetectContractTesting:
    def _positive_input(self, large_usd=200_000.0):
        return {
            "wallet": "0xBOB",
            "asset": "WETH",
            "txs": [
                {
                    "hash": "0xSMALL",
                    "usd_value": 500.0,                  # small probe < $1k
                    "contract_address": "0xCONTRACT1",
                    "timestamp": BASE_TS,
                },
                {
                    "hash": "0xLARGE",
                    "usd_value": large_usd,              # large follow-up >= $100k
                    "contract_address": "0xCONTRACT1",
                    "timestamp": BASE_TS + 3600,         # 1 hour later
                },
            ],
        }

    def test_fires_on_valid_input(self):
        assert detect_contract_testing(self._positive_input()) is not None

    def test_returns_pattern_hit_type(self):
        hit = detect_contract_testing(self._positive_input())
        assert isinstance(hit, PatternHit)

    def test_pattern_type(self):
        hit = detect_contract_testing(self._positive_input())
        assert hit.pattern_type == "contract_testing"

    def test_wallet_included(self):
        hit = detect_contract_testing(self._positive_input())
        assert "0xBOB" in hit.wallets

    def test_both_tx_hashes_included(self):
        hit = detect_contract_testing(self._positive_input())
        assert "0xSMALL" in hit.tx_hashes
        assert "0xLARGE" in hit.tx_hashes

    def test_strength_in_range(self):
        hit = detect_contract_testing(self._positive_input())
        assert 0.0 <= hit.strength <= 1.0

    def test_strength_at_min_large_tx_is_0_5(self):
        hit = detect_contract_testing(self._positive_input(large_usd=CONTRACT_LARGE_TX_MIN_USD))
        assert hit is not None
        assert abs(hit.strength - 0.5) < 1e-9

    def test_strength_increases_with_large_tx(self):
        hit_small = detect_contract_testing(self._positive_input(large_usd=100_000))
        hit_large = detect_contract_testing(self._positive_input(large_usd=10_000_000))
        assert hit_large.strength > hit_small.strength

    # NEGATIVE fixtures
    def test_returns_none_large_tx_before_small(self):
        """Order matters: large tx must come AFTER small tx."""
        inp = {
            "wallet": "0xBOB",
            "asset": "WETH",
            "txs": [
                {
                    "hash": "0xLARGE",
                    "usd_value": 200_000,
                    "contract_address": "0xCONTRACT1",
                    "timestamp": BASE_TS,
                },
                {
                    "hash": "0xSMALL",
                    "usd_value": 500,
                    "contract_address": "0xCONTRACT1",
                    "timestamp": BASE_TS + 3600,
                },
            ],
        }
        assert detect_contract_testing(inp) is None

    def test_returns_none_different_contracts(self):
        """Probe and large tx must share the SAME contract address."""
        inp = {
            "wallet": "0xBOB",
            "asset": "WETH",
            "txs": [
                {
                    "hash": "0xSMALL",
                    "usd_value": 500,
                    "contract_address": "0xCONTRACT1",
                    "timestamp": BASE_TS,
                },
                {
                    "hash": "0xLARGE",
                    "usd_value": 200_000,
                    "contract_address": "0xCONTRACT2",
                    "timestamp": BASE_TS + 3600,
                },
            ],
        }
        assert detect_contract_testing(inp) is None

    def test_returns_none_large_tx_too_small(self):
        inp = self._positive_input(large_usd=CONTRACT_LARGE_TX_MIN_USD - 1)
        assert detect_contract_testing(inp) is None

    def test_returns_none_probe_too_large(self):
        inp = {
            "wallet": "0xBOB",
            "asset": "WETH",
            "txs": [
                {
                    "hash": "0xSMALL",
                    "usd_value": CONTRACT_TEST_TX_MAX_USD + 1,  # exceeds probe ceiling
                    "contract_address": "0xCONTRACT1",
                    "timestamp": BASE_TS,
                },
                {
                    "hash": "0xLARGE",
                    "usd_value": 200_000,
                    "contract_address": "0xCONTRACT1",
                    "timestamp": BASE_TS + 3600,
                },
            ],
        }
        assert detect_contract_testing(inp) is None

    def test_returns_none_on_empty_txs(self):
        assert detect_contract_testing({"wallet": "0xBOB", "txs": []}) is None

    def test_returns_none_on_no_contract_address(self):
        inp = {
            "wallet": "0xBOB",
            "asset": "ETH",
            "txs": [
                {"hash": "0xA", "usd_value": 500, "contract_address": "", "timestamp": BASE_TS},
                {"hash": "0xB", "usd_value": 200_000, "contract_address": "", "timestamp": BASE_TS + 1},
            ],
        }
        assert detect_contract_testing(inp) is None


# ─────────────────────────────────────────
# Pattern C — Coordinated Accumulation
# ─────────────────────────────────────────

def _make_record(wallet, asset="ETH", timestamp=BASE_TS, usd=50_000, tx_hash=None, shares_history=True):
    return {
        "wallet": wallet,
        "asset": asset,
        "timestamp": timestamp,
        "usd_value": usd,
        "tx_hash": tx_hash or f"0xTX_{wallet}",
        "shares_history": shares_history,
    }


class TestDetectCoordinatedAccumulation:
    def test_fires_with_three_wallets_in_window(self):
        records = [
            _make_record("0xW1", timestamp=BASE_TS),
            _make_record("0xW2", timestamp=BASE_TS + 3600),
            _make_record("0xW3", timestamp=BASE_TS + 7200),   # 2 hrs after W1 — within 4-hr window
        ]
        hit = detect_coordinated_accumulation(records)
        assert hit is not None

    def test_pattern_type(self):
        records = [
            _make_record("0xW1", timestamp=BASE_TS),
            _make_record("0xW2", timestamp=BASE_TS + 3600),
            _make_record("0xW3", timestamp=BASE_TS + 7200),
        ]
        hit = detect_coordinated_accumulation(records)
        assert hit.pattern_type == "coordinated_accumulation"

    def test_asset_is_set(self):
        records = [
            _make_record("0xW1", asset="PEPE", timestamp=BASE_TS),
            _make_record("0xW2", asset="PEPE", timestamp=BASE_TS + 100),
            _make_record("0xW3", asset="PEPE", timestamp=BASE_TS + 200),
        ]
        hit = detect_coordinated_accumulation(records)
        assert hit.asset == "PEPE"

    def test_all_wallets_included(self):
        records = [
            _make_record("0xW1", timestamp=BASE_TS),
            _make_record("0xW2", timestamp=BASE_TS + 100),
            _make_record("0xW3", timestamp=BASE_TS + 200),
        ]
        hit = detect_coordinated_accumulation(records)
        assert set(hit.wallets) == {"0xW1", "0xW2", "0xW3"}

    def test_tx_hashes_included(self):
        records = [
            _make_record("0xW1", timestamp=BASE_TS),
            _make_record("0xW2", timestamp=BASE_TS + 100),
            _make_record("0xW3", timestamp=BASE_TS + 200),
        ]
        hit = detect_coordinated_accumulation(records)
        assert len(hit.tx_hashes) == 3

    def test_strength_in_range(self):
        records = [
            _make_record("0xW1", timestamp=BASE_TS),
            _make_record("0xW2", timestamp=BASE_TS + 100),
            _make_record("0xW3", timestamp=BASE_TS + 200),
        ]
        hit = detect_coordinated_accumulation(records)
        assert 0.0 <= hit.strength <= 1.0

    def test_strength_increases_with_wallet_count(self):
        three = [_make_record(f"0xW{i}", timestamp=BASE_TS + i * 100) for i in range(3)]
        six = [_make_record(f"0xW{i}", timestamp=BASE_TS + i * 100) for i in range(6)]
        hit3 = detect_coordinated_accumulation(three)
        hit6 = detect_coordinated_accumulation(six)
        assert hit6.strength > hit3.strength

    # Boundary: exactly 2 wallets → None
    def test_returns_none_with_two_wallets(self):
        records = [
            _make_record("0xW1", timestamp=BASE_TS),
            _make_record("0xW2", timestamp=BASE_TS + 100),
        ]
        assert detect_coordinated_accumulation(records) is None

    # Boundary: 3 wallets outside 4-hour window → None
    def test_returns_none_outside_window(self):
        records = [
            _make_record("0xW1", timestamp=BASE_TS),
            _make_record("0xW2", timestamp=BASE_TS + COORD_WINDOW_SECONDS + 1),
            _make_record("0xW3", timestamp=BASE_TS + COORD_WINDOW_SECONDS + 2),
        ]
        # W1 is too far from W2 and W3; W2 and W3 are only 1 second apart (2 wallets) → None
        assert detect_coordinated_accumulation(records) is None

    # wallets without shares_history are excluded
    def test_wallets_without_shared_history_excluded(self):
        records = [
            _make_record("0xW1", shares_history=True),
            _make_record("0xW2", shares_history=True),
            _make_record("0xW3", shares_history=False),  # excluded
        ]
        assert detect_coordinated_accumulation(records) is None

    # different assets don't merge
    def test_different_assets_do_not_merge(self):
        records = [
            _make_record("0xW1", asset="ETH"),
            _make_record("0xW2", asset="ETH"),
            _make_record("0xW3", asset="BTC"),  # different asset
        ]
        assert detect_coordinated_accumulation(records) is None

    def test_returns_none_on_empty_list(self):
        assert detect_coordinated_accumulation([]) is None

    # Boundary: exactly at the 4-hour border (inclusive)
    def test_fires_at_exact_window_boundary(self):
        """3 wallets where max_ts - min_ts == COORD_WINDOW_SECONDS should fire."""
        records = [
            _make_record("0xW1", timestamp=BASE_TS),
            _make_record("0xW2", timestamp=BASE_TS + COORD_WINDOW_SECONDS / 2),
            _make_record("0xW3", timestamp=BASE_TS + COORD_WINDOW_SECONDS),
        ]
        hit = detect_coordinated_accumulation(records)
        assert hit is not None


# ─────────────────────────────────────────
# Pattern D — Quiet Whale Waking
# ─────────────────────────────────────────

class TestDetectQuietWhaleWaking:
    def _positive_input(self, balance=5_000_000.0, days=45):
        return {
            "wallet": "0xWHALE",
            "days_inactive": days,
            "balance_usd": balance,
            "asset": "ETH",
            "last_tx_hash": "0xWHALE_TX",
            "just_moved": True,
        }

    def test_fires_on_valid_input(self):
        assert detect_quiet_whale_waking(self._positive_input()) is not None

    def test_returns_pattern_hit_type(self):
        hit = detect_quiet_whale_waking(self._positive_input())
        assert isinstance(hit, PatternHit)

    def test_pattern_type(self):
        hit = detect_quiet_whale_waking(self._positive_input())
        assert hit.pattern_type == "quiet_whale_waking"

    def test_wallet_included(self):
        hit = detect_quiet_whale_waking(self._positive_input())
        assert "0xWHALE" in hit.wallets

    def test_tx_hash_included(self):
        hit = detect_quiet_whale_waking(self._positive_input())
        assert "0xWHALE_TX" in hit.tx_hashes

    def test_asset_is_set(self):
        hit = detect_quiet_whale_waking(self._positive_input())
        assert hit.asset == "ETH"

    def test_strength_in_range(self):
        hit = detect_quiet_whale_waking(self._positive_input())
        assert 0.0 <= hit.strength <= 1.0

    def test_strength_at_min_balance_is_0_5(self):
        """At exactly the minimum balance threshold, strength should be 0.5."""
        inp = self._positive_input(balance=WHALE_MIN_BALANCE_USD)
        # Note: balance must be STRICTLY greater than threshold to fire
        inp["balance_usd"] = WHALE_MIN_BALANCE_USD + 1
        hit = detect_quiet_whale_waking(inp)
        assert hit is not None
        assert abs(hit.strength - 0.5) < 0.01

    def test_strength_increases_with_balance(self):
        hit_small = detect_quiet_whale_waking(self._positive_input(balance=2_000_000))
        hit_large = detect_quiet_whale_waking(self._positive_input(balance=50_000_000))
        assert hit_large.strength > hit_small.strength

    # NEGATIVE fixtures
    def test_returns_none_not_just_moved(self):
        inp = self._positive_input()
        inp["just_moved"] = False
        assert detect_quiet_whale_waking(inp) is None

    def test_returns_none_below_inactive_threshold(self):
        inp = self._positive_input(days=WHALE_MIN_INACTIVE_DAYS)  # exactly at threshold (not >)
        assert detect_quiet_whale_waking(inp) is None

    def test_returns_none_below_balance_threshold(self):
        inp = self._positive_input(balance=WHALE_MIN_BALANCE_USD)  # exactly at threshold (not >)
        assert detect_quiet_whale_waking(inp) is None

    def test_returns_none_on_empty_input(self):
        assert detect_quiet_whale_waking({}) is None

    def test_returns_none_when_days_inactive_zero(self):
        inp = self._positive_input(days=0)
        assert detect_quiet_whale_waking(inp) is None
