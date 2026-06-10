"""
Structured logging + request context for Sentinel API.
JSON logs in production; human-readable in local dev.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
user_plan_var: ContextVar[str] = ContextVar("user_plan", default="anonymous")

_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
_JSON_LOGS = os.getenv("LOG_FORMAT", "json" if os.getenv("ENVIRONMENT") == "production" else "text") == "json"


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id_var.get() or None,
            "user_id": user_id_var.get(),
            "user_plan": user_plan_var.get(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for key in ("event", "path", "method", "status", "duration_ms", "route", "error_code"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        extra = getattr(record, "extra_fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        return json.dumps({k: v for k, v in payload.items() if v is not None}, default=str)


def setup_logging() -> None:
    root = logging.getLogger()
    if root.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    if _JSON_LOGS:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )
    root.addHandler(handler)
    root.setLevel(_LOG_LEVEL)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def new_request_id() -> str:
    return uuid.uuid4().hex[:12]


def bind_request_context(
    *,
    request_id: str | None = None,
    user_id: str | None = None,
    user_plan: str | None = None,
) -> str:
    rid = request_id or new_request_id()
    request_id_var.set(rid)
    if user_id is not None:
        user_id_var.set(user_id)
    if user_plan is not None:
        user_plan_var.set(user_plan)
    return rid


def log_event(level: int, event: str, **fields: Any) -> None:
    logger = logging.getLogger("sentinel")
    record = logger.makeRecord(
        logger.name,
        level,
        "(observability)",
        0,
        event,
        (),
        None,
    )
    record.event = event  # type: ignore[attr-defined]
    record.extra_fields = fields  # type: ignore[attr-defined]
    logger.handle(record)


def log_info(event: str, **fields: Any) -> None:
    log_event(logging.INFO, event, **fields)


def log_warning(event: str, **fields: Any) -> None:
    log_event(logging.WARNING, event, **fields)


def log_error(event: str, **fields: Any) -> None:
    log_event(logging.ERROR, event, **fields)


class RequestTimer:
    """Context manager for timed operations."""

    def __init__(self, event: str, **fields: Any):
        self.event = event
        self.fields = fields
        self._start = 0.0

    def __enter__(self) -> RequestTimer:
        self._start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        duration_ms = round((time.perf_counter() - self._start) * 1000, 1)
        payload = {**self.fields, "duration_ms": duration_ms}
        if exc:
            log_error(self.event, error=str(exc), **payload)
        else:
            log_info(self.event, **payload)
