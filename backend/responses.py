"""Consistent JSON response helpers for the Sentinel API."""

import math
from typing import Any, Optional

from fastapi.responses import JSONResponse

from observability import log_error, request_id_var


def _sanitize_for_json(obj: Any) -> Any:
    """Replace NaN/Inf so JSONResponse never crashes on float edge cases."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]
    return obj


def _request_id() -> str | None:
    rid = request_id_var.get()
    return rid or None


def success(data: Any, status_code: int = 200) -> JSONResponse:
    payload: dict = {"success": True, "data": _sanitize_for_json(data)}
    rid = _request_id()
    if rid:
        payload["request_id"] = rid
    return JSONResponse(status_code=status_code, content=payload)


def error(
    code: str,
    message: str,
    status_code: int = 400,
    details: Optional[dict] = None,
) -> JSONResponse:
    err: dict = {"code": code, "message": message}
    if details:
        err["details"] = details
    payload: dict = {"success": False, "error": err}
    rid = _request_id()
    if rid:
        payload["request_id"] = rid
        if details is None:
            err["details"] = {"request_id": rid}
        elif "request_id" not in details:
            err["details"] = {**details, "request_id": rid}
    return JSONResponse(status_code=status_code, content=payload)


def quota_error(quota_status, status_code: int = 429) -> JSONResponse:
    """Structured response when per-user or global AI quota is exceeded."""
    return error(
        quota_status.reason_code or "QUOTA_EXCEEDED",
        quota_status.message or "Quota exceeded",
        status_code=status_code,
        details={
            "retry_after_seconds": quota_status.retry_after_seconds,
            "plan": quota_status.plan,
            "global_calls_remaining": quota_status.global_calls_remaining,
            "user_ask_remaining": quota_status.user_ask_remaining,
            "user_tokens_remaining": quota_status.user_tokens_remaining,
            "user_scan_remaining": quota_status.user_scan_remaining,
        },
    )
