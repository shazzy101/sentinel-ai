"""
Optional Supabase JWT resolution for per-user quotas and logging.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Optional

import httpx

from db.supabase import supabase_client

_USER_CACHE: dict[str, tuple[float, "AuthUser"]] = {}
_CACHE_TTL_SECS = 300


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    email: str | None
    plan: str  # free | pro | anonymous


def _cache_get(token: str) -> AuthUser | None:
    entry = _USER_CACHE.get(token)
    if not entry:
        return None
    expires_at, user = entry
    if time.monotonic() > expires_at:
        _USER_CACHE.pop(token, None)
        return None
    return user


def _cache_set(token: str, user: AuthUser) -> None:
    _USER_CACHE[token] = (time.monotonic() + _CACHE_TTL_SECS, user)


def _fetch_plan(user_id: str) -> str:
    try:
        row = (
            supabase_client.table("profiles")
            .select("plan, trial_ends_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if not row.data:
            return "free"
        profile = row.data[0]
        if profile.get("plan") == "pro":
            return "pro"
        trial_ends = profile.get("trial_ends_at")
        if trial_ends:
            from datetime import datetime, timezone

            try:
                end = datetime.fromisoformat(str(trial_ends).replace("Z", "+00:00"))
                if end > datetime.now(timezone.utc):
                    return "pro"
            except Exception:
                pass
        return "free"
    except Exception:
        return "free"


async def resolve_user(authorization: str | None) -> AuthUser | None:
    """Validate Bearer JWT via Supabase Auth and load plan tier."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None

    cached = _cache_get(token)
    if cached:
        return cached

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                f"{url.rstrip('/')}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": key,
                },
            )
        if res.status_code != 200:
            return None
        body = res.json()
        user_id = body.get("id")
        if not user_id:
            return None
        plan = _fetch_plan(user_id)
        user = AuthUser(user_id=user_id, email=body.get("email"), plan=plan)
        _cache_set(token, user)
        return user
    except Exception:
        return None


def is_pro(user: AuthUser | None) -> bool:
    return bool(user and user.plan == "pro")
