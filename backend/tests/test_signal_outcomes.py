"""
Tests for backend/signals/outcomes.py — decide_outcome and resolve_outcomes.

All network/DB calls are mocked. Fully offline.
"""

import sys
import asyncio
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from signals.outcomes import decide_outcome, resolve_outcomes


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def _long_signal(
    entry_low: float = 100.0,
    entry_high: float = 100.0,
    target: float = 110.0,   # +10%
    stop_loss: float = 95.0,  # -5%
    status: str = "active",
    asset: str = "ETH",
    confidence: int = 3,
    outcome_return=None,
    tweet_id=None,
    sig_id: str = "sig-long-001",
) -> dict:
    sig = {
        "id": sig_id,
        "direction": "long",
        "entry_low": entry_low,
        "entry_high": entry_high,
        "target": target,
        "stop_loss": stop_loss,
        "status": status,
        "asset": asset,
        "confidence": confidence,
        "outcome_return": outcome_return,
    }
    if tweet_id is not None:
        sig["tweet_id"] = tweet_id
    return sig


def _short_signal(
    entry_low: float = 100.0,
    entry_high: float = 100.0,
    target: float = 90.0,    # -10%
    stop_loss: float = 106.0,  # +5%
    status: str = "active",
    asset: str = "ETH",
    confidence: int = 3,
    sig_id: str = "sig-short-001",
) -> dict:
    return {
        "id": sig_id,
        "direction": "short",
        "entry_low": entry_low,
        "entry_high": entry_high,
        "target": target,
        "stop_loss": stop_loss,
        "status": status,
        "asset": asset,
        "confidence": confidence,
        "outcome_return": None,
    }


