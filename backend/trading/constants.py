"""APEX assets, strategies, risk params, timeframes."""

from __future__ import annotations

from trading.types import Asset

# ── Tradeable universe (8) ──────────────────────────────────────────────
ASSETS: list[Asset] = [
    Asset("BTC/USD", "Bitcoin", "crypto", coingecko_id="bitcoin"),
    Asset("ETH/USD", "Ethereum", "crypto", coingecko_id="ethereum"),
    Asset("SOL/USD", "Solana", "crypto", coingecko_id="solana"),
    Asset("NVDA", "NVIDIA", "stock", alpaca_symbol="NVDA"),
    Asset("TSLA", "Tesla", "stock", alpaca_symbol="TSLA"),
    Asset("AAPL", "Apple", "stock", alpaca_symbol="AAPL"),
    Asset("SPY", "S&P 500 ETF", "etf", alpaca_symbol="SPY"),
    Asset("QQQ", "Nasdaq 100 ETF", "etf", alpaca_symbol="QQQ"),
]

ASSETS_BY_SYMBOL: dict[str, Asset] = {a.symbol: a for a in ASSETS}

# ── Strategies (7) ──────────────────────────────────────────────────────
# base_rr = baseline reward:risk the strategy targets (TP distance / SL distance).
STRATEGIES: dict[str, dict] = {
    "ORB": {
        "key": "ORB",
        "name": "Opening Range Breakout",
        "description": "Break of the opening range high/low on expanding volume.",
        "color": "#22d3ee",
        "base_rr": 2.0,
    },
    "VWAP_REVERSION": {
        "key": "VWAP_REVERSION",
        "name": "VWAP Reversion",
        "description": "Fade extension away from VWAP back toward the mean.",
        "color": "#a78bfa",
        "base_rr": 1.5,
    },
    "EMA_CROSS": {
        "key": "EMA_CROSS",
        "name": "EMA Cross",
        "description": "EMA9 crossing EMA21 in the direction of trend.",
        "color": "#34d399",
        "base_rr": 2.0,
    },
    "MACD_MOMENTUM": {
        "key": "MACD_MOMENTUM",
        "name": "MACD Momentum",
        "description": "MACD line crossing the signal line with rising histogram.",
        "color": "#f59e0b",
        "base_rr": 2.0,
    },
    "BB_SQUEEZE": {
        "key": "BB_SQUEEZE",
        "name": "Bollinger Squeeze",
        "description": "Breakout from a low-volatility Bollinger Band squeeze.",
        "color": "#f472b6",
        "base_rr": 2.5,
    },
    "RSI_DIVERGENCE": {
        "key": "RSI_DIVERGENCE",
        "name": "RSI Divergence",
        "description": "Price/RSI divergence signaling exhaustion and reversal.",
        "color": "#60a5fa",
        "base_rr": 2.0,
    },
    "GAP_GO": {
        "key": "GAP_GO",
        "name": "Gap & Go",
        "description": "Continuation after an opening gap holds above/below the open.",
        "color": "#fb7185",
        "base_rr": 2.0,
    },
}

# ── Risk params ─────────────────────────────────────────────────────────
RISK_PARAMS: dict[str, float] = {
    "default_risk_pct": 0.02,     # 2% of capital risked per trade
    "max_daily_drawdown": 0.05,   # stop trading if down 5% on the day
    "max_daily_trades": 3,
    "min_confluences": 2,         # min agreeing strategies to fire a signal
    "atr_sl_mult": 1.5,           # SL = price ∓ ATR * 1.5
    "atr_tp_mult": 3.0,           # TP = price ± ATR * 3.0
}

# ── Timeframes ──────────────────────────────────────────────────────────
TIMEFRAMES: list[str] = ["1m", "5m", "15m", "1h", "4h", "1d"]

PAPER_STARTING_CAPITAL: float = 10000.0

HIGH_CONVICTION_VOTES: int = 4    # votes >= this → is_high_conviction
TOTAL_STRATEGIES: int = len(STRATEGIES)
POSITION_EXPIRY_HOURS: int = 48
