"""APEX out-of-regime stress test.

Replays the exact live engine through historical crypto regimes via Alpaca's
crypto data API (v1beta3, free with paper keys):

  BULL_2021  2021-02-01 → 2021-04-15   BTC ~33k → ~63k   (regime like today's)
  BEAR_2022  2022-04-15 → 2022-06-30   LUNA collapse, BTC 40k → 19k
  CHOP_2022  2022-08-01 → 2022-10-15   sideways grind ~19-24k

Configs:
  FULL    — all 15 strategies, longs+shorts (what runs in prod)
  THESIS  — MACD + trend-confirm subset, LONG-ONLY (the hypothesized "real edge")

Friction: 0.15% fee + 0.05% slippage per side, charged on notional.
Purpose: decide whether the observed live edge is momentum alpha or long-crypto beta.

Run:  cd backend && ../venv/bin/python scripts/stress_test.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from trading.api_clients import _rows_to_ohlcv  # noqa: E402
from trading.engine import run_backtest  # noqa: E402

CRYPTO_URL = "https://data.alpaca.markets/v1beta3/crypto/us/bars"

WINDOWS = {
    "BULL_2021": ("2021-02-01", "2021-04-15"),
    "BEAR_2022": ("2022-04-15", "2022-06-30"),
    "CHOP_2022": ("2022-08-01", "2022-10-15"),
}
SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"]
TIMEFRAME = "1H"

THESIS_SET = {"MACD_MOMENTUM", "DONCHIAN_BREAKOUT", "KELTNER_BREAKOUT",
              "ADX_TREND", "SUPERTREND", "ROC_MOMENTUM"}
FEE, SLIP = 0.0015, 0.0005  # 0.15% + 0.05% per side

CONFIGS = {
    "FULL":   dict(allowed_strategies=None, long_only=False),
    "THESIS": dict(allowed_strategies=THESIS_SET, long_only=True),
}


def fetch_bars(symbol: str, start: str, end: str) -> list:
    key, sec = os.getenv("ALPACA_API_KEY"), os.getenv("ALPACA_API_SECRET")
    rows, page = [], None
    while True:
        params = {"symbols": symbol, "timeframe": TIMEFRAME, "start": start,
                  "end": end, "limit": 10000, "sort": "asc"}
        if page:
            params["page_token"] = page
        r = httpx.get(CRYPTO_URL, params=params, timeout=20,
                      headers={"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": sec})
        r.raise_for_status()
        data = r.json()
        for b in data.get("bars", {}).get(symbol, []):
            from datetime import datetime
            ts = int(datetime.fromisoformat(b["t"].replace("Z", "+00:00")).timestamp() * 1000)
            rows.append((ts, b["o"], b["h"], b["l"], b["c"], b.get("v", 0)))
        page = data.get("next_page_token")
        if not page:
            break
    return _rows_to_ohlcv(rows)


def main() -> None:
    out = {}
    for wname, (start, end) in WINDOWS.items():
        for sym in SYMBOLS:
            t0 = time.time()
            try:
                bars = fetch_bars(sym, start, end)
            except Exception as exc:
                print(f"{wname} {sym}: FETCH FAIL {exc}", flush=True)
                continue
            if len(bars) < 100:
                print(f"{wname} {sym}: only {len(bars)} bars — skipped", flush=True)
                continue
            move = (bars[-1].close - bars[0].close) / bars[0].close * 100
            for cname, cfg in CONFIGS.items():
                res = run_backtest(
                    bars, 10000, 0.02, 2, asset=sym, timeframe=TIMEFRAME,
                    fee_pct=FEE, slippage_pct=SLIP, **cfg,
                )
                s, e = res.stats, res.edge_quality
                key = f"{wname}|{sym}|{cname}"
                out[key] = {
                    "window": wname, "asset": sym, "config": cname,
                    "bars": len(bars), "buy_hold_pct": round(move, 1),
                    "trades": s.total_trades, "win_rate": round(s.win_rate, 1),
                    "return_pct": round(s.total_return_pct, 2),
                    "max_dd": round(s.max_drawdown, 1),
                    "profit_factor": round(s.profit_factor, 2) if s.profit_factor != float("inf") else 99.0,
                    "distributed": e.distributed_edge,
                    "days": res.days,
                }
                print(f"{wname:9} {sym:8} {cname:6} bh={move:+6.1f}% "
                      f"trades={s.total_trades:3} win={s.win_rate:4.1f}% "
                      f"ret={s.total_return_pct:+7.2f}% dd={s.max_drawdown:5.1f}% "
                      f"({time.time()-t0:.0f}s)", flush=True)
    with open("/tmp/stress_results.json", "w") as f:
        json.dump(out, f, indent=1)
    print("\nDONE -> /tmp/stress_results.json", flush=True)


if __name__ == "__main__":
    main()
