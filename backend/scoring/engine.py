"""
Sentinel AI — Scoring Engine v3
Real methodology for smart money wallets.
Exchange wallets hard-capped at 30.
Smart money scored on behavior, not balance size.
"""

from datetime import datetime, timezone
from typing import Optional


# Known exchange hot wallet addresses (lowercase) — address-based detection
_EXCHANGE_ADDRESSES = {
    "0x28c6c06298d514db089934071355e5743bf21d60",  # Binance 14
    "0x21a31ee1afc51d94c2efccaa1486ffa9c4a2a28",   # Binance 16
    "0x56eddb7aa87536c09ccc2793473599fd21a8b17f",   # Binance 17
    "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",   # Binance 1
    "0xd551234ae421e3bcba99a0da6d736074f22192ff",   # Binance 2
    "0x0681d8db095565fe8a346fa0277bffde9c0edbbf",   # Binance 4
    "0x001866ae5b3de6caa5a51543fd9fb64f524f5478",   # Coinbase 2
    "0x503828976d22510aad0201ac7ec88293211d23da",   # Coinbase 3
    "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",   # Coinbase 4
    "0x3cd751e6b0078be393132286c442345e5dc49699",   # Coinbase 5
    "0xa7efae728d2936e78bda97dc267687568dd593f3",   # Kraken 1
    "0xe853c56864a2ebe4576a807d26fdc4a0ada51919",   # Kraken 2
    "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0",   # Kraken 3
    "0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8",   # Gemini 2
    "0xd24400ae8bfebb18ca49be86258a3c749cf46853",   # Gemini 3
    "0x2b5634c42055806a59e9107ed44d43c426e58258",   # KuCoin
    "0x689c56aef474df92d44a1b70850f808488f9769c",   # KuCoin 2
    "0x1692e170361cefd1eb7240ec13d048fd9af6d667",   # OKX 1
    "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b",   # OKX 2
    "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3",   # Bitfinex
    "0x1151314c646ce4e0efd76d1af4760ae66a9fe30f",   # Bitfinex 2
}


def _is_exchange(address: Optional[str], label: Optional[str]) -> bool:
    """Returns True if wallet is a known exchange or custodian."""
    if address and address.lower() in _EXCHANGE_ADDRESSES:
        return True
    try:
        from data.wallets import is_exchange as label_check
        return label_check(label or "")
    except ImportError:
        # Fallback label check if data module not available
        keywords = {
            "binance", "coinbase", "kraken", "kucoin", "okx", "gemini",
            "bitfinex", "gate.io", "bybit", "huobi", "bitmex", "bitstamp",
            "crypto.com", "ftx", "upbit", "bithumb", "coinone",
            "exchange", "hot wallet", "mev bot",
        }
        label_lower = (label or "").lower()
        return any(kw in label_lower for kw in keywords)


