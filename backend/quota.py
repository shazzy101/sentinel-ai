"""
Per-user AI quotas (sliding 1-hour window) + global Claude budget tracking.
"""

from __future__ import annotations

import os
import time
from collections import deque, defaultdict
from dataclasses import dataclass
from typing import Optional

from auth_context import AuthUser, is_pro

# Global Claude call budget (shared across all users + crons)
_global_call_timestamps: deque[float] = deque()
MAX_GLOBAL_CALLS_PER_HOUR = int(os.getenv("CLAUDE_MAX_CALLS_PER_HOUR", "80"))

# Per-user limits
FREE_ASK_CALLS_PER_HOUR = int(os.getenv("FREE_ASK_CALLS_PER_HOUR", "10"))
PRO_ASK_CALLS_PER_HOUR = int(os.getenv("PRO_ASK_CALLS_PER_HOUR", "60"))
ANON_ASK_CALLS_PER_HOUR = int(os.getenv("ANON_ASK_CALLS_PER_HOUR", "5"))

FREE_TOKENS_PER_HOUR = int(os.getenv("FREE_TOKENS_PER_HOUR", "25000"))
PRO_TOKENS_PER_HOUR = int(os.getenv("PRO_TOKENS_PER_HOUR", "150000"))
ANON_TOKENS_PER_HOUR = int(os.getenv("ANON_TOKENS_PER_HOUR", "8000"))

FREE_SCAN_CALLS_PER_HOUR = int(os.getenv("FREE_SCAN_CALLS_PER_HOUR", "5"))
PRO_SCAN_CALLS_PER_HOUR = int(os.getenv("PRO_SCAN_CALLS_PER_HOUR", "30"))

_user_ask_calls: dict[str, deque[float]] = defaultdict(deque)
_user_tokens: dict[str, deque[tuple[float, int]]] = defaultdict(deque)
_user_scan_calls: dict[str, deque[float]] = defaultdict(deque)


# Periodic eviction of idle per-user buckets so the dicts don't grow without
# bound as new users/IPs appear. A key is dropped once its newest entry is older
# than the stale threshold (well past the 1-hour sliding window).
_CLEANUP_INTERVAL_S = 300.0
_STALE_AFTER_S = 7200.0  # 2 hours
_last_cleanup_ts = 0.0


def _evict_stale_buckets(now: float) -> None:
    global _last_cleanup_ts
    if now - _last_cleanup_ts < _CLEANUP_INTERVAL_S:
        return
    _last_cleanup_ts = now
    cutoff = now - _STALE_AFTER_S
    for store in (_user_ask_calls, _user_scan_calls):
        for k in [k for k, b in store.items() if not b or b[-1] < cutoff]:
            del store[k]
    for k in [k for k, b in _user_tokens.items() if not b or b[-1][0] < cutoff]:
        del _user_tokens[k]


def _prune_ts(bucket: deque[float], now: float, window: float = 3600.0) -> None:
    cutoff = now - window
    while bucket and bucket[0] < cutoff:
        bucket.popleft()


def _prune_tokens(bucket: deque[tuple[float, int]], now: float, window: float = 3600.0) -> int:
    cutoff = now - window
    total = 0
    while bucket and bucket[0][0] < cutoff:
        bucket.popleft()
    for _, n in bucket:
        total += n
    return total


def _user_key(user: AuthUser | None, ip: str) -> str:
    if user:
        return f"user:{user.user_id}"
    return f"ip:{ip}"


@dataclass
class QuotaStatus:
    allowed: bool
    reason_code: str | None = None
    message: str | None = None
    retry_after_seconds: int | None = None
    global_calls_remaining: int = 0
    user_ask_remaining: int = 0
    user_tokens_remaining: int = 0
    user_scan_remaining: int = 0
    plan: str = "anonymous"


def _ask_limit(user: AuthUser | None) -> int:
    if user and is_pro(user):
        return PRO_ASK_CALLS_PER_HOUR
    if user:
        return FREE_ASK_CALLS_PER_HOUR
    return ANON_ASK_CALLS_PER_HOUR


def _token_limit(user: AuthUser | None) -> int:
    if user and is_pro(user):
        return PRO_TOKENS_PER_HOUR
    if user:
        return FREE_TOKENS_PER_HOUR
    return ANON_TOKENS_PER_HOUR


def _scan_limit(user: AuthUser | None) -> int:
    if user and is_pro(user):
        return PRO_SCAN_CALLS_PER_HOUR
    return FREE_SCAN_CALLS_PER_HOUR


def global_calls_remaining() -> int:
    now = time.monotonic()
    _prune_ts(_global_call_timestamps, now)
    return max(0, MAX_GLOBAL_CALLS_PER_HOUR - len(_global_call_timestamps))


def peek_global_budget() -> bool:
    now = time.monotonic()
    _prune_ts(_global_call_timestamps, now)
    return len(_global_call_timestamps) < MAX_GLOBAL_CALLS_PER_HOUR


def consume_global_budget() -> bool:
    now = time.monotonic()
    _prune_ts(_global_call_timestamps, now)
    if len(_global_call_timestamps) >= MAX_GLOBAL_CALLS_PER_HOUR:
        return False
    _global_call_timestamps.append(now)
    return True


def record_token_usage(user: AuthUser | None, ip: str, tokens: int) -> None:
    if tokens <= 0:
        return
    key = _user_key(user, ip)
    now = time.monotonic()
    bucket = _user_tokens[key]
    _prune_tokens(bucket, now)
    bucket.append((now, tokens))


