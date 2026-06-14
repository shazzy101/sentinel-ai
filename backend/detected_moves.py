"""
Detected copy-trader moves — ingest, 24h outcome scoring, trust stats.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from copy_trader_moves import fetch_recent_copy_moves
from db.supabase import supabase_client
from observability import log_error, log_info, log_warning

NOTIONAL_USD = 1000.0
WIN_THRESHOLD_PCT = 3.0
LOSS_THRESHOLD_PCT = -3.0
SCORE_AFTER_HOURS = 24

TOKEN_COINGECKO: dict[str, str] = {
    "ETH": "ethereum",
    "WETH": "ethereum",
    "STETH": "staked-ether",
    "WSTETH": "wrapped-steth",
    "WBTC": "wrapped-bitcoin",
    "USDC": "usd-coin",
    "USDT": "tether",
    "DAI": "dai",
    "LINK": "chainlink",
    "UNI": "uniswap",
    "AAVE": "aave",
    "ARB": "arbitrum",
    "OP": "optimism",
    "PEPE": "pepe",
    "SHIB": "shiba-inu",
    "LDO": "lido-dao",
    "MKR": "maker",
    "CRV": "curve-dao-token",
    "SNX": "havven",
    "COMP": "compound-governance-token",
    "ENS": "ethereum-name-service",
    "RNDR": "render-token",
    "FET": "fetch-ai",
    "INJ": "injective-protocol",
    "GMX": "gmx",
    "PENDLE": "pendle",
    "ONDO": "ondo-finance",
    "WLD": "worldcoin-wld",
    "DOGE": "dogecoin",
    "MATIC": "matic-network",
    "POL": "polygon-ecosystem-token",
}


def _parse_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None


async def _fetch_prices(coin_ids: list[str]) -> dict[str, float]:
    if not coin_ids:
        return {}
    unique = list(dict.fromkeys(coin_ids))
    url = (
        "https://api.coingecko.com/api/v3/simple/price"
        f"?ids={','.join(unique)}&vs_currencies=usd"
    )
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(url)
            res.raise_for_status()
            data = res.json()
        return {cid: float(data[cid]["usd"]) for cid in unique if cid in data and data[cid].get("usd")}
    except Exception as e:
        log_error("coingecko_price_fetch_failed", error=str(e)[:200])
        return {}


# Base/quote assets — never the "bet". The alt on the other side is what we score.
_BASE_TOKENS = frozenset({
    "USDC", "USDT", "DAI", "BUSD", "FRAX", "TUSD", "USDP", "LUSD", "GHO", "PYUSD", "FDUSD",
    "WETH", "ETH",
})


def _tracked(move: dict) -> tuple[str | None, str | None]:
    """The alt token a trade bet on (symbol, contract_address).

    If the trader bought an alt → track that (betting up). If they sold an alt
    into a base → track the alt (its move after exit, sign-adjusted at scoring).
    Base↔base swaps (e.g. WETH↔USDC) aren't a directional bet → skip.
    """
    bought = (move.get("bought") or "").upper()
    sold = (move.get("sold") or "").upper()
    if bought and bought not in _BASE_TOKENS:
        return bought, move.get("bought_address")
    if sold and sold not in _BASE_TOKENS:
        return sold, move.get("sold_address")
    return None, None


async def _fetch_prices_defillama(addresses: list[str]) -> dict[str, float]:
    """USD prices via DefiLlama coins API (DEX-pool based — covers most tokens
    with liquidity, including brand-new micro-caps CoinGecko doesn't list)."""
    addrs = list(dict.fromkeys([a.lower() for a in addresses if a]))
    if not addrs:
        return {}
    out: dict[str, float] = {}
    for i in range(0, len(addrs), 80):
        chunk = addrs[i : i + 80]
        keys = ",".join(f"ethereum:{a}" for a in chunk)
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(f"https://coins.llama.fi/prices/current/{keys}")
                res.raise_for_status()
                coins = (res.json() or {}).get("coins", {})
            for a in chunk:
                entry = coins.get(f"ethereum:{a}")
                if entry and entry.get("price"):
                    out[a] = float(entry["price"])
        except Exception as e:
            log_error("defillama_price_failed", error=str(e)[:160])
    return out


async def _fetch_prices_coingecko_contract(addresses: list[str]) -> dict[str, float]:
    addrs = list(dict.fromkeys([a.lower() for a in addresses if a]))
    if not addrs:
        return {}
    out: dict[str, float] = {}
    for i in range(0, len(addrs), 100):
        chunk = addrs[i : i + 100]
        url = (
            "https://api.coingecko.com/api/v3/simple/token_price/ethereum"
            f"?contract_addresses={','.join(chunk)}&vs_currencies=usd"
        )
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(url)
                res.raise_for_status()
                data = res.json()
            for a in chunk:
                if a in data and data[a].get("usd"):
                    out[a] = float(data[a]["usd"])
        except Exception as e:
            log_error("coingecko_token_price_failed", error=str(e)[:160])
    return out


async def _fetch_prices_by_contract(addresses: list[str]) -> dict[str, float]:
    """Price arbitrary ERC-20s. DefiLlama first (broad DEX coverage), then
    CoinGecko for any addresses DefiLlama couldn't price."""
    addrs = list(dict.fromkeys([a.lower() for a in addresses if a]))
    if not addrs:
        return {}
    prices = await _fetch_prices_defillama(addrs)
    missing = [a for a in addrs if a not in prices]
    if missing:
        prices.update(await _fetch_prices_coingecko_contract(missing))
    return prices


def _price_of(symbol: str | None, address: str | None,
              id_prices: dict[str, float], addr_prices: dict[str, float]) -> float | None:
    """Resolve a token's USD price — major-symbol id first, else contract address."""
    cid = TOKEN_COINGECKO.get((symbol or "").upper())
    if cid and id_prices.get(cid):
        return id_prices[cid]
    if address and addr_prices.get(address.lower()):
        return addr_prices[address.lower()]
    return None


def _classify_outcome(return_pct: float) -> str:
    if return_pct >= WIN_THRESHOLD_PCT:
        return "WIN"
    if return_pct <= LOSS_THRESHOLD_PCT:
        return "LOSS"
    return "NEUTRAL"


def _return_pct(sign: int, price_at: float, price_after: float) -> float:
    """Signed return: +1 = bought the alt (win if up), -1 = sold/exited (win if down)."""
    if not price_at or price_at <= 0:
        return 0.0
    raw = ((price_after - price_at) / price_at) * 100
    return raw * (sign if sign else 1)


def _track_sign(row: dict) -> int:
    """+1 if the tracked token was bought, -1 if it was sold (exited)."""
    tracked = (row.get("token_tracked") or "").upper()
    return 1 if tracked and tracked == (row.get("token_bought") or "").upper() else -1


def _trader_display_label(move: dict) -> str | None:
    label = (move.get("trader_label") or "").strip()
    rank = move.get("rank") or move.get("trader_rank")
    if label and not label.startswith("Dune DEX Trader"):
        return label
    if rank:
        return f"Ranked DEX Trader #{rank}"
    return "Ranked DEX Trader"


def _move_row(move: dict, *, price_at: float | None = None) -> dict:
    detected = _parse_ts(move.get("time")) or datetime.now(timezone.utc)
    token_tracked, tracked_address = _tracked(move)
    return {
        "token_tracked_address": tracked_address,
        "detected_at": detected.isoformat(),
        "tx_hash": move["tx_hash"],
        "trader_address": (move.get("trader_address") or "").lower(),
        "trader_label": _trader_display_label(move),
        "trader_rank": move.get("rank"),
        "copy_score": move.get("copy_score"),
        "win_rate_pct": move.get("win_rate_pct"),
        "profit_factor": move.get("profit_factor"),
        "action": move.get("action") or "rotate",
        "token_bought": move.get("bought"),
        "token_sold": move.get("sold"),
        "sold_amount": move.get("sold_amount"),
        "bought_amount": move.get("bought_amount"),
        "amount_usd": move.get("amount_usd"),
        "token_tracked": token_tracked,
        "price_at_detection": price_at,
        "outcome_status": "PENDING",
        "notional_usd": NOTIONAL_USD,
        "source": "copy_trader_scan",
    }


async def ingest_detected_moves(
    enriched_pool: list[dict],
    *,
    limit: int = 80,
    eth_usd: float = 3500.0,
) -> dict:
    moves = await fetch_recent_copy_moves(
        enriched_pool,
        limit=limit,
        traders_to_scan=100,
        transfer_limit=40,
        eth_usd=eth_usd,
    )

    # Price the tracked alt either by major-symbol id or by contract address,
    # so small-caps (the actual bets) get a detection price and can be scored.
    symbol_ids: list[str] = []
    contract_addrs: list[str] = []
    for m in moves:
        sym, addr = _tracked(m)
        cid = TOKEN_COINGECKO.get((sym or "").upper())
        if cid:
            symbol_ids.append(cid)
        elif addr:
            contract_addrs.append(addr)
    id_prices = await _fetch_prices(symbol_ids)
    addr_prices = await _fetch_prices_by_contract(contract_addrs)

    inserted = 0
    skipped = 0
    for move in moves:
        if not move.get("tx_hash"):
            continue
        sym, addr = _tracked(move)
        price_at = _price_of(sym, addr, id_prices, addr_prices)
        # Skip moves we can't price at detection — they can never score to a real
        # WIN/LOSS and just flood the ledger with NEUTRAL noise.
        if not price_at:
            skipped += 1
            continue
        row = _move_row(move, price_at=price_at)
        try:
            supabase_client.table("detected_moves").upsert(
                row,
                on_conflict="tx_hash",
                ignore_duplicates=True,
            ).execute()
            inserted += 1
        except Exception:
            skipped += 1

    log_info("detected_moves_ingest", scanned=len(moves), inserted=inserted, skipped=skipped)
    return {"scanned": len(moves), "inserted": inserted, "skipped": skipped}


async def score_pending_moves(*, batch_size: int = 50) -> dict:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=SCORE_AFTER_HOURS)).isoformat()

    # Sweep legacy/unscoreable stragglers: PENDING moves older than 24h that have
    # no token_tracked (or no detection price) can NEVER be scored, so they stay
    # PENDING forever and inflate the "watching" count. Retire them to NEUTRAL.
    try:
        stuck = (
            supabase_client.table("detected_moves")
            .select("id")
            .eq("outcome_status", "PENDING")
            .lte("detected_at", cutoff)
            .is_("token_tracked", "null")
            .limit(500)
            .execute()
        )
        stuck_ids = [r["id"] for r in (stuck.data or [])]
        for sid in stuck_ids:
            supabase_client.table("detected_moves").update({
                "outcome_status": "NEUTRAL",
                "outcome_scored_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", sid).execute()
        if stuck_ids:
            log_info("detected_moves_swept_stuck", count=len(stuck_ids))
    except Exception as e:
        log_warning("detected_moves_sweep_failed", error=str(e)[:160])

    try:
        pending = (
            supabase_client.table("detected_moves")
            .select("*")
            .eq("outcome_status", "PENDING")
            .lte("detected_at", cutoff)
            .not_.is_("token_tracked", "null")
            .limit(batch_size)
            .execute()
        )
    except Exception as e:
        log_error("detected_moves_fetch_pending_failed", error=str(e)[:200])
        return {"scored": 0, "error": str(e)[:200]}

    rows = pending.data or []
    if not rows:
        return {"scored": 0, "pending": 0}

    symbol_ids = []
    contract_addrs = []
    for row in rows:
        sym = (row.get("token_tracked") or "").upper()
        cid = TOKEN_COINGECKO.get(sym)
        if cid:
            symbol_ids.append(cid)
        elif row.get("token_tracked_address"):
            contract_addrs.append(row["token_tracked_address"])
    id_prices = await _fetch_prices(symbol_ids)
    addr_prices = await _fetch_prices_by_contract(contract_addrs)

    scored = 0
    wins = 0
    for row in rows:
        price_after = _price_of(row.get("token_tracked"), row.get("token_tracked_address"), id_prices, addr_prices)
        price_at = float(row.get("price_at_detection") or 0)
        if not price_after or not price_at:
            # Still unpriceable after 24h (no CoinGecko coverage) → mark NEUTRAL so
            # it leaves the pending queue instead of being retried forever.
            supabase_client.table("detected_moves").update({
                "outcome_status": "NEUTRAL",
                "outcome_scored_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", row["id"]).execute()
            scored += 1
            continue

        ret = round(_return_pct(_track_sign(row), price_at, price_after), 2)
        outcome = _classify_outcome(ret)
        hypo_pnl = round(NOTIONAL_USD * ret / 100, 2)

        supabase_client.table("detected_moves").update({
            "outcome_status": outcome,
            "outcome_scored_at": datetime.now(timezone.utc).isoformat(),
            "price_24h_after": price_after,
            "return_pct_24h": ret,
            "hypothetical_pnl_usd": hypo_pnl,
        }).eq("id", row["id"]).execute()
        scored += 1
        if outcome == "WIN":
            wins += 1

    log_info("detected_moves_scored", scored=scored, wins=wins)
    return {"scored": scored, "wins": wins, "pending": len(rows)}


def _aggregate_stats(rows: list[dict], *, since: datetime | None = None, by: str = "detected") -> dict[str, Any]:
    # `by="scored"` windows on outcome_scored_at so freshly-resolved moves show
    # up live — a detected-at window of 24h can only hold still-PENDING moves
    # (scoring lags detection by 24h), which made wins(24h) structurally always 0.
    ts_field = "outcome_scored_at" if by == "scored" else "detected_at"
    if since:
        rows = [r for r in rows if _parse_ts(r.get(ts_field)) and _parse_ts(r[ts_field]) >= since]

    resolved = [r for r in rows if r.get("outcome_status") not in (None, "PENDING")]
    wins = [r for r in resolved if r.get("outcome_status") == "WIN"]
    losses = [r for r in resolved if r.get("outcome_status") == "LOSS"]
    # Win-only P&L (headline) and NET P&L across all scored moves (honest).
    total_hypo_pnl = sum(float(r.get("hypothetical_pnl_usd") or 0) for r in wins)
    net_hypo_pnl = sum(float(r.get("hypothetical_pnl_usd") or 0) for r in resolved)
    avg_win_pct = (
        sum(float(r.get("return_pct_24h") or 0) for r in wins) / len(wins)
        if wins else 0.0
    )
    avg_loss_pct = (
        sum(float(r.get("return_pct_24h") or 0) for r in losses) / len(losses)
        if losses else 0.0
    )
    # Win rate over decisive (WIN/LOSS) moves — NEUTRAL ties don't pad the rate.
    decisive = len(wins) + len(losses)
    win_rate = round(len(wins) / decisive * 100, 1) if decisive else None

    return {
        "detections": len(rows),
        "resolved": len(resolved),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate_pct": win_rate,
        "total_hypothetical_pnl_usd": round(total_hypo_pnl, 2),
        "net_hypothetical_pnl_usd": round(net_hypo_pnl, 2),
        "avg_win_return_pct": round(avg_win_pct, 2),
        "avg_loss_return_pct": round(avg_loss_pct, 2),
    }


def _equity_curve(rows: list[dict]) -> list[dict[str, Any]]:
    """Cumulative hypothetical P&L over EVERY scored move (win, loss, and the
    sub-threshold NEUTRAL movers), oldest→newest. Matches net_hypothetical_pnl_usd
    so the curve endpoint always equals the Net P&L stat."""
    scored = [
        r for r in rows
        if r.get("outcome_status") in ("WIN", "LOSS", "NEUTRAL")
        and r.get("hypothetical_pnl_usd") is not None
    ]
    scored.sort(key=lambda r: r.get("outcome_scored_at") or r.get("detected_at") or "")
    cum = 0.0
    pts: list[dict[str, Any]] = []
    for i, r in enumerate(scored, start=1):
        cum += float(r.get("hypothetical_pnl_usd") or 0)
        pts.append({
            "n": i,
            "t": r.get("outcome_scored_at") or r.get("detected_at"),
            "cum_pnl": round(cum, 2),
        })
    return pts


def _move_public_row(r: dict, *, extra: dict | None = None) -> dict:
    row = {
        "detected_at": r.get("detected_at"),
        "trader_label": r.get("trader_label"),
        "trader_rank": r.get("trader_rank"),
        "action": r.get("action"),
        "token_bought": r.get("token_bought"),
        "token_sold": r.get("token_sold"),
        "token_tracked": r.get("token_tracked"),
        "return_pct_24h": r.get("return_pct_24h"),
        "hypothetical_pnl_usd": r.get("hypothetical_pnl_usd"),
        "amount_usd": r.get("amount_usd"),
        "tx_hash": r.get("tx_hash"),
        "outcome_status": r.get("outcome_status"),
    }
    if extra:
        row.update(extra)
    return row


async def get_pending_preview(*, limit: int = 40) -> dict[str, Any]:
    """Live price check on PENDING moves — tracks what's trending toward WIN."""
    now = datetime.now(timezone.utc)
    try:
        res = (
            supabase_client.table("detected_moves")
            .select("*")
            .eq("outcome_status", "PENDING")
            .not_.is_("token_tracked", "null")
            .order("detected_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        log_error("pending_preview_fetch_failed", error=str(e)[:200])
        return {"moves": [], "on_track_count": 0, "updated_at": now.isoformat()}

    symbol_ids = []
    contract_addrs = []
    for row in rows:
        sym = (row.get("token_tracked") or "").upper()
        cid = TOKEN_COINGECKO.get(sym)
        if cid:
            symbol_ids.append(cid)
        elif row.get("token_tracked_address"):
            contract_addrs.append(row["token_tracked_address"])
    id_prices = await _fetch_prices(symbol_ids)
    addr_prices = await _fetch_prices_by_contract(contract_addrs)

    preview = []
    on_track = 0
    for row in rows:
        price_at = float(row.get("price_at_detection") or 0)
        price_now = _price_of(row.get("token_tracked"), row.get("token_tracked_address"), id_prices, addr_prices)
        detected = _parse_ts(row.get("detected_at"))
        hours_elapsed = round((now - detected).total_seconds() / 3600, 1) if detected else None
        hours_until_score = (
            max(0, round(SCORE_AFTER_HOURS - (hours_elapsed or 0), 1))
            if hours_elapsed is not None else SCORE_AFTER_HOURS
        )

        live_return = None
        projected_outcome = None
        if price_now and price_at:
            live_return = round(_return_pct(_track_sign(row), price_at, price_now), 2)
            projected_outcome = _classify_outcome(live_return)
            if projected_outcome == "WIN":
                on_track += 1

        preview.append(_move_public_row(row, extra={
            "live_return_pct": live_return,
            "projected_outcome": projected_outcome,
            "hours_elapsed": hours_elapsed,
            "hours_until_score": hours_until_score,
            "hypothetical_pnl_live_usd": round(NOTIONAL_USD * live_return / 100, 2) if live_return else None,
        }))

    preview.sort(key=lambda m: m.get("live_return_pct") or -999, reverse=True)
    return {
        "moves": preview,
        "on_track_count": on_track,
        "total_pending": len(preview),
        "updated_at": now.isoformat(),
    }


def _marketing_headline(d_all: dict, d24: dict, d7: dict, on_track: int) -> str | None:
    # Lead with the FULL-RECORD win rate — the honest number over the whole
    # sample, not a cherry-picked window. A bigger sample is also more credible.
    wr = d_all.get("win_rate_pct")
    decisive = (d_all.get("wins") or 0) + (d_all.get("losses") or 0)
    if wr is not None and decisive >= 10:
        return (
            f"Hadaleum's flagged moves won {wr:.0f}% of the time across all "
            f"{decisive} scored outcomes ({d_all.get('wins', 0)} wins), verified on-chain."
        )
    wins = d24.get("wins") or 0
    avg = d24.get("avg_win_return_pct") or 0
    if wins > 0:
        parts = [f"Hadaleum flagged {wins} winning copy-trader move{'s' if wins != 1 else ''} in the last 24h"]
        if avg:
            parts.append(f"averaging +{avg:.1f}% per win")
        return ", ".join(parts) + " — verified on-chain."
    if on_track > 0:
        return f"{on_track} detected move{'s' if on_track != 1 else ''} tracking toward WIN right now (live prices, pending 24h score)."
    if (d7.get("wins") or 0) > 0:
        return f"{d7['wins']} verified wins in the last 7 days — on-chain detections scored 24h after each move."
    return None


async def get_marketing_snapshot() -> dict[str, Any]:
    pulse = await get_trust_pulse()
    pending = await get_pending_preview()
    d24 = pulse.get("last_24h") or {}
    d7 = pulse.get("last_7d") or {}
    d30 = pulse.get("last_30d") or {}
    d_all = pulse.get("all_time") or {}
    on_track = pending.get("on_track_count") or 0
    headline = _marketing_headline(d_all, d24, d7, on_track)
    biggest = pulse.get("biggest_win")

    tweet_hooks = []
    wra = d_all.get("win_rate_pct")
    decisive_all = (d_all.get("wins") or 0) + (d_all.get("losses") or 0)
    if wra is not None and decisive_all >= 10:
        tweet_hooks.append(
            f"🟢 Hadaleum's flagged ETH copy-trader moves: {wra:.0f}% win rate across all "
            f"{decisive_all} scored outcomes. Every move verifiable on-chain — wins and losses. hadaleum.com/wins"
        )
    if biggest and biggest.get("return_pct_24h"):
        tok = biggest.get("token_bought") or biggest.get("token_sold") or "a token"
        tweet_hooks.append(
            f"🚀 Biggest detected win: +{float(biggest['return_pct_24h']):.1f}% on {tok} in 24h. "
            f"Logged on-chain the moment a ranked trader moved. hadaleum.com/wins"
        )
    if on_track:
        tweet_hooks.append(
            f"👀 {on_track} copy-trader moves we're watching right now — trending toward WIN. Live ledger: hadaleum.com/wins"
        )

    return {
        "headline": headline,
        "tweet_hooks": tweet_hooks,
        "stats_24h": d24,
        "stats_7d": d7,
        "stats_30d": d30,
        "stats_all": d_all,
        "on_track_count": on_track,
        "pending_total": pending.get("total_pending") or 0,
        "recent_wins": pulse.get("recent_wins") or [],
        "recent_losses": pulse.get("recent_losses") or [],
        "recent_scored": pulse.get("recent_scored") or [],
        "biggest_win": biggest,
        "equity_curve": pulse.get("equity_curve") or [],
        "watching": (pending.get("moves") or [])[:8],
        "methodology": pulse.get("methodology"),
        "updated_at": pulse.get("updated_at"),
    }


def _scored_public_row(r: dict) -> dict:
    return {
        "detected_at": r.get("detected_at"),
        "scored_at": r.get("outcome_scored_at"),
        "trader_label": r.get("trader_label"),
        "trader_rank": r.get("trader_rank"),
        "action": r.get("action"),
        "token_bought": r.get("token_bought"),
        "token_sold": r.get("token_sold"),
        "return_pct_24h": r.get("return_pct_24h"),
        "hypothetical_pnl_usd": r.get("hypothetical_pnl_usd"),
        "amount_usd": r.get("amount_usd"),
        "tx_hash": r.get("tx_hash"),
        "outcome_status": r.get("outcome_status"),
    }


async def get_trust_pulse() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)
    since_30d = now - timedelta(days=30)

    try:
        # Fetch all-time (most recent 1000) — not just 30d — so the headline can
        # show the honest full-record win rate, not a cherry-picked window.
        res = (
            supabase_client.table("detected_moves")
            .select("*")
            .order("detected_at", desc=True)
            .limit(1000)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        log_error("trust_pulse_fetch_failed", error=str(e)[:200])
        rows = []

    recent_wins = [_scored_public_row(r) for r in rows if r.get("outcome_status") == "WIN"][:12]
    recent_losses = [_scored_public_row(r) for r in rows if r.get("outcome_status") == "LOSS"][:12]
    # Full record = every RESOLVED move (win, loss, AND neutral/flat), newest
    # scored first. Including NEUTRAL shows the full activity instead of just the
    # handful that crossed the ±3% threshold — most logged moves are flat, and
    # hiding them made the record look empty. Win rate stays decisive-only.
    recent_scored = sorted(
        [_scored_public_row(r) for r in rows if r.get("outcome_status") in ("WIN", "LOSS", "NEUTRAL")],
        key=lambda r: r.get("scored_at") or r.get("detected_at") or "",
        reverse=True,
    )[:40]
    wins_only = [r for r in rows if r.get("outcome_status") == "WIN"]
    biggest_win = (
        _scored_public_row(max(wins_only, key=lambda r: float(r.get("return_pct_24h") or 0)))
        if wins_only else None
    )

    return {
        "available": True,
        "methodology": (
            "Hadaleum logs on-chain swaps from ranked copy traders at detection time, "
            f"then scores each move {SCORE_AFTER_HOURS}h later using on-chain DEX prices (DefiLlama/CoinGecko). "
            f"WIN = token moved ≥{WIN_THRESHOLD_PCT}% in the trader's favor. "
            f"Hypothetical P&L assumes a ${NOTIONAL_USD:,.0f} copy per move."
        ),
        "notional_usd": NOTIONAL_USD,
        "last_24h": _aggregate_stats(rows, since=since_24h, by="scored"),
        "last_7d": _aggregate_stats(rows, since=since_7d),
        "last_30d": _aggregate_stats(rows, since=since_30d),
        "all_time": _aggregate_stats(rows, since=None),
        "equity_curve": _equity_curve(rows),
        "recent_losses": recent_losses,
        "recent_scored": recent_scored,
        "biggest_win": biggest_win,
        "pending_scoring": sum(1 for r in rows if r.get("outcome_status") == "PENDING"),
        "recent_wins": recent_wins,
        "updated_at": now.isoformat(),
    }


async def run_trust_pipeline(enriched_pool: list[dict], *, limit: int = 50) -> dict:
    """Single ingest + score pass — used by cron, startup, and admin."""
    eth_usd = (await _fetch_prices(["ethereum"])).get("ethereum", 3500.0)
    ingest = await ingest_detected_moves(enriched_pool, limit=limit, eth_usd=eth_usd)
    score = await score_pending_moves()
    return {"ingest": ingest, "score": score, "eth_usd": eth_usd}