def score_wallet(
    transactions: list,
    balance: float,
    chain: str,
    address: str = None,
    label: str = None,
) -> dict:

    is_exchange = _is_exchange(address, label)
    if is_exchange:
        return _exchange_result(label)

    if not transactions:
        return _empty_result()

    tx_count = len(transactions)

    # ── ACTIVITY SCORE (0-35pts) ─────────────────────
    # Rewards consistent activity. 10+ txs = full score.
    if tx_count >= 10:
        activity_score = 35
    elif tx_count >= 5:
        activity_score = round(20 + (tx_count - 5) * 3)
    elif tx_count >= 1:
        activity_score = round(5 + (tx_count - 1) * 3.75)
    else:
        activity_score = 0

    # ── SUCCESS RATE (0-30pts) ───────────────────────
    successful = sum(
        1 for t in transactions
        if t.get("status") in ("success", "Success", "1", "finalized", "confirmed")
        or t.get("is_error") is False
        or t.get("isError") == "0"
    )
    # If no status data available, assume success
    if successful == 0 and all(t.get("status") is None for t in transactions):
        successful = tx_count

    success_rate = successful / tx_count if tx_count else 0
    success_score = round(success_rate * 30)

    # ── BALANCE SCORE (0-25pts) ──────────────────────
    # Smart money sweet spot: 10-5000 ETH
    if balance >= 50000:
        balance_score = 5   # Too large — likely exchange
    elif balance >= 5000:
        balance_score = 20
    elif balance >= 1000:
        balance_score = 25  # Sweet spot
    elif balance >= 100:
        balance_score = round(15 + (balance / 1000) * 10)
    elif balance >= 10:
        balance_score = round(8 + (balance / 100) * 7)
    elif balance >= 1:
        balance_score = round(3 + (balance / 10) * 5)
    elif balance >= 0.1:
        balance_score = 2
    else:
        balance_score = 0

    # ── RECENCY BONUS (0-10pts) ──────────────────────
    recency_score = 0
    latest = _get_latest_timestamp(transactions)
    if latest:
        days = (datetime.now(timezone.utc) - latest).days
        if days == 0:
            recency_score = 10
        elif days <= 1:
            recency_score = 9
        elif days <= 3:
            recency_score = 7
        elif days <= 7:
            recency_score = 5
        elif days <= 14:
            recency_score = 3
        elif days <= 30:
            recency_score = 1

    total = min(
        activity_score + success_score + balance_score + recency_score,
        100,
    )
    grade = _grade(total)

    return {
        "score": total,
        "grade": grade,
        "breakdown": {
            "activity": activity_score,
            "success_rate": success_score,
            "balance": balance_score,
            "recency": recency_score,
        },
        "methodology": "v3",
        "win_rate": round(success_rate * 100, 1),
        "last_active_days_ago": (
            (datetime.now(timezone.utc) - latest).days if latest else None
        ),
        "summary": _summary(total, tx_count, success_rate, balance),
        "is_exchange": False,
    }


def _exchange_result(label: str) -> dict:
    return {
        "score": 25,
        "grade": "F",
        "breakdown": {
            "activity": 10,
            "success_rate": 10,
            "balance": 0,
            "recency": 5,
        },
        "methodology": "v3_exchange",
        "win_rate": 0,
        "summary": "Exchange/CEX hot wallet. Operational volume only, no trading signal.",
        "is_exchange": True,
    }


def _empty_result() -> dict:
    return {
        "score": 0,
        "grade": "F",
        "breakdown": {
            "activity": 0,
            "success_rate": 0,
            "balance": 0,
            "recency": 0,
        },
        "methodology": "v3_no_data",
        "win_rate": 0,
        "summary": "No transaction data available yet.",
        "is_exchange": False,
    }


def _get_latest_timestamp(transactions: list) -> Optional[datetime]:
    for tx in transactions:
        ts_str = tx.get("timestamp")
        ts_unix = tx.get("timestamp_unix")
        try:
            if ts_str:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                return dt.replace(tzinfo=timezone.utc) if not dt.tzinfo else dt
            elif ts_unix and int(ts_unix) > 0:
                return datetime.fromtimestamp(int(ts_unix), tz=timezone.utc)
        except Exception:
            continue
    return None


def _grade(score: int) -> str:
    if score >= 90: return "S"
    if score >= 80: return "A"
    if score >= 65: return "B"
    if score >= 50: return "C"
    if score >= 35: return "D"
    return "F"


def _summary(score: int, tx_count: int, win_rate: float, balance: float) -> str:
    win_pct = round(win_rate * 100)
    eth = f"{balance:,.2f} ETH"
    if score >= 80:
        return (
            f"High conviction wallet. {tx_count} recent transactions, "
            f"{win_pct}% success rate, {eth} balance."
        )
    if score >= 60:
        return f"Active smart money. {tx_count} transactions tracked, {win_pct}% success."
    if score >= 40:
        return f"Moderate activity. {tx_count} transactions, {eth} balance."
    return f"Low activity or insufficient data. {tx_count} transactions recorded."
