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


def balance_at_date(transactions: list[dict], current_balance: float, target: datetime) -> float:
    """Reconstruct ETH balance at `target` by reversing txs after that date."""
    balance = float(current_balance or 0)
    sorted_txs = sorted(
        transactions,
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

    if not transactions:
        return {
            "ytd_pct": None,
            "ytd_start_balance": None,
            "ytd_end_balance": current,
            "sparkline": [],
        }

    start_balance = balance_at_date(transactions, current, year_start)
    ytd_txs = [
        t for t in transactions
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
