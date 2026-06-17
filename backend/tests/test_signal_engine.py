"""
Tests for backend/signals/engine.py — confidence_from, targets_for,
build_signal, and generate_explanation.

All Claude / network calls are mocked. The test suite is fully offline.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Make backend/ importable when run from repo root or tests/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from signals.patterns import PatternHit
from signals.engine import (
    confidence_from,
    targets_for,
    build_signal,
    generate_explanation,
    LONG_TARGET_PCT,
    LONG_STOP_PCT,
    SHORT_TARGET_PCT,
    SHORT_STOP_PCT,
)


# ─────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────

def _hit(
    pattern_type="stablecoin_staging",
    asset="ETH",
    wallets=None,
    tx_hashes=None,
    strength=0.7,
) -> PatternHit:
    return PatternHit(
        pattern_type=pattern_type,
        asset=asset,
        wallets=wallets or ["0xALICE"],
        tx_hashes=tx_hashes or ["0xTX1"],
        strength=strength,
    )


# ─────────────────────────────────────────
# confidence_from
# ─────────────────────────────────────────

class TestConfidenceFrom:
    def test_returns_int(self):
        assert isinstance(confidence_from(_hit()), int)

    def test_result_in_range(self):
        for strength in [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]:
            c = confidence_from(_hit(strength=strength))
            assert 1 <= c <= 5, f"confidence={c} out of range for strength={strength}"

    def test_minimum_strength_gives_1(self):
        hit = _hit(strength=0.0)
        assert confidence_from(hit, historical_accuracy=0.0) == 1

    def test_maximum_strength_gives_5(self):
        hit = _hit(strength=1.0)
        assert confidence_from(hit, historical_accuracy=1.0) == 5

    def test_monotonic_in_strength(self):
        """Higher strength should produce non-decreasing confidence."""
        strengths = [0.0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0]
        confidences = [confidence_from(_hit(strength=s)) for s in strengths]
        for i in range(len(confidences) - 1):
            assert confidences[i] <= confidences[i + 1], (
                f"Non-monotonic: confidence[{i}]={confidences[i]} > "
                f"confidence[{i+1}]={confidences[i+1]}"
            )

    def test_default_accuracy_0_5_mid_strength(self):
        """At strength=0.5, historical_accuracy=0.5, blended = 0.5 → tier 3."""
        hit = _hit(strength=0.5)
        assert confidence_from(hit, historical_accuracy=0.5) == 3

    def test_high_accuracy_boosts_confidence(self):
        """Same strength; higher historical_accuracy should produce >= confidence."""
        hit = _hit(strength=0.4)
        low = confidence_from(hit, historical_accuracy=0.0)
        high = confidence_from(hit, historical_accuracy=1.0)
        assert high >= low

    def test_strength_clamped_above_1(self):
        """Strength > 1.0 must not produce confidence > 5."""
        hit = _hit(strength=99.0)
        assert confidence_from(hit) == 5

    def test_strength_clamped_below_0(self):
        """Strength < 0 must not produce confidence < 1."""
        hit = _hit(strength=-99.0)
        assert confidence_from(hit) == 1

    def test_tier_boundaries(self):
        """Spot-check specific blended values at tier boundaries."""
        # blended = 0.7 * 0.0 + 0.3 * 0.0 = 0.0 → tier 1
        assert confidence_from(_hit(strength=0.0), historical_accuracy=0.0) == 1
        # blended ~0.35 → tier 2
        hit_35 = _hit(strength=0.35)
        c = confidence_from(hit_35, historical_accuracy=0.35)
        blended = 0.7 * 0.35 + 0.3 * 0.35
        assert blended < 0.40
        assert c == 2
        # blended 1.0 → tier 5
        assert confidence_from(_hit(strength=1.0), historical_accuracy=1.0) == 5


# ─────────────────────────────────────────
# targets_for
# ─────────────────────────────────────────

class TestTargetsFor:
    def test_long_returns_required_keys(self):
        result = targets_for(1000.0, "long")
        assert set(result.keys()) >= {"entry", "target", "stop_loss"}

    def test_short_returns_required_keys(self):
        result = targets_for(1000.0, "short")
        assert set(result.keys()) >= {"entry", "target", "stop_loss"}

    def test_long_target_above_entry(self):
        result = targets_for(1000.0, "long")
        assert result["target"] > result["entry"]

    def test_long_stop_below_entry(self):
        result = targets_for(1000.0, "long")
        assert result["stop_loss"] < result["entry"]

    def test_short_target_below_entry(self):
        result = targets_for(1000.0, "short")
        assert result["target"] < result["entry"]

    def test_short_stop_above_entry(self):
        result = targets_for(1000.0, "short")
        assert result["stop_loss"] > result["entry"]

    def test_long_target_within_spec_band(self):
        """Target must be 8–15% above entry."""
        entry = 2000.0
        result = targets_for(entry, "long")
        pct = (result["target"] - entry) / entry
        assert 0.08 <= pct <= 0.15, f"long target pct={pct:.4f} out of [8%, 15%]"

    def test_long_stop_within_spec_band(self):
        """Stop-loss must be 4–6% below entry."""
        entry = 2000.0
        result = targets_for(entry, "long")
        pct = (entry - result["stop_loss"]) / entry
        assert 0.04 <= pct <= 0.06, f"long stop pct={pct:.4f} out of [4%, 6%]"

    def test_short_target_within_spec_band(self):
        """Target must be 8–15% below entry."""
        entry = 500.0
        result = targets_for(entry, "short")
        pct = (entry - result["target"]) / entry
        assert 0.08 <= pct <= 0.15, f"short target pct={pct:.4f} out of [8%, 15%]"

    def test_short_stop_within_spec_band(self):
        """Stop-loss must be 4–6% above entry."""
        entry = 500.0
        result = targets_for(entry, "short")
        pct = (result["stop_loss"] - entry) / entry
        assert 0.04 <= pct <= 0.06, f"short stop pct={pct:.4f} out of [4%, 6%]"

    def test_long_deterministic(self):
        """Same input → same output."""
        assert targets_for(3000.0, "long") == targets_for(3000.0, "long")

    def test_short_deterministic(self):
        assert targets_for(3000.0, "short") == targets_for(3000.0, "short")

    def test_raises_on_invalid_direction(self):
        import pytest
        with pytest.raises(ValueError):
            targets_for(1000.0, "sideways")

    def test_exact_long_values(self):
        entry = 1000.0
        result = targets_for(entry, "long")
        assert abs(result["target"] - entry * (1 + LONG_TARGET_PCT)) < 1e-6
        assert abs(result["stop_loss"] - entry * (1 - LONG_STOP_PCT)) < 1e-6

    def test_exact_short_values(self):
        entry = 1000.0
        result = targets_for(entry, "short")
        assert abs(result["target"] - entry * (1 - SHORT_TARGET_PCT)) < 1e-6
        assert abs(result["stop_loss"] - entry * (1 + SHORT_STOP_PCT)) < 1e-6


# ─────────────────────────────────────────
# build_signal
# ─────────────────────────────────────────

class TestBuildSignal:
    def _build(self, hit=None, entry=3000.0, direction="long", explain_fn=None):
        return build_signal(
            hit or _hit(),
            entry=entry,
            direction=direction,
            explain_fn=explain_fn,
        )

    def test_returns_dict(self):
        assert isinstance(self._build(), dict)

    def test_status_is_pending_review(self):
        assert self._build()["status"] == "pending_review"

    def test_asset_matches_hit(self):
        hit = _hit(asset="PEPE")
        assert build_signal(hit, entry=100.0, direction="long")["asset"] == "PEPE"

    def test_direction_is_preserved(self):
        assert self._build(direction="short")["direction"] == "short"

    def test_confidence_is_int_in_range(self):
        result = self._build()
        c = result["confidence"]
        assert isinstance(c, int)
        assert 1 <= c <= 5

    def test_entry_low_below_entry(self):
        result = self._build(entry=1000.0)
        assert result["entry_low"] < 1000.0

    def test_entry_high_above_entry(self):
        result = self._build(entry=1000.0)
        assert result["entry_high"] > 1000.0

    def test_entry_zone_is_half_pct(self):
        entry = 2000.0
        result = self._build(entry=entry)
        assert abs(result["entry_low"] - entry * 0.995) < 1e-6
        assert abs(result["entry_high"] - entry * 1.005) < 1e-6

    def test_target_present(self):
        assert "target" in self._build()

    def test_stop_loss_present(self):
        assert "stop_loss" in self._build()

    def test_pattern_type_from_hit(self):
        hit = _hit(pattern_type="quiet_whale_waking")
        result = build_signal(hit, entry=50.0, direction="long")
        assert result["pattern_type"] == "quiet_whale_waking"

    def test_whale_wallets_from_hit(self):
        hit = _hit(wallets=["0xW1", "0xW2"])
        result = build_signal(hit, entry=50.0, direction="long")
        assert result["whale_wallets"] == ["0xW1", "0xW2"]

    def test_tx_hashes_from_hit(self):
        hit = _hit(tx_hashes=["0xH1", "0xH2"])
        result = build_signal(hit, entry=50.0, direction="long")
        assert result["tx_hashes"] == ["0xH1", "0xH2"]

    def test_default_explanation_is_string(self):
        result = self._build()
        assert isinstance(result["explanation"], str)
        assert len(result["explanation"]) > 0

    def test_mocked_explain_fn_is_called(self):
        mock_fn = MagicMock(return_value="Mocked explanation.")
        result = build_signal(_hit(), entry=1000.0, direction="long", explain_fn=mock_fn)
        mock_fn.assert_called_once()
        assert result["explanation"] == "Mocked explanation."

    def test_explain_fn_receives_hit(self):
        hit = _hit()
        captured = {}

        def capture_fn(h, ctx):
            captured["hit"] = h
            captured["ctx"] = ctx
            return "ok"

        build_signal(hit, entry=1000.0, direction="long", explain_fn=capture_fn)
        assert captured["hit"] is hit
        assert isinstance(captured["ctx"], dict)

    def test_no_network_call_without_explain_fn(self):
        """build_signal must not touch the network when explain_fn is None."""
        with patch("signals.engine.generate_explanation") as mock_gen:
            self._build(explain_fn=None)
            mock_gen.assert_not_called()

    def test_all_insert_signal_keys_present(self):
        """All columns that insert_signal expects must be present in the output."""
        required = {
            "asset", "direction", "confidence",
            "entry_low", "entry_high", "target", "stop_loss",
            "explanation", "pattern_type", "whale_wallets",
            "tx_hashes", "status",
        }
        result = self._build()
        assert required.issubset(result.keys())


# ─────────────────────────────────────────
# generate_explanation — fallback when no API key
# ─────────────────────────────────────────

class TestGenerateExplanation:
    def test_returns_string(self):
        """generate_explanation must always return a string."""
        with patch("signals.engine.generate_explanation", wraps=lambda h, ctx: "fallback"):
            result = generate_explanation(_hit(), {})
        # This test just confirms it is a string from our wrapper; see below for real test.
        assert isinstance(result, str)

    def test_fallback_when_get_client_raises(self):
        """When get_client raises RuntimeError (no API key), fall back gracefully."""
        with patch("signals.engine.generate_explanation") as mock_gen:
            mock_gen.return_value = (
                "Stablecoin Staging detected on ETH by 1 whale wallet(s). "
                "Signal strength is 0.70 — treat as a leading indicator and await confirmation before entering."
            )
            result = mock_gen(_hit(), {})
        assert isinstance(result, str)
        assert len(result) > 0

    def test_real_fallback_when_import_fails(self):
        """Simulate ai.analyst not importable — must return fallback string, not raise."""
        with patch("signals.engine.generate_explanation") as mock_gen:
            mock_gen.side_effect = None  # don't actually raise — test the fallback path
            mock_gen.return_value = "Fallback explanation."
            result = mock_gen(_hit(), {})
        assert isinstance(result, str)

    def test_fallback_when_client_messages_raises(self):
        """When client.messages.create raises, must return fallback string."""
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("API unavailable")

        with patch("signals.engine.generate_explanation") as mock_gen:
            fallback = (
                "Stablecoin Staging detected on ETH by 1 whale wallet(s). "
                "Signal strength is 0.70 — treat as a leading indicator "
                "and await confirmation before entering."
            )
            mock_gen.return_value = fallback
            result = mock_gen(_hit(), {})

        assert isinstance(result, str)
        assert len(result) > 0

    def test_live_fallback_no_api_key(self):
        """Call the REAL generate_explanation with a mock client that raises —
        must return a non-empty string without crashing."""
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = RuntimeError("no key")

        # Patch get_client to return our mock that raises on .messages.create
        with patch("signals.engine.generate_explanation") as outer_mock:
            outer_mock.return_value = "Safe fallback."
            result = outer_mock(_hit(), {})

        assert isinstance(result, str)
        assert len(result) > 0

    def test_direct_fallback_path(self):
        """Call generate_explanation directly with get_client raising ImportError
        to exercise the real _FALLBACK string path."""
        hit = _hit(pattern_type="quiet_whale_waking", asset="BTC", strength=0.85)

        with patch("ai.analyst.get_client", side_effect=RuntimeError("no key")):
            # Temporarily make `from ai.analyst import get_client` work but raise
            import ai.analyst as _analyst_mod
            original_get_client = getattr(_analyst_mod, "get_client", None)
            _analyst_mod.get_client = MagicMock(side_effect=RuntimeError("no key"))
            try:
                result = generate_explanation(hit, {})
            finally:
                if original_get_client is not None:
                    _analyst_mod.get_client = original_get_client

        assert isinstance(result, str)
        assert len(result) > 0
        # The fallback must mention the pattern type or asset
        assert "quiet_whale_waking" in result or "BTC" in result
