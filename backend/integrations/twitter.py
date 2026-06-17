"""
Sentinel AI — Twitter/X integration (Hadaleum signal auto-posting).

Reads TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN,
TWITTER_ACCESS_SECRET from the environment.  If any are missing,
_get_client() returns None and all posting functions silently no-op
(they never raise into callers).

Matches the structure/logging/env-var reading pattern of resend.py and dune.py.
"""

import logging
import os
from typing import Optional

_log = logging.getLogger(__name__)

# ── Stars renderer ─────────────────────────────────────────────────────────

def _render_stars(confidence: int) -> str:
    """Return a 5-char star string, e.g. confidence=3 → '★★★☆☆'."""
    try:
        n = max(0, min(5, int(confidence)))
    except (TypeError, ValueError):
        n = 0
    return "★" * n + "☆" * (5 - n)


# ── Tweet formatter ────────────────────────────────────────────────────────

def format_signal_tweet(signal: dict) -> str:
    """
    Produce the canonical Hadaleum signal tweet from a signal dict.

    Template (keep exact blank lines, labels, and emoji):

        🐋 HADALEUM SIGNAL #<number>

        <Asset> <Direction> detected
        Confidence: <stars>

        Entry: $<price>

        Target: $<target> (+<pct>%)

        Stop: $<stop>
        Why: <explanation>
        Timestamp: <ISO timestamp>

        Track record: hadaleum.com/track-record
        #crypto #ethereum #whale
    """
    # ── Extract fields (all defensive) ────────────────────────────────────
    number = signal.get("signal_number") or signal.get("id", "?")
    asset = (signal.get("asset") or "UNKNOWN").upper()
    raw_dir = (signal.get("direction") or "").lower()
    direction = "Long" if raw_dir == "long" else ("Short" if raw_dir == "short" else raw_dir.capitalize())
    confidence = signal.get("confidence") or 0
    stars = _render_stars(confidence)

    # Entry price: midpoint of entry_low / entry_high, or entry_low alone.
    try:
        entry_low = float(signal.get("entry_low") or 0)
    except (TypeError, ValueError):
        entry_low = 0.0
    try:
        entry_high = float(signal.get("entry_high") or entry_low)
    except (TypeError, ValueError):
        entry_high = entry_low
    entry = (entry_low + entry_high) / 2.0 if entry_high else entry_low

    try:
        target = float(signal.get("target") or 0)
    except (TypeError, ValueError):
        target = 0.0

    try:
        stop = float(signal.get("stop_loss") or 0)
    except (TypeError, ValueError):
        stop = 0.0

    # Percent change entry → target
    if entry > 0 and target > 0:
        pct_raw = (target - entry) / entry * 100.0
        # Round to 1 decimal if small, else 0 decimal
        pct = f"{pct_raw:+.1f}" if abs(pct_raw) < 100 else f"{pct_raw:+.0f}"
    else:
        pct = "+0.0"

    explanation = signal.get("explanation") or ""
    timestamp = signal.get("approved_at") or signal.get("created_at") or ""

    # Format prices — strip unnecessary trailing zeros but keep 2 dp minimum
    def _fmt(v: float) -> str:
        if v == 0.0:
            return "0"
        # Show up to 6 sig figs but at least 2 decimal places
        if v >= 1000:
            return f"{v:,.0f}"
        if v >= 1:
            return f"{v:.2f}"
        return f"{v:.6g}"

    lines = [
        f"🐋 HADALEUM SIGNAL #{number}",
        "",
        f"{asset} {direction} detected",
        f"Confidence: {stars}",
        "",
        f"Entry: ${_fmt(entry)}",
        "",
        f"Target: ${_fmt(target)} ({pct}%)",
        "",
        f"Stop: ${_fmt(stop)}",
        f"Why: {explanation}",
        f"Timestamp: {timestamp}",
        "",
        "Track record: hadaleum.com/track-record",
        "#crypto #ethereum #whale",
    ]
    return "\n".join(lines)


# ── Client builder ─────────────────────────────────────────────────────────

def _get_client():
    """
    Build a tweepy.Client from env vars. Returns None if any cred is missing
    (never raises — callers should check for None before posting).
    """
    api_key = os.getenv("TWITTER_API_KEY")
    api_secret = os.getenv("TWITTER_API_SECRET")
    access_token = os.getenv("TWITTER_ACCESS_TOKEN")
    access_secret = os.getenv("TWITTER_ACCESS_SECRET")

    if not all([api_key, api_secret, access_token, access_secret]):
        return None

    try:
        import tweepy  # lazy — absent in dev if not installed
        return tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_secret,
        )
    except Exception as exc:
        _log.warning("twitter: failed to build tweepy client: %s", exc)
        return None


# ── Posting helpers ────────────────────────────────────────────────────────

def post_signal(signal: dict) -> Optional[str]:
    """
    Format and post a signal tweet. Returns the tweet_id (str) on success,
    or None if no credentials, tweepy is absent, or posting fails.
    Never raises — approval must continue even if tweeting fails.
    """
    client = _get_client()
    if client is None:
        _log.info("twitter: post_signal skipped — no client (creds missing or tweepy not installed)")
        return None

    try:
        text = format_signal_tweet(signal)
        response = client.create_tweet(text=text)
        tweet_id = str(response.data["id"])
        _log.info("twitter: posted signal #%s as tweet_id=%s", signal.get("signal_number"), tweet_id)
        return tweet_id
    except Exception as exc:
        _log.error("twitter: post_signal failed: %s", exc)
        return None


def reply_outcome(signal: dict) -> Optional[str]:
    """
    Post a reply tweet to the original signal tweet with the outcome.
    Uses signal['tweet_id'] as in_reply_to_tweet_id.
    Returns the reply tweet_id on success, or None on no-op / failure.
    Never raises.
    """
    tweet_id = signal.get("tweet_id")
    if not tweet_id:
        return None

    client = _get_client()
    if client is None:
        _log.info("twitter: reply_outcome skipped — no client")
        return None

    try:
        status = (signal.get("status") or "").lower()
        outcome_return = signal.get("outcome_return")

        if outcome_return is not None:
            try:
                pct = float(outcome_return) * 100.0
                pct_str = f"{pct:+.1f}%"
            except (TypeError, ValueError):
                pct_str = ""
        else:
            pct_str = ""

        if status == "win":
            text = f"✅ WIN {pct_str} — every call logged on-chain. hadaleum.com/track-record"
        elif status == "loss":
            text = f"❌ LOSS {pct_str} — every call logged on-chain. hadaleum.com/track-record"
        else:
            text = f"Signal resolved ({status}) {pct_str} — hadaleum.com/track-record"

        response = client.create_tweet(text=text, in_reply_to_tweet_id=tweet_id)
        reply_tweet_id = str(response.data["id"])
        _log.info("twitter: replied to tweet_id=%s with reply_id=%s", tweet_id, reply_tweet_id)
        return reply_tweet_id
    except Exception as exc:
        _log.error("twitter: reply_outcome failed: %s", exc)
        return None
