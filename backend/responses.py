"""Consistent JSON response helpers for the Sentinel API."""

from typing import Any, Optional

from fastapi.responses import JSONResponse


def success(data: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": True, "data": data})


def error(
    code: str,
    message: str,
    status_code: int = 400,
    details: Optional[dict] = None,
) -> JSONResponse:
    payload: dict = {
        "success": False,
        "error": {"code": code, "message": message},
    }
    if details:
        payload["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=payload)