def _run(coro):
    """Run an async coroutine in a fresh event loop."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ─────────────────────────────────────────
# decide_outcome — LONG
# ─────────────────────────────────────────

class TestDecideOutcomeLong:
    """Pure unit tests for decide_outcome with long signals."""

    def test_win_at_target(self):
        sig = _long_signal(target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=110.0)
        assert result is not None
        assert result["status"] == "win"

    def test_win_above_target(self):
        sig = _long_signal(target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=115.0)
        assert result is not None
        assert result["status"] == "win"

    def test_loss_at_stop(self):
        sig = _long_signal(target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=95.0)
        assert result is not None
        assert result["status"] == "loss"

    def test_loss_below_stop(self):
        sig = _long_signal(target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=80.0)
        assert result is not None
        assert result["status"] == "loss"

    def test_none_in_between(self):
        sig = _long_signal(target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=103.0)
        assert result is None

    def test_none_at_entry(self):
        sig = _long_signal(target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=100.0)
        assert result is None

    def test_outcome_return_win_math(self):
        """For long win: outcome_return = (target - entry) / entry = 0.10."""
        sig = _long_signal(entry_low=100.0, entry_high=100.0, target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=112.0)
        # entry midpoint = 100; return = (110-100)/100 = 0.10
        assert result is not None
        assert abs(result["outcome_return"] - 0.10) < 1e-5

    def test_outcome_return_loss_math(self):
        """For long loss: outcome_return = (stop_loss - entry) / entry = -0.05."""
        sig = _long_signal(entry_low=100.0, entry_high=100.0, target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=90.0)
        # return = (95 - 100) / 100 = -0.05
        assert result is not None
        assert abs(result["outcome_return"] - (-0.05)) < 1e-5

    def test_entry_midpoint_used(self):
        """Entry midpoint = (entry_low + entry_high) / 2."""
        sig = _long_signal(entry_low=98.0, entry_high=102.0, target=110.0, stop_loss=95.0)
        result = decide_outcome(sig, price=112.0)
        # entry = (98+102)/2 = 100; return = (110-100)/100 = 0.10
        assert result is not None
        assert abs(result["outcome_return"] - 0.10) < 1e-5


# ─────────────────────────────────────────
# decide_outcome — SHORT
# ─────────────────────────────────────────

class TestDecideOutcomeShort:
    """Pure unit tests for decide_outcome with short signals."""

    def test_win_at_target(self):
        sig = _short_signal(target=90.0, stop_loss=106.0)
        result = decide_outcome(sig, price=90.0)
        assert result is not None
        assert result["status"] == "win"

    def test_win_below_target(self):
        sig = _short_signal(target=90.0, stop_loss=106.0)
        result = decide_outcome(sig, price=85.0)
        assert result is not None
        assert result["status"] == "win"

    def test_loss_at_stop(self):
        sig = _short_signal(target=90.0, stop_loss=106.0)
        result = decide_outcome(sig, price=106.0)
        assert result is not None
        assert result["status"] == "loss"

    def test_loss_above_stop(self):
        sig = _short_signal(target=90.0, stop_loss=106.0)
        result = decide_outcome(sig, price=110.0)
        assert result is not None
        assert result["status"] == "loss"

    def test_none_in_between(self):
        sig = _short_signal(target=90.0, stop_loss=106.0)
        result = decide_outcome(sig, price=98.0)
        assert result is None

    def test_outcome_return_win_math(self):
        """For short win: outcome_return = (entry - target) / entry = 0.10."""
        sig = _short_signal(entry_low=100.0, entry_high=100.0, target=90.0, stop_loss=106.0)
        result = decide_outcome(sig, price=88.0)
        # entry = 100; return = (100-90)/100 = 0.10
        assert result is not None
        assert abs(result["outcome_return"] - 0.10) < 1e-5

    def test_outcome_return_loss_math(self):
        """For short loss: outcome_return = (entry - stop_loss) / entry = -0.06."""
        sig = _short_signal(entry_low=100.0, entry_high=100.0, target=90.0, stop_loss=106.0)
        result = decide_outcome(sig, price=108.0)
        # return = (100 - 106) / 100 = -0.06
        assert result is not None
        assert abs(result["outcome_return"] - (-0.06)) < 1e-5

    def test_short_inverted_vs_long(self):
        """Price above entry is win for long, loss for short."""
        price = 115.0
        long_sig = _long_signal(target=110.0, stop_loss=95.0)
        short_sig = _short_signal(target=90.0, stop_loss=106.0)
        assert decide_outcome(long_sig, price)["status"] == "win"
        assert decide_outcome(short_sig, price)["status"] == "loss"


# ─────────────────────────────────────────
# decide_outcome — Edge cases
# ─────────────────────────────────────────

class TestDecideOutcomeEdgeCases:
    def test_none_for_bad_direction(self):
        sig = {**_long_signal(), "direction": "sideways"}
        assert decide_outcome(sig, 110.0) is None

    def test_none_for_missing_target(self):
        sig = dict(_long_signal())
        del sig["target"]
        assert decide_outcome(sig, 110.0) is None

    def test_none_for_zero_entry(self):
        sig = {**_long_signal(), "entry_low": 0.0, "entry_high": 0.0}
        assert decide_outcome(sig, 110.0) is None

    def test_none_for_non_dict(self):
        assert decide_outcome("not a dict", 100.0) is None

    def test_direction_case_insensitive(self):
        sig = {**_long_signal(), "direction": "LONG"}
        result = decide_outcome(sig, price=115.0)
        assert result is not None
        assert result["status"] == "win"


# ─────────────────────────────────────────
# resolve_outcomes — integration-style (all deps injected)
# ─────────────────────────────────────────

class TestResolveOutcomes:
    """Tests for resolve_outcomes with fully injected deps (no network/DB)."""

    def test_wins_marked_correctly(self):
        """A signal whose price has cleared its target should become 'win'."""
        sig = _long_signal(
            entry_low=100.0, entry_high=100.0,
            target=110.0, stop_loss=95.0,
            asset="ETH", sig_id="sig-win-1",
        )

        update_calls: list[tuple] = []

        async def fake_price(asset):
            return 115.0

        def fake_update(sig_id, data):
            update_calls.append((sig_id, data))
            return {**sig, **data}

        summary_calls: list[dict] = []

        # Patch internal list_signals used by recompute path
        with patch("signals.outcomes._default_list_signals_fn" if False else
                   "signals.outcomes.resolve_outcomes", wraps=resolve_outcomes):
            pass

        result = _run(resolve_outcomes(
            signals=[sig],
            price_fn=fake_price,
            update_fn=fake_update,
            summary_fn=summary_calls.append,
            list_active_fn=lambda: [sig],
        ))

        assert result["resolved"] == 1
        assert result["wins"] == 1
        assert result["losses"] == 0
        assert len(update_calls) == 1
        sid, payload = update_calls[0]
        assert sid == "sig-win-1"
        assert payload["status"] == "win"
        assert abs(payload["outcome_return"] - 0.10) < 1e-5
        assert "resolved_at" in payload

    def test_losses_marked_correctly(self):
        """A signal whose price has breached the stop should become 'loss'."""
        sig = _long_signal(
            entry_low=100.0, entry_high=100.0,
            target=110.0, stop_loss=95.0,
            asset="ETH", sig_id="sig-loss-1",
        )

        update_calls: list[tuple] = []

        async def fake_price(asset):
            return 90.0

        result = _run(resolve_outcomes(
            signals=[sig],
            price_fn=fake_price,
            update_fn=lambda sid, d: update_calls.append((sid, d)) or {},
            summary_fn=lambda s: None,
            list_active_fn=lambda: [sig],
        ))

        assert result["losses"] == 1
        assert result["wins"] == 0
        sid, payload = update_calls[0]
        assert payload["status"] == "loss"
        assert payload["outcome_return"] < 0

    def test_in_between_skipped(self):
        """A price between stop and target doesn't trigger resolution."""
        sig = _long_signal(
            entry_low=100.0, entry_high=100.0,
            target=110.0, stop_loss=95.0,
            asset="ETH", sig_id="sig-active-1",
        )

        update_calls: list[tuple] = []

        async def fake_price(asset):
            return 103.0

        result = _run(resolve_outcomes(
            signals=[sig],
            price_fn=fake_price,
            update_fn=lambda sid, d: update_calls.append((sid, d)) or {},
            summary_fn=lambda s: None,
            list_active_fn=lambda: [sig],
        ))

        assert result["resolved"] == 0
        assert update_calls == []

    def test_price_unavailable_skipped(self):
        """When price_fn returns None, signal is skipped."""
        sig = _long_signal(asset="UNKNOWN_TOKEN", sig_id="sig-skip-1")

        update_calls: list[tuple] = []

        async def fake_price(asset):
            return None

        result = _run(resolve_outcomes(
            signals=[sig],
            price_fn=fake_price,
            update_fn=lambda sid, d: update_calls.append((sid, d)) or {},
            summary_fn=lambda s: None,
            list_active_fn=lambda: [sig],
        ))

        assert result["skipped"] >= 1
        assert update_calls == []

    def test_summary_recompute_invoked(self):
        """summary_fn is always called after a resolve cycle."""
        sig = _long_signal(asset="ETH", sig_id="sig-summary-test")
        summary_calls: list[dict] = []

        async def fake_price(asset):
            return 115.0

        # Patch the internal db.supabase.list_signals used for track record recompute
        with patch("db.supabase.list_signals", return_value=[]):
            _run(resolve_outcomes(
                signals=[sig],
                price_fn=fake_price,
                update_fn=lambda sid, d: {**d},
                summary_fn=summary_calls.append,
                list_active_fn=lambda: [sig],
            ))

        assert len(summary_calls) == 1, "summary_fn must be called once per cycle"

    def test_multiple_signals_resolved_independently(self):
        """Each signal is evaluated independently."""
        win_sig = _long_signal(
            entry_low=100.0, entry_high=100.0,
            target=110.0, stop_loss=95.0,
            asset="ETH", sig_id="sig-w",
        )
        loss_sig = _long_signal(
            entry_low=100.0, entry_high=100.0,
            target=110.0, stop_loss=95.0,
            asset="BTC", sig_id="sig-l",
        )

        prices = {"ETH": 115.0, "BTC": 90.0}

        async def fake_price(asset):
            return prices.get(asset)

        update_calls: list[tuple] = []

        with patch("db.supabase.list_signals", return_value=[]):
            result = _run(resolve_outcomes(
                signals=[win_sig, loss_sig],
                price_fn=fake_price,
                update_fn=lambda sid, d: update_calls.append((sid, d)) or {},
                summary_fn=lambda s: None,
                list_active_fn=lambda: [win_sig, loss_sig],
            ))

        assert result["resolved"] == 2
        assert result["wins"] == 1
        assert result["losses"] == 1

    def test_update_fn_payload_has_required_keys(self):
        """update_fn payload must contain status, outcome_return, resolved_at."""
        sig = _long_signal(asset="ETH", sig_id="sig-payload-check")

        payloads: list[dict] = []

        async def fake_price(asset):
            return 115.0

        with patch("db.supabase.list_signals", return_value=[]):
            _run(resolve_outcomes(
                signals=[sig],
                price_fn=fake_price,
                update_fn=lambda sid, d: payloads.append(d) or {},
                summary_fn=lambda s: None,
                list_active_fn=lambda: [sig],
            ))

        assert len(payloads) == 1
        p = payloads[0]
        assert "status" in p
        assert "outcome_return" in p
        assert "resolved_at" in p
