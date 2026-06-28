"""APEX trading types.

Plain dataclasses for engine/internal use. API serialization converts these to dicts
(asdict) or mirrors them in Pydantic models at the router layer. No `Any`-typed fields.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

Direction = Literal["LONG", "SHORT"]
SignalStatus = Literal["PENDING", "WIN", "LOSS", "EXPIRED"]
AssetKind = Literal["crypto", "stock", "etf"]


@dataclass
class OHLCV:
    ts: int                       # epoch ms
    open: float
    high: float
    low: float
    close: float
    volume: float
    bar: int                      # index of bar within the day (0-based)
    day: int                      # day ordinal (increments at session/day boundary)
    day_open: float               # first open of the current day
    orb_high: Optional[float] = None   # opening-range-breakout high (None until set)
    orb_low: Optional[float] = None


@dataclass
class Asset:
    symbol: str                   # e.g. "BTC/USD"
    name: str
    kind: AssetKind
    coingecko_id: Optional[str] = None    # crypto only
    alpaca_symbol: Optional[str] = None   # stock/etf only


@dataclass
class StrategyResult:
    """One strategy's vote on a single bar."""
    strategy: str                 # STRATEGIES key, e.g. "ORB"
    dir: Direction
    confidence: float             # 0..1
    reason: str = ""


@dataclass
class Signal:
    id: str
    ts: int
    asset: str
    timeframe: str
    dir: Direction
    price: float
    sl: float
    tp: float
    confidence: float             # avg confidence of agreeing strategies, 0..1
    confluence_score: float       # (votes/7) * avg_conf
    votes: int                    # number of strategies agreeing on dir
    is_high_conviction: bool      # votes >= 4
    strategies: list[str]         # keys of agreeing strategies
    rsi: float
    vwap: float
    atr: float
    status: SignalStatus = "PENDING"
    exit_price: Optional[float] = None
    pnl_pct: Optional[float] = None
    exit_reason: Optional[str] = None   # "TP" | "SL" | "EXPIRED"
    bars_held: Optional[int] = None


@dataclass
class PaperPosition:
    id: str
    signal_id: str
    asset: str
    dir: Direction
    entry_price: float
    sl: float
    tp: float
    size: float                   # position size in quote currency
    risk_pct: float
    opened_ts: int
    status: Literal["OPEN", "CLOSED"] = "OPEN"
    exit_price: Optional[float] = None
    exit_ts: Optional[int] = None
    pnl: Optional[float] = None        # realized P&L in quote currency
    pnl_pct: Optional[float] = None
    exit_reason: Optional[str] = None


@dataclass
class Trade:
    """A completed (closed) paper trade — unit of P&L for all stats."""
    id: str
    asset: str
    dir: Direction
    strategies: list[str]
    votes: int
    entry_price: float
    exit_price: float
    pnl: float                    # quote currency
    pnl_pct: float
    bars_held: int
    opened_ts: int
    closed_ts: int
    exit_reason: str


@dataclass
class EquityPoint:
    ts: int
    equity: float
    drawdown: float = 0.0


@dataclass
class EdgeQuality:
    """Exposes whether profit is distributed or one-trade-luck. CRITICAL."""
    profit_concentration: float   # % of total positive P&L from the single best trade
    return_ex_max_win: float      # total return (%) with the best trade removed
    consistency_score: float      # 0..100
    longest_flat_period: int      # max consecutive trades with no new equity high
    distributed_edge: bool        # True if no single trade > 30% of total P&L


@dataclass
class PortfolioStats:
    starting_capital: float
    current_capital: float
    total_return_pct: float
    win_rate: float
    total_trades: int
    wins: int
    losses: int
    max_drawdown: float
    expectancy: float             # avg P&L per trade (quote currency)
    profit_factor: float
    sharpe: float
    calmar: float


@dataclass
class StrategyStats:
    strategy: str
    signals: int
    wins: int
    losses: int
    win_rate: float
    avg_pnl_pct: float
    avg_rr: float
    max_consecutive_losses: int
    best_asset: Optional[str] = None


@dataclass
class BacktestResult:
    asset: str
    timeframe: str
    days: int
    starting_capital: float
    risk_pct: float
    min_votes: int
    trades: list[Trade] = field(default_factory=list)
    equity: list[EquityPoint] = field(default_factory=list)
    stats: Optional[PortfolioStats] = None
    edge_quality: Optional[EdgeQuality] = None
    strategy_breakdown: list[StrategyStats] = field(default_factory=list)
    max_consecutive_wins: int = 0
    max_consecutive_losses: int = 0
    avg_bars_held: float = 0.0