def get_quota_status(user: AuthUser | None, ip: str) -> QuotaStatus:
    now = time.monotonic()
    _evict_stale_buckets(now)
    key = _user_key(user, ip)
    plan = user.plan if user else "anonymous"

    _prune_ts(_global_call_timestamps, now)
    global_remaining = max(0, MAX_GLOBAL_CALLS_PER_HOUR - len(_global_call_timestamps))

    ask_bucket = _user_ask_calls[key]
    _prune_ts(ask_bucket, now)
    ask_limit = _ask_limit(user)
    ask_remaining = max(0, ask_limit - len(ask_bucket))

    token_bucket = _user_tokens[key]
    tokens_used = _prune_tokens(token_bucket, now)
    token_limit = _token_limit(user)
    tokens_remaining = max(0, token_limit - tokens_used)

    scan_bucket = _user_scan_calls[key]
    _prune_ts(scan_bucket, now)
    scan_limit = _scan_limit(user)
    scan_remaining = max(0, scan_limit - len(scan_bucket))

    return QuotaStatus(
        allowed=True,
        global_calls_remaining=global_remaining,
        user_ask_remaining=ask_remaining,
        user_tokens_remaining=tokens_remaining,
        user_scan_remaining=scan_remaining,
        plan=plan,
    )


def check_ask_quota(user: AuthUser | None, ip: str, estimated_tokens: int = 2000) -> QuotaStatus:
    status = get_quota_status(user, ip)
    if status.global_calls_remaining <= 0:
        return QuotaStatus(
            allowed=False,
            reason_code="GLOBAL_AI_BUDGET",
            message=(
                "Hadaleum AI is at its shared hourly capacity. "
                "Cached Intelligence and wallet scores still work — try again in ~15 minutes."
            ),
            retry_after_seconds=900,
            plan=status.plan,
            global_calls_remaining=0,
            user_ask_remaining=status.user_ask_remaining,
            user_tokens_remaining=status.user_tokens_remaining,
            user_scan_remaining=status.user_scan_remaining,
        )
    if status.user_ask_remaining <= 0:
        upgrade_hint = " Upgrade to Pro for 6× more Ask AI messages." if not is_pro(user) else ""
        return QuotaStatus(
            allowed=False,
            reason_code="USER_ASK_LIMIT",
            message=f"You've used your hourly Ask AI limit.{upgrade_hint}",
            retry_after_seconds=3600,
            plan=status.plan,
            global_calls_remaining=status.global_calls_remaining,
            user_ask_remaining=0,
            user_tokens_remaining=status.user_tokens_remaining,
            user_scan_remaining=status.user_scan_remaining,
        )
    if status.user_tokens_remaining < estimated_tokens:
        upgrade_hint = " Pro unlocks a higher token budget." if not is_pro(user) else ""
        return QuotaStatus(
            allowed=False,
            reason_code="USER_TOKEN_LIMIT",
            message=f"Hourly AI token budget reached.{upgrade_hint}",
            retry_after_seconds=3600,
            plan=status.plan,
            global_calls_remaining=status.global_calls_remaining,
            user_ask_remaining=status.user_ask_remaining,
            user_tokens_remaining=0,
            user_scan_remaining=status.user_scan_remaining,
        )
    return status


def consume_ask_quota(user: AuthUser | None, ip: str) -> None:
    # Consumes ONLY the per-user ask bucket. The shared global Claude budget is
    # consumed once at the route level (see /api/ask in main.py) so a single
    # request never decrements it twice.
    key = _user_key(user, ip)
    now = time.monotonic()
    _user_ask_calls[key].append(now)


def check_scan_quota(user: AuthUser | None, ip: str) -> QuotaStatus:
    status = get_quota_status(user, ip)
    if status.user_scan_remaining <= 0:
        upgrade_hint = " Pro users get more scans per hour." if not is_pro(user) else ""
        return QuotaStatus(
            allowed=False,
            reason_code="USER_SCAN_LIMIT",
            message=f"Hourly wallet scan limit reached.{upgrade_hint}",
            retry_after_seconds=3600,
            plan=status.plan,
            global_calls_remaining=status.global_calls_remaining,
            user_ask_remaining=status.user_ask_remaining,
            user_tokens_remaining=status.user_tokens_remaining,
            user_scan_remaining=0,
        )
    return status


def consume_scan_quota(user: AuthUser | None, ip: str) -> None:
    key = _user_key(user, ip)
    now = time.monotonic()
    _user_scan_calls[key].append(now)


# ── Atomic check-and-consume (PHASE 1.4) ────────────────────────────────
# The check_*_quota then consume_*_quota two-step had a TOCTOU race: two
# concurrent requests could both pass the check before either consumed, letting
# a user exceed the limit. These functions check and consume with no `await`
# between them. Since the event loop is single-threaded and never yields inside
# the function body, the read-modify-write is effectively atomic.

def try_consume_ask_quota(
    user: AuthUser | None, ip: str, estimated_tokens: int = 2000
) -> tuple[bool, QuotaStatus]:
    """Atomically gate + reserve one Ask AI call. Returns (allowed, status)."""
    status = check_ask_quota(user, ip, estimated_tokens)
    if not status.allowed:
        return False, status
    key = _user_key(user, ip)
    _user_ask_calls[key].append(time.monotonic())
    return True, status


def try_consume_scan_quota(user: AuthUser | None, ip: str) -> tuple[bool, QuotaStatus]:
    """Atomically gate + reserve one wallet scan. Returns (allowed, status)."""
    status = check_scan_quota(user, ip)
    if not status.allowed:
        return False, status
    key = _user_key(user, ip)
    _user_scan_calls[key].append(time.monotonic())
    return True, status
