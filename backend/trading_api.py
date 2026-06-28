"""APEX trading API router.

All paper-trading endpoints live here under the /api/trading prefix. Mounted in
main.py alongside signals_router. See docs/APEX_TRADING_PLAN_SENTINEL.md.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/trading", tags=["trading"])


@router.get("/health")
async def trading_health() -> dict:
    """Liveness probe for the APEX module. Expanded in Step 12."""
    return {"status": "ok"}
