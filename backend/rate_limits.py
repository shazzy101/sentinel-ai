"""
Central rate-limit key + human-readable exceeded responses.
"""

from __future__ import annotations

from fastapi import Request
from slowapi.util import get_remote_address


def rate_limit_key(request: Request) -> str:
    """Prefer authenticated user id; fall back to client IP."""
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)


def rate_limit_message(route: str | None = None) -> str:
    hints = {
        "/api/ask": "Ask AI is limited to prevent abuse. Wait a minute or upgrade to Pro.",
        "/api/scan": "Wallet scans are rate-limited. Try again in a minute.",
        "/api/copy-trading": "Tracking is limited — wait before adding more traders.",
    }
    if route:
        for prefix, msg in hints.items():
            if route.startswith(prefix):
                return msg
    return "Too many requests. Please slow down and try again in a minute."
