from __future__ import annotations
from pydantic import BaseModel


class Signal(BaseModel):
    kind: str                       # smart_money_buy | take_profit | win_ledger
    token: str
    action: str = ""                # buy | take_profit | sell | ""
    ts: str                         # ISO timestamp
    trader_label: str | None = None
    rank: int | None = None
    amount_usd: float | None = None
    unrealized_win_rate_pct: float | None = None
    tx_hash: str | None = None
    raw: dict = {}                  # original source dict / ready tweet_hook


class RankedSignal(BaseModel):
    signal: Signal
    tweetability: float
    reasons: list[str] = []


class ContentPiece(BaseModel):
    original_post: str
    reply_variants: list[str]
    cta: str
    signal_token: str


class DailyBrief(BaseModel):
    date: str
    pieces: list[ContentPiece]
    engagement: list[dict]
    metrics_delta: dict
    headline: str | None = None
