"""APEX assets, strategies, risk params, timeframes."""

from __future__ import annotations

from trading.types import Asset

# ── Tradeable universe (8) ──────────────────────────────────────────────
ASSETS: list[Asset] = [
    # crypto (CoinGecko, keyless) — always-on
    Asset("BTC/USD", "Bitcoin", "crypto", coingecko_id="bitcoin"),
    Asset("ETH/USD", "Ethereum", "crypto", coingecko_id="ethereum"),
    Asset("SOL/USD", "Solana", "crypto", coingecko_id="solana"),
    Asset("AVAX/USD", "Avalanche", "crypto", coingecko_id="avalanche-2"),
    Asset("LINK/USD", "Chainlink", "crypto", coingecko_id="chainlink"),
    Asset("DOGE/USD", "Dogecoin", "crypto", coingecko_id="dogecoin"),
    Asset("ADA/USD", "Cardano", "crypto", coingecko_id="cardano"),
    Asset("DOT/USD", "Polkadot", "crypto", coingecko_id="polkadot"),
    Asset("XRP/USD", "XRP", "crypto", coingecko_id="ripple"),
    Asset("LTC/USD", "Litecoin", "crypto", coingecko_id="litecoin"),
    # PAXG cut 2026-07: 0/6 wins live. Tokenized gold doesn't trend — momentum
    # strategies have nothing to grab. Documented in the stress-test audit.
    # stocks (Alpaca) — market hours only
    Asset("NVDA", "NVIDIA", "stock", alpaca_symbol="NVDA"),
    Asset("TSLA", "Tesla", "stock", alpaca_symbol="TSLA"),
    Asset("AAPL", "Apple", "stock", alpaca_symbol="AAPL"),
    Asset("AMD", "AMD", "stock", alpaca_symbol="AMD"),
    Asset("MSFT", "Microsoft", "stock", alpaca_symbol="MSFT"),
    Asset("AMZN", "Amazon", "stock", alpaca_symbol="AMZN"),
    Asset("META", "Meta", "stock", alpaca_symbol="META"),
    Asset("GOOGL", "Alphabet", "stock", alpaca_symbol="GOOGL"),
    # ETFs + commodities (Alpaca) — market hours only
    Asset("SPY", "S&P 500 ETF", "etf", alpaca_symbol="SPY"),
    Asset("QQQ", "Nasdaq 100 ETF", "etf", alpaca_symbol="QQQ"),
    Asset("IWM", "Russell 2000 ETF", "etf", alpaca_symbol="IWM"),
    Asset("DIA", "Dow 30 ETF", "etf", alpaca_symbol="DIA"),
    Asset("GLD", "Gold ETF", "etf", alpaca_symbol="GLD"),
    Asset("SLV", "Silver ETF", "etf", alpaca_symbol="SLV"),
    Asset("USO", "Oil ETF", "etf", alpaca_symbol="USO"),
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
    "DONCHIAN_BREAKOUT": {
        "key": "DONCHIAN_BREAKOUT",
        "name": "Donchian Breakout",
        "description": "Turtle-style break of the N-bar high/low channel.",
        "color": "#2dd4bf",
        "base_rr": 2.5,
    },
    "KELTNER_BREAKOUT": {
        "key": "KELTNER_BREAKOUT",
        "name": "Keltner Breakout",
        "description": "Break outside the EMA ± ATR Keltner channel.",
        "color": "#818cf8",
        "base_rr": 2.0,
    },
    "ZSCORE_REVERSION": {
        "key": "ZSCORE_REVERSION",
        "name": "Z-Score Reversion",
        "description": "Fade a >2σ statistical stretch from the mean.",
        "color": "#c084fc",
        "base_rr": 1.5,
    },
    "ROC_MOMENTUM": {
        "key": "ROC_MOMENTUM",
        "name": "ROC Momentum",
        "description": "Rate-of-change momentum confirmed by EMA alignment.",
        "color": "#fbbf24",
        "base_rr": 2.0,
    },
    "ADX_TREND": {
        "key": "ADX_TREND",
        "name": "ADX Trend Follow",
        "description": "Trend-follow only when ADX confirms a strong trend.",
        "color": "#4ade80",
        "base_rr": 3.0,
    },
    "REL_VOLUME_BREAKOUT": {
        "key": "REL_VOLUME_BREAKOUT",
        "name": "Relative Volume Breakout",
        "description": "Directional bar on a relative-volume spike.",
        "color": "#f87171",
        "base_rr": 2.0,
    },
    "STOCHRSI_TURN": {
        "key": "STOCHRSI_TURN",
        "name": "Stochastic RSI Turn",
        "description": "Reversal as Stochastic RSI exits extreme zones.",
        "color": "#38bdf8",
        "base_rr": 1.5,
    },
    "SUPERTREND": {
        "key": "SUPERTREND",
        "name": "Supertrend",
        "description": "ATR-trend confirmation beyond a fast EMA band.",
        "color": "#34d399",
        "base_rr": 2.5,
    },
}

# ── Risk params ─────────────────────────────────────────────────────────
RISK_PARAMS: dict[str, float] = {
    "default_risk_pct": 0.02,     # 2% of capital risked per trade
    "max_daily_drawdown": 0.05,   # stop trading if down 5% on the day
    "max_daily_trades": 20,       # raised — wider universe, more volume
    "min_confluences": 2,         # min agreeing strategies (quality gate — kept tight)
    "atr_sl_mult": 1.5,           # SL = price ∓ ATR * 1.5
    "atr_tp_mult": 3.0,           # TP = price ± ATR * 3.0
}

# ── Timeframes ──────────────────────────────────────────────────────────
TIMEFRAMES: list[str] = ["1m", "5m", "15m", "1h", "4h", "1d"]

PAPER_STARTING_CAPITAL: float = 10000.0

HIGH_CONVICTION_VOTES: int = 4    # votes >= this → is_high_conviction
TOTAL_STRATEGIES: int = len(STRATEGIES)
POSITION_EXPIRY_HOURS: int = 48

# ── APEX live config (locked from 2026-07 stress test) ─────────────────
# Out-of-regime testing (2021 bull / 2022 bear / 2022 chop, friction on) showed:
# - full 15-strategy blob, all directions, 1H: negative in EVERY regime
# - best survivor: MACD+trend-confirm subset, LONG-only, 4H bars, MA200 gate
#   (bull: positive; bear: sits out; chop: small bleed)
# Prod forward-tests this config out-of-sample. docs: stress-test audit.
APEX_CONFIG: dict = {
    "timeframe": "4h",
    "bars_needed": 260,           # 200 for MA gate + indicator warmup
    "strategies": {"MACD_MOMENTUM", "DONCHIAN_BREAKOUT", "KELTNER_BREAKOUT",
                   "ADX_TREND", "SUPERTREND", "ROC_MOMENTUM"},
    "long_only": True,
    "ma_gate_period": 200,        # only enter when close > SMA200
    "bar_minutes": 240,           # 4h — dedupe/cooldown must span a full bar,
                                  # else the same candle re-fires the same
                                  # losing setup every scan (the July bleed bug)
    "fee_pct": 0.0015,            # per side — live paper charges the same
    "slippage_pct": 0.0005,       # friction the stress test charged
}

# Forward-test epoch. Trades before this are the pre-lock/pre-fix era (ungated
# blob, re-entry bug, no friction) — kept in the DB as a research log but
# excluded from headline stats, equity, and position sizing. Never delete data;
# segment it.
APEX_EPOCH_START: str = "2026-07-07T19:45:00+00:00"  # post-fix deploy
