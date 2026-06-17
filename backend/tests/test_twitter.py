"""
Tests for backend/integrations/twitter.py (Task 16).

All tweepy calls are mocked — never hits the network.
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

# ---------------------------------------------------------------------------
# Ensure tweepy is importable even when not installed in the test env:
# we inject a fake module so twitter.py can import it.
# ---------------------------------------------------------------------------
if "tweepy" not in sys.modules:
    _fake_tweepy = MagicMock()
    sys.modules["tweepy"] = _fake_tweepy

import tweepy as _tweepy_mod  # noqa: E402 — after sys.modules stub

from integrations.twitter import (  # noqa: E402
    _get_client,
    _render_stars,
    format_signal_tweet,
    post_signal,
    reply_outcome,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TWITTER_ENV_KEYS = (
    "TWITTER_API_KEY",
    "TWITTER_API_SECRET",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_SECRET",
)


def _mock_env(**kwargs):
    """Return a dict of env overrides with all Twitter keys present unless overridden."""
    defaults = {
        "TWITTER_API_KEY": "api_key_val",
        "TWITTER_API_SECRET": "api_secret_val",
        "TWITTER_ACCESS_TOKEN": "access_token_val",
        "TWITTER_ACCESS_SECRET": "access_secret_val",
    }
    defaults.update(kwargs)
    return defaults


def _sample_signal(**overrides) -> dict:
    base = {
        "id": "sig-abc-123",
        "signal_number": 42,
        "asset": "ETH",
        "direction": "long",
        "confidence": 3,
        "entry_low": 3200.0,
        "entry_high": 3200.0,
        "target": 3520.0,
        "stop_loss": 3040.0,
        "explanation": "Whale accumulation detected across 5 wallets",
        "created_at": "2026-06-17T12:00:00+00:00",
        "approved_at": "2026-06-17T12:05:00+00:00",
        "tweet_id": None,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# _render_stars
# ---------------------------------------------------------------------------

class TestRenderStars:
    def test_three_stars(self):
        assert _render_stars(3) == "★★★☆☆"

    def test_five_stars(self):
        assert _render_stars(5) == "★★★★★"

    def test_zero_stars(self):
        assert _render_stars(0) == "☆☆☆☆☆"

    def test_one_star(self):
        assert _render_stars(1) == "★☆☆☆☆"

    def test_always_five_chars(self):
        for n in range(0, 6):
            s = _render_stars(n)
            assert len(s) == 5, f"Expected len 5 for confidence={n}, got {len(s)!r}"

    def test_clamps_above_five(self):
        assert _render_stars(10) == "★★★★★"

    def test_bad_type_returns_empty(self):
        assert _render_stars(None) == "☆☆☆☆☆"


# ---------------------------------------------------------------------------
# format_signal_tweet
# ---------------------------------------------------------------------------

class TestFormatSignalTweet:
    """Strict structural tests against the canonical template."""

    def _tweet(self, **overrides) -> str:
        return format_signal_tweet(_sample_signal(**overrides))

    def test_contains_whale_header(self):
        t = self._tweet()
        assert "🐋 HADALEUM SIGNAL #42" in t

    def test_contains_asset_uppercased(self):
        t = self._tweet(asset="eth")
        assert "ETH" in t

    def test_long_direction_capitalised(self):
        t = self._tweet(direction="long")
        assert "Long" in t
        assert "long" not in t  # raw lowercase must not appear

    def test_short_direction_capitalised(self):
        t = self._tweet(direction="short")
        assert "Short" in t

    def test_contains_confidence_label(self):
        t = self._tweet()
        assert "Confidence:" in t

    def test_stars_length_five(self):
        t = self._tweet(confidence=3)
        # Find the stars substring: exactly 5 chars of ★/☆
        import re
        match = re.search(r"[★☆]{5}", t)
        assert match is not None, "No 5-char stars sequence found in tweet"
        assert len(match.group()) == 5

    def test_contains_entry_line(self):
        t = self._tweet()
        assert "Entry: $" in t

    def test_contains_target_line_with_pct(self):
        t = self._tweet()
        assert "Target: $" in t
        assert "(+" in t or "(-" in t  # positive or negative pct

    def test_target_positive_pct_present(self):
        # entry=3200, target=3520 → +10%
        t = self._tweet(entry_low=3200.0, entry_high=3200.0, target=3520.0)
        assert "(+" in t

    def test_contains_stop_line(self):
        t = self._tweet()
        assert "Stop: $" in t

    def test_contains_why_explanation(self):
        t = self._tweet(explanation="Whale accumulation detected across 5 wallets")
        assert "Why: Whale accumulation detected across 5 wallets" in t

    def test_contains_timestamp(self):
        t = self._tweet()
        assert "Timestamp:" in t

    def test_contains_track_record_link(self):
        t = self._tweet()
        assert "Track record: hadaleum.com/track-record" in t

    def test_contains_hashtags(self):
        t = self._tweet()
        assert "#crypto" in t
        assert "#ethereum" in t
        assert "#whale" in t

    def test_relative_ordering_of_key_lines(self):
        """Key sections must appear in the prescribed order."""
        t = self._tweet()
        header_pos = t.index("🐋 HADALEUM SIGNAL")
        asset_pos = t.index("ETH Long detected")
        conf_pos = t.index("Confidence:")
        entry_pos = t.index("Entry: $")
        target_pos = t.index("Target: $")
        stop_pos = t.index("Stop: $")
        why_pos = t.index("Why:")
        ts_pos = t.index("Timestamp:")
        track_pos = t.index("Track record:")
        assert header_pos < asset_pos < conf_pos < entry_pos < target_pos < stop_pos < why_pos < ts_pos < track_pos

    def test_defensive_on_none_fields(self):
        """format_signal_tweet must not raise when optional fields are None."""
        t = format_signal_tweet({
            "signal_number": None,
            "asset": None,
            "direction": None,
            "confidence": None,
            "entry_low": None,
            "entry_high": None,
            "target": None,
            "stop_loss": None,
            "explanation": None,
            "created_at": None,
            "approved_at": None,
        })
        assert "🐋 HADALEUM SIGNAL" in t
        assert "Track record: hadaleum.com/track-record" in t

    def test_short_signal_tweet(self):
        t = format_signal_tweet(_sample_signal(
            direction="short", asset="BTC",
            entry_low=65000.0, entry_high=65000.0,
            target=58500.0, stop_loss=67500.0,
        ))
        assert "BTC Short detected" in t
        # target < entry → pct should be negative
        assert "(-" in t

    def test_signal_number_in_header(self):
        t = format_signal_tweet(_sample_signal(signal_number=7))
        assert "HADALEUM SIGNAL #7" in t


# ---------------------------------------------------------------------------
# _get_client
# ---------------------------------------------------------------------------

class TestGetClient:
    def test_returns_none_when_no_creds(self):
        """All env vars absent → None, no crash."""
        clean = {k: "" for k in _TWITTER_ENV_KEYS}
        with patch.dict(os.environ, clean, clear=False):
            # Temporarily remove the keys
            for k in _TWITTER_ENV_KEYS:
                os.environ.pop(k, None)
            result = _get_client()
        assert result is None

    def test_returns_client_when_creds_present(self):
        """All four creds present → a tweepy.Client (or mock) is returned."""
        mock_client_instance = MagicMock()
        mock_tweepy = MagicMock()
        mock_tweepy.Client.return_value = mock_client_instance

        with patch.dict(os.environ, _mock_env()):
            with patch.dict(sys.modules, {"tweepy": mock_tweepy}):
                result = _get_client()

        assert result is not None
        mock_tweepy.Client.assert_called_once_with(
            consumer_key="api_key_val",
            consumer_secret="api_secret_val",
            access_token="access_token_val",
            access_token_secret="access_secret_val",
        )

    def test_returns_none_if_single_cred_missing(self):
        """One missing cred → None."""
        env = _mock_env()
        env.pop("TWITTER_ACCESS_SECRET")
        with patch.dict(os.environ, env, clear=False):
            os.environ.pop("TWITTER_ACCESS_SECRET", None)
            result = _get_client()
        assert result is None


# ---------------------------------------------------------------------------
# post_signal
# ---------------------------------------------------------------------------

class TestPostSignal:
    def test_returns_tweet_id_on_success(self):
        """post_signal with mocked client returns the tweet id."""
        mock_response = MagicMock()
        mock_response.data = {"id": "1234567890"}

        mock_client = MagicMock()
        mock_client.create_tweet.return_value = mock_response

        with patch("integrations.twitter._get_client", return_value=mock_client):
            result = post_signal(_sample_signal())

        assert result == "1234567890"

    def test_create_tweet_called_with_formatted_text(self):
        """create_tweet is called with the formatted signal text."""
        mock_response = MagicMock()
        mock_response.data = {"id": "9999"}

        mock_client = MagicMock()
        mock_client.create_tweet.return_value = mock_response

        sig = _sample_signal(signal_number=42, asset="ETH", direction="long", confidence=3)

        with patch("integrations.twitter._get_client", return_value=mock_client):
            post_signal(sig)

        call_kwargs = mock_client.create_tweet.call_args
        text_sent = call_kwargs.kwargs.get("text") or call_kwargs.args[0] if call_kwargs.args else call_kwargs.kwargs["text"]
        assert "🐋 HADALEUM SIGNAL #42" in text_sent
        assert "ETH Long detected" in text_sent

    def test_returns_none_when_no_creds(self):
        """No credentials → None, no exception raised."""
        with patch("integrations.twitter._get_client", return_value=None):
            result = post_signal(_sample_signal())
        assert result is None

    def test_returns_none_on_api_error(self):
        """Tweepy exception → None, not raised."""
        mock_client = MagicMock()
        mock_client.create_tweet.side_effect = RuntimeError("rate limited")

        with patch("integrations.twitter._get_client", return_value=mock_client):
            result = post_signal(_sample_signal())
        assert result is None


# ---------------------------------------------------------------------------
# reply_outcome
# ---------------------------------------------------------------------------

class TestReplyOutcome:
    def test_calls_create_tweet_with_in_reply_to(self):
        """When tweet_id present, create_tweet is called with in_reply_to_tweet_id."""
        mock_response = MagicMock()
        mock_response.data = {"id": "reply-111"}
        mock_client = MagicMock()
        mock_client.create_tweet.return_value = mock_response

        sig = _sample_signal(tweet_id="orig-999", status="win", outcome_return=0.10)

        with patch("integrations.twitter._get_client", return_value=mock_client):
            result = reply_outcome(sig)

        assert result == "reply-111"
        call_kwargs = mock_client.create_tweet.call_args.kwargs
        assert call_kwargs["in_reply_to_tweet_id"] == "orig-999"
        assert "✅ WIN" in call_kwargs["text"]
        assert "+10.0%" in call_kwargs["text"]

    def test_reply_loss_text(self):
        """Loss outcome has ❌ in reply text."""
        mock_response = MagicMock()
        mock_response.data = {"id": "reply-222"}
        mock_client = MagicMock()
        mock_client.create_tweet.return_value = mock_response

        sig = _sample_signal(tweet_id="orig-888", status="loss", outcome_return=-0.05)

        with patch("integrations.twitter._get_client", return_value=mock_client):
            result = reply_outcome(sig)

        call_text = mock_client.create_tweet.call_args.kwargs["text"]
        assert "❌ LOSS" in call_text
        assert "-5.0%" in call_text

    def test_no_op_when_no_tweet_id(self):
        """No tweet_id → None, create_tweet never called."""
        mock_client = MagicMock()
        sig = _sample_signal(tweet_id=None)

        with patch("integrations.twitter._get_client", return_value=mock_client):
            result = reply_outcome(sig)

        assert result is None
        mock_client.create_tweet.assert_not_called()

    def test_no_op_when_tweet_id_missing_key(self):
        """tweet_id key absent entirely → None."""
        sig = _sample_signal()
        sig.pop("tweet_id", None)

        mock_client = MagicMock()
        with patch("integrations.twitter._get_client", return_value=mock_client):
            result = reply_outcome(sig)

        assert result is None
        mock_client.create_tweet.assert_not_called()

    def test_no_op_when_no_client(self):
        """No client → None, does not raise."""
        sig = _sample_signal(tweet_id="orig-777", status="win", outcome_return=0.08)
        with patch("integrations.twitter._get_client", return_value=None):
            result = reply_outcome(sig)
        assert result is None

    def test_returns_none_on_api_error(self):
        """Tweepy exception → None, not raised."""
        mock_client = MagicMock()
        mock_client.create_tweet.side_effect = RuntimeError("network error")

        sig = _sample_signal(tweet_id="orig-555", status="win", outcome_return=0.05)
        with patch("integrations.twitter._get_client", return_value=mock_client):
            result = reply_outcome(sig)
        assert result is None
