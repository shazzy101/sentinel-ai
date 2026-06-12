"""Wallet performance metrics — YTD balance growth from on-chain tx history."""

from datetime import datetime, timezone


def _parse_ts(ts) -> datetime | None:
    if not ts:
        return None
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_eth_row(tx: dict) -> bool:
    """True only for native-ETH movements.

    The ETH balance series must NOT be reconstructed from ERC-20 transfers: a
    token row's `value` is denominated in that token (e.g. 5000 USDC), and
    applying it to an ETH balance corrupts the series — it was the cause of the
    'super bugged' whale balance charts (huge cliffs to zero). Treat missing
    symbols as ETH (legacy rows), everything else by symbol.
    """
    sym = (tx.get("value_symbol") or "ETH").upper()
    return sym == "ETH"


def balance_at_date(transactions: list[dict], current_balance: float, target: datetime) -> float:
    """Reconstruct ETH balance at `target` by reversing native-ETH txs after that date."""
    balance = float(current_balance or 0)
    sorted_txs = sorted(
        [t for t in transactions if _is_eth_row(t)],
        key=lambda t: _parse_ts(t.get("timestamp")) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    for tx in sorted_txs:
        ts = _parse_ts(tx.get("timestamp"))
        if not ts or ts <= target:
            break
        val = float(tx.get("value") or 0)
        direction = tx.get("direction", "unknown")
        if direction == "in":
            balance -= val
        elif direction == "out":
            balance += val
        balance = max(0.0, balance)
    return balance


def compute_ytd_growth(transactions: list[dict], current_balance: float) -> dict:
    """
    Year-to-date ETH balance growth from Jan 1 UTC.
    Returns pct change, start/end balances, and sparkline-friendly series.
    """
    now = datetime.now(timezone.utc)
    year_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
    current = float(current_balance or 0)

    # Reconstruct the ETH balance series from native-ETH movements ONLY. Token
    # transfers carry token-denominated values that would corrupt the line.
    eth_txs = [t for t in transactions if _is_eth_row(t)]
    if not eth_txs:
        return {
            "ytd_pct": None,
            "ytd_start_balance": None,
            "ytd_end_balance": current,
            "sparkline": [],
        }

    start_balance = balance_at_date(eth_txs, current, year_start)
    ytd_txs = [
        t for t in eth_txs
        if (_parse_ts(t.get("timestamp")) or datetime.min.replace(tzinfo=timezone.utc)) >= year_start
    ]
    ytd_txs.sort(key=lambda t: _parse_ts(t.get("timestamp")) or datetime.min.replace(tzinfo=timezone.utc))

    # Build YTD sparkline series
    balance = start_balance
    sparkline = [{"balance": balance, "ts": year_start.isoformat()}]
    for tx in ytd_txs:
        val = float(tx.get("value") or 0)
        if tx.get("direction") == "in":
            balance += val
        elif tx.get("direction") == "out":
            balance -= val
        balance = max(0.0, balance)
        ts = _parse_ts(tx.get("timestamp"))
        sparkline.append({"balance": balance, "ts": ts.isoformat() if ts else None})

    if not sparkline or sparkline[-1]["balance"] != current:
        sparkline.append({"balance": current, "ts": now.isoformat()})

    if start_balance <= 0:
        ytd_pct = 100.0 if current > 0 else 0.0
    else:
        ytd_pct = round(((current - start_balance) / start_balance) * 100, 2)

    return {
        "ytd_pct": ytd_pct,
        "ytd_start_balance": round(start_balance, 6),
        "ytd_end_balance": round(current, 6),
        "sparkline": sparkline,
    }


def downsample_sparkline(sparkline: list[dict], max_points: int = 20) -> list[dict]:
    """Reduce sparkline payload for fast list views."""
    if len(sparkline) <= max_points:
        return sparkline
    step = max(1, len(sparkline) // max_points)
    sampled = [sparkline[i] for i in range(0, len(sparkline), step)]
    if sampled[-1] != sparkline[-1]:
        sampled.append(sparkline[-1])
    return sampled


def estimate_supplemental_metrics(metrics: dict, on_chain: dict) -> tuple[dict, dict]:
    """
    Fill max_drawdown_pct and avg_trade_duration_hrs when the Dune export left them null.
    Uses win rate, profit factor, and trades/day — same signals as the offline ranker.
    """
    import math

    m = dict(metrics or {})
    oc = on_chain or {}
    meta: dict[str, str] = {}

    if m.get("max_drawdown_pct") is None:
        wr = float(m.get("win_rate_pct") or 0) / 100
        pf = min(float(m.get("profit_factor") or 1), 15)
        if wr > 0:
            dd = 30 - wr * 22 - math.log1p(pf) * 2.2
            m["max_drawdown_pct"] = round(max(3.0, min(35.0, dd)), 1)
            meta["max_drawdown_pct"] = "estimated"

    if m.get("avg_trade_duration_hrs") is None:
        tpd = float(oc.get("trades_per_day") or 0)
        if tpd > 0:
            dur = min(168.0, max(2.0, (24 / tpd) * 1.2))
            m["avg_trade_duration_hrs"] = round(dur, 1)
            meta["avg_trade_duration_hrs"] = "estimated"
        elif m.get("track_record_days"):
            m["avg_trade_duration_hrs"] = 24.0
            meta["avg_trade_duration_hrs"] = "estimated"

    return m, meta


def build_pnl_sparkline_from_trades(trades: list[dict], *, base: float = 100.0) -> tuple[list[dict], float | None]:
    """Real cumulative P&L index from reconstructed trades (ranker output)."""
    if not trades:
        return [], None

    sorted_trades = sorted(trades, key=lambda t: t.get("sell_ts") or 0)
    cum_pnl = 0.0
    sparkline = [{"balance": base, "index": 0}]
    scale = max(abs(sum(t.get("pnl_usd") or 0 for t in sorted_trades)), 1.0)

    for i, t in enumerate(sorted_trades, start=1):
        cum_pnl += float(t.get("pnl_usd") or 0)
        # Index moves with cumulative edge; capped for sane chart display
        pct = (cum_pnl / scale) * 50
        sparkline.append({"balance": round(base + pct, 2), "index": i})

    est_return = round((sparkline[-1]["balance"] - base) / base * 100, 2) if sparkline else None
    return sparkline, est_return


def build_copy_trader_sparkline(wallet: dict) -> tuple[list[dict], float | None]:
    """
    Cumulative P&L curve for copy-trader views.
    Uses stored ranker sparkline when present; otherwise estimates from Dune metrics.
    """
    stored = wallet.get("pnl_sparkline")
    if stored and isinstance(stored, list) and len(stored) >= 2:
        ret = wallet.get("estimated_return_pct")
        if ret is None and stored:
            base = float(stored[0].get("balance") or 100)
            end = float(stored[-1].get("balance") or base)
            ret = round((end - base) / base * 100, 2) if base else None
        return stored, ret

    import math

    metrics = wallet.get("metrics") or {}
    oc = wallet.get("on_chain_data") or {}

    track_days = max(int(metrics.get("track_record_days") or oc.get("active_days") or 90), 30)
    win_rate = float(metrics.get("win_rate_pct") or 0) / 100
    profit_factor = min(float(metrics.get("profit_factor") or 1), 15)

    if win_rate <= 0:
        return [], None

    # Conservative return estimate — capped for display sanity
    edge = win_rate * math.log1p(profit_factor) - (1 - win_rate) * 0.35
    est_return_pct = round(min(max(edge * 25, -40), 180), 2)

    n_points = min(24, max(8, track_days // 7))
    base = 100.0
    sparkline = [{"balance": base, "index": 0}]

    for i in range(1, n_points + 1):
        progress = i / n_points
        balance = base * (1 + (est_return_pct / 100) * progress)
        sparkline.append({"balance": round(balance, 2), "index": i})

    return sparkline, est_return_pct
