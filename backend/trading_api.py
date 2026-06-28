"""APEX trading API router — all paper-trading endpoints under /api/trading.

Public reads: prices, signals, portfolio, positions, track-record, backtest.
Protected (CRON_SECRET header): signals/generate, positions/monitor, admin reset.
Mounted in main.py alongside signals_router.
"""

from __future__ import annotations

import os
import time
from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from trading.api_clients import fetch_ohlcv, is_market_open
from trading.constants import ASSETS_BY_SYMBOL, PAPER_STARTING_CAPITAL
from trading.engine import run_backtest
from trading import store, runner, analytics

router = APIRouter(prefix="/api/trading", tags=["trading"])


def _require_cron(secret: Optional[str]) -> None:
    expected = os.getenv("CRON_SECRET")
    if not expected or secret != expected:
        raise HTTPException(status_code=401, detail="invalid cron secret")


# ── Step 7: prices ─────────────────────────────────────────────────────────
@router.get("/prices")
async def get_prices(
    asset: str = Query(...), timeframe: str = "5m", limit: int = Query(100, le=500),
):
    if asset not in ASSETS_BY_SYMBOL:
        raise HTTPException(404, f"unknown asset {asset}")
    bars = fetch_ohlcv(asset, timeframe, limit)
    return {"asset": asset, "timeframe": timeframe, "bars": [asdict(b) for b in bars],
            "market_open": is_market_open()}


@router.get("/prices/{asset:path}")
async def get_last_price(asset: str):
    if asset not in ASSETS_BY_SYMBOL:
        raise HTTPException(404, f"unknown asset {asset}")
    bars = fetch_ohlcv(asset, "5m", 100)
    if not bars:
        raise HTTPException(503, "no price data")
    last = bars[-1]
    day = [b for b in bars if b.day == last.day]
    return {
        "asset": asset, "price": last.close,
        "change_24h_pct": round((last.close - bars[0].close) / bars[0].close * 100, 2) if bars[0].close else 0,
        "high": max(b.high for b in day), "low": min(b.low for b in day),
        "ts": last.ts,
    }


# ── Step 8: signal generation + reads ──────────────────────────────────────
@router.post("/signals/generate")
async def generate(x_cron_secret: Optional[str] = Header(None)):
    _require_cron(x_cron_secret)
    return runner.generate_signals()


@router.get("/signals")
async def get_signals(
    asset: Optional[str] = None, status: Optional[str] = None,
    strategy: Optional[str] = None, limit: int = Query(50, le=200), offset: int = 0,
):
    return {"signals": store.list_signals(asset=asset, status=status, strategy=strategy,
                                          limit=limit, offset=offset)}


@router.get("/signals/latest")
async def get_latest_signals():
    return {"signals": store.latest_signals(10)}


# ── Step 9: position monitor + reads ───────────────────────────────────────
@router.post("/positions/monitor")
async def monitor(x_cron_secret: Optional[str] = Header(None)):
    _require_cron(x_cron_secret)
    return runner.monitor_positions()


@router.get("/positions")
async def get_positions():
    open_pos = store.open_positions()
    # attach live unrealized P&L
    for p in open_pos:
        try:
            bars = fetch_ohlcv(p["asset"], "5m", 1)
            if bars:
                price = bars[-1].close
                entry = float(p["entry_price"])
                is_long = p["direction"] == "LONG"
                p["current_price"] = price
                p["unrealized_pct"] = round((price - entry) / entry * 100 * (1 if is_long else -1), 2)
        except Exception:
            p["current_price"] = None
            p["unrealized_pct"] = None
    return {"open": open_pos, "closed_today": store.closed_today()}


# ── Step 10: portfolio ─────────────────────────────────────────────────────
@router.get("/portfolio")
async def get_portfolio():
    return analytics.build_portfolio()


@router.get("/portfolio/stats")
async def get_portfolio_stats(window: str = Query("all", pattern="^(7d|30d|all)$")):
    return analytics.rolling_stats(window)


# ── Step 11: backtest (10-min in-memory cache) ─────────────────────────────
class BacktestBody(BaseModel):
    asset: str
    timeframe: str = "5m"
    days: int = Field(30, ge=1, le=90)
    starting_capital: float = Field(PAPER_STARTING_CAPITAL, gt=0)
    risk_pct: float = Field(0.02, gt=0, le=0.5)
    min_votes: int = Field(2, ge=1, le=7)
    strategies: Optional[list[str]] = None

    @field_validator("asset")
    @classmethod
    def _known(cls, v: str) -> str:
        if v not in ASSETS_BY_SYMBOL:
            raise ValueError(f"unknown asset {v}")
        return v


_BT_CACHE: dict[str, tuple[float, dict]] = {}
_BT_TTL = 600  # 10 min


def _bt_key(b: BacktestBody, compare: bool) -> str:
    return f"{b.asset}|{b.timeframe}|{b.days}|{b.starting_capital}|{b.risk_pct}|{b.min_votes}|{b.strategies}|{compare}"


def _result_to_dict(res) -> dict:
    return {
        "asset": res.asset, "timeframe": res.timeframe, "days": res.days,
        "starting_capital": res.starting_capital, "risk_pct": res.risk_pct,
        "min_votes": res.min_votes,
        "trades": [asdict(t) for t in res.trades],
        "equity": [asdict(e) for e in res.equity],
        "stats": asdict(res.stats) if res.stats else None,
        "edge_quality": asdict(res.edge_quality) if res.edge_quality else None,
        "strategy_breakdown": [asdict(s) for s in res.strategy_breakdown],
        "max_consecutive_wins": res.max_consecutive_wins,
        "max_consecutive_losses": res.max_consecutive_losses,
        "avg_bars_held": res.avg_bars_held,
    }


def _bars_for(body: BacktestBody) -> list:
    # ~78 5m bars/day; cap fetch for sanity
    limit = min(2000, max(120, body.days * 78))
    return fetch_ohlcv(body.asset, body.timeframe, limit)


@router.post("/backtest")
async def backtest(body: BacktestBody, compare: bool = False):
    key = _bt_key(body, compare)
    now = time.time()
    cached = _BT_CACHE.get(key)
    if cached and now - cached[0] < _BT_TTL:
        return {**cached[1], "cached": True}

    bars = _bars_for(body)
    if compare:
        from trading.strategies import STRATEGY_FNS
        # NOTE: isolated single-strategy runs use min_votes=1
        out = {}
        for skey in STRATEGY_FNS:
            res = run_backtest(bars, body.starting_capital, body.risk_pct, 1, asset=body.asset, timeframe=body.timeframe)
            out[skey] = _result_to_dict(res)
        payload = {"compare": True, "results": out}
    else:
        res = run_backtest(bars, body.starting_capital, body.risk_pct, body.min_votes,
                           asset=body.asset, timeframe=body.timeframe)
        payload = _result_to_dict(res)

    _BT_CACHE[key] = (now, payload)
    return {**payload, "cached": False}


# ── Step 12: health ────────────────────────────────────────────────────────
@router.get("/health")
async def trading_health():
    latest = store.latest_signals(1)
    open_pos = store.open_positions()
    return {
        "status": "ok",
        "engine": "paper",
        "last_signal_at": (latest[0].get("created_at") if latest else None),
        "open_positions": len(open_pos),
        "today_signals": store.daily_signal_count(),
        "market_open": is_market_open(),
    }
