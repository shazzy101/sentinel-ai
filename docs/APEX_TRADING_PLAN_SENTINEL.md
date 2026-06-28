# ⚡ APEX TRADING SYSTEM — SENTINEL-NATIVE BUILD PLAN (v3)

Retarget of the original APEX v2 plan from **Next.js 14 App Router + TS** onto Sentinel's **actual** stack:

- **Backend:** FastAPI (Python 3) on Railway — `backend/`, entry `main.py`
- **Frontend:** Vite + React 18 (JS, not TS) + React Router 6 + shadcn + Tailwind + Recharts + Framer Motion — `frontend/`
- **DB:** Supabase (SQL migrations in `backend/migrations/` and root `supabase/`)
- **Cron:** FastAPI `lifespan` + `asyncio.create_task` background loops (already the established pattern in `main.py`) — **no Vercel cron, no cron-job.org**
- **Tests:** `pytest` (backend) + `vitest` (frontend). No Jest, no `tsc`.

The product thesis is unchanged: **prove a distributed edge in paper, with honest edge-quality metrics, before any real capital.** Two non-negotiable gates remain — real prices confirmed (Step 23) and `distributed_edge=True` before going live (Step 50).

---

## ARCHITECTURE MAPPING (v2 → v3)

| v2 (Next.js) | v3 (Sentinel) |
|---|---|
| `app/trading/page.tsx` | `frontend/src/pages/trading/*.jsx` + React Router routes in `frontend/src/App.jsx` |
| `app/api/trading/*/route.ts` | FastAPI router `backend/trading_api.py` (`APIRouter`), mounted in `main.py` via `app.include_router` |
| `lib/trading/*.ts` engine | Python package `backend/trading/` (`indicators.py`, `strategies.py`, `engine.py`, `types.py`, `constants.py`, `api_clients.py`, `portfolio.py`) |
| `vercel.json` crons | `asyncio.create_task(_cron_apex_*)` inside `lifespan()` in `main.py` |
| `tsc --noEmit` / Jest | `pytest` (backend) / `vitest` (frontend) |
| App Router middleware auth | `AuthGuard` (frontend) + `main.require_admin` dependency (backend) |
| TS types | Python `dataclasses` / Pydantic models backend; plain JS objects frontend |
| Lightweight Charts | `recharts` (already a dep) — or add `lightweight-charts` only if candles needed |

**Reuse, do NOT rebuild:**

- `backend/signals/engine.py`, `outcomes.py`, `patterns.py`, `poller.py` — existing signal/outcome engine. Mirror `outcomes.py` SL/TP logic for the paper monitor.
- `backend/signals_api.py` — has `/api/signals`, `/api/track-record`, `compute_track_record()`, admin approve/reject. Study before writing the APEX equivalents; reuse helpers.
- `backend/scoring/engine.py`, `backend/db/supabase.py`, `backend/db/models.py`.
- `backend/integrations/twitter.py` (Step 28), `resend.py` (Step 30), `dune.py`.
- Frontend: `AuthGuard`, `MotionPage`, lazy + `Suspense` + `PageLoader` route pattern, existing `/track-record`, `/signals`, `/wins`, `/admin` pages and their components.

**Isolation rule:** all new backend code under `backend/trading/` + `backend/trading_api.py`; all new frontend code under `frontend/src/pages/trading/` + `frontend/src/components/trading/`. Touch existing files only where a step explicitly says (router mount, nav link, lifespan task).

---

## STANDING INSTRUCTION (paste at start of every build session)

```
You are building the APEX paper-trading module inside the existing Sentinel project:
FastAPI backend (backend/, main.py) + Vite/React 18 JS frontend (frontend/) + Supabase + Railway.
RULES:
- New backend code lives in backend/trading/ and backend/trading_api.py only.
- New frontend code lives in frontend/src/pages/trading/ and frontend/src/components/trading/ only.
- Crons are asyncio background tasks added to lifespan() in main.py — never Vercel/cron-job.org.
- Reuse existing infra: signals/, signals_api.py, integrations/twitter.py + resend.py, db/supabase.py, AuthGuard, MotionPage.
- Backend tests = pytest. Frontend tests = vitest. There is no TypeScript and no Jest.
- After each step, run its VERIFY block and paste real output. No success claims without evidence.
- Ambiguous? Make the standard production choice, state the assumption, keep going.
```

---

## CRITICAL DESIGN DECISION — THE WIN-RATE HONESTY PROBLEM (unchanged)

Hadaleum's live record shows ~48% win rate / +$11.2K, but nearly all P&L came from one move (USDC→MERC). One lucky catch ≠ repeatable edge. This system structurally exposes that via:

1. **Per-strategy + per-confluence segmentation** on every stat.
2. **Edge-quality metrics** — profit concentration (% of P&L from top trade), return-ex-max-win, consistency score, `distributed_edge` boolean.
3. **Testable confluence thesis** — "more strategies agreeing = higher win rate." Proven in paper or disproven in paper; never with real money.

`calculate_edge_quality()` in `backend/trading/engine.py` is the heart of this. `distributed_edge=True` only if no single trade > 30% of total P&L.

---

# 📦 BLOCK A — FOUNDATION (Steps 1–6)
No live deps. Can run 1→6 in one session, verify after each.

## STEP 1 — Scaffold the trading package + routes
**PROMPT:**
```
Create the APEX module skeleton.
Backend: create package backend/trading/ with empty modules:
  __init__.py, types.py, constants.py, indicators.py, strategies.py, engine.py,
  api_clients.py, portfolio.py
Create backend/trading_api.py with `router = APIRouter(prefix="/api/trading")` and one
  GET /api/trading/health returning {"status":"ok"}. Mount it in main.py with
  app.include_router(trading_router) next to the existing signals_router include.
Frontend: create frontend/src/pages/trading/ with placeholder pages (each renders an <h1>):
  TradingDashboard.jsx, PaperTerminal.jsx, BacktestPage.jsx, SignalsFeedPage.jsx,
  StrategiesPage.jsx, JournalPage.jsx, TradingTrackRecord.jsx, TradingAdmin.jsx
Add a nested layout TradingLayout.jsx with a sidebar of 8 links (dark theme #060810),
  lazy-load each page with Suspense + the existing PageLoader, following the App.jsx pattern.
Add routes under /trading/* in frontend/src/App.jsx (reuse MotionPage; track-record public,
  rest behind AuthGuard except where noted later). Add ONE nav link "Trading Lab" + "PAPER"
  badge to the existing nav component — show the diff before applying.
```
**✅ VERIFY:**
```
- cd backend && uvicorn main:app --reload → GET /api/trading/health returns {"status":"ok"}, app boots clean
- cd frontend && npm run dev → /trading shows sidebar w/ 8 links, each routes to its <h1>, no console errors
- Confirm an existing page (e.g. /track-record, /signals) still loads
```

## STEP 2 — Types & Constants (Python)
**PROMPT:**
```
Fill backend/trading/types.py with dataclasses (or Pydantic models where API-serialized):
  OHLCV, Signal, Trade, StrategyResult, PortfolioStats, EquityPoint, Asset, PaperPosition,
  BacktestResult, StrategyStats, EdgeQuality.
Field specs (match exactly):
- OHLCV: ts, open, high, low, close, volume, bar, day, orb_high|None, orb_low|None, day_open (floats)
- Signal: id, ts, asset, timeframe, dir('LONG'|'SHORT'), price, sl, tp, confidence,
  confluence_score, votes, is_high_conviction, strategies[], rsi, vwap, atr,
  status('PENDING'|'WIN'|'LOSS'|'EXPIRED'), exit_price?, pnl_pct?, exit_reason?, bars_held?
- EdgeQuality: profit_concentration, return_ex_max_win, consistency_score (0-100),
  longest_flat_period, distributed_edge (bool: True if no single trade > 30% of P&L)
- (all other types fully typed)
Fill backend/trading/constants.py:
- ASSETS (8): BTC/USD, ETH/USD, SOL/USD (crypto+coingecko_id), NVDA, TSLA, AAPL (stock),
  SPY, QQQ (etf+alpaca_symbol)
- STRATEGIES (7): ORB, VWAP_REVERSION, EMA_CROSS, MACD_MOMENTUM, BB_SQUEEZE, RSI_DIVERGENCE,
  GAP_GO, each {key, name, description, color, base_rr}
- RISK_PARAMS: default_risk_pct 0.02, max_daily_drawdown 0.05, max_daily_trades 3,
  min_confluences 2, atr_sl_mult 1.5, atr_tp_mult 3.0
- TIMEFRAMES, PAPER_STARTING_CAPITAL 10000
```
**✅ VERIFY:**
```
cd backend && python -c "from trading.constants import ASSETS, STRATEGIES; print(len(ASSETS), len(STRATEGIES))"
→ 8 7. python -c "import trading.types" imports clean.
```

## STEP 3 — Indicator library + pytest
**PROMPT:**
```
Implement backend/trading/indicators.py (pure Python or numpy — add numpy to requirements.txt
if used). All functions handle empty input / None without raising, return None for invalid:
  sma, ema, rsi, vwap (resets on new day), atr, bollinger_bands, macd, stoch_rsi, adx, obv,
  plus run_all_indicators(bars) -> dict.
Tests backend/tests/trading/test_indicators.py (pytest):
- sma([1,2,3,4,5],3) last == 4
- ema reacts faster than sma to a jump
- rsi: 14 gains → >70; 14 losses → <30
- vwap resets when bar.day increments
- atr positive on volatile bars
- every fn returns [] / None on empty input, never raises
```
**✅ VERIFY:** `cd backend && pytest tests/trading/test_indicators.py -q → all green. Fix the indicator, not the test, on failure.`

## STEP 4 — Strategy engine + pytest
**PROMPT:**
```
backend/trading/strategies.py: one fn per strategy, sig (bars, indicators, i) -> StrategyResult|None,
  for ORB, VWAP_REVERSION, EMA_CROSS, MACD_MOMENTUM, BB_SQUEEZE, RSI_DIVERGENCE, GAP_GO
  (volume filters, VWAP alignment, RSI bounds, ATR levels per APEX spec).
backend/trading/engine.py:
- run_strategies_on_bar(bars, i): run all 7, count LONG vs SHORT, avg_conf of agreeing,
  confluence_score=(votes/7)*avg_conf, is_high_conviction=votes>=4, SL=price∓ATR*1.5,
  TP=price±ATR*3.0; return Signal if votes>=min_confluences else None
- run_backtest(bars, starting_capital, risk_pct, min_votes): iterate from i=52, return BacktestResult
- calculate_portfolio_stats(trades, starting_capital): win_rate, max_drawdown, expectancy,
  profit_factor, sharpe, calmar
- calculate_edge_quality(trades): profit_concentration, return_ex_max_win, consistency_score,
  distributed_edge — CRITICAL, exposes one-trade-luck
Tests backend/tests/trading/test_engine.py:
- mock bars trigger ORB long → signal.strategies includes 'ORB'
- 4 aligned strategies → is_high_conviction True
- 2 long + 1 short → dir LONG, votes 2
- one trade = 90% of P&L → distributed_edge False
- evenly distributed wins → distributed_edge True
```
**✅ VERIFY:** `pytest tests/trading/test_engine.py -q → green, esp. the distributed vs concentrated edge-quality asserts.`

## STEP 5 — Supabase schema
**PROMPT:**
```
Create backend/migrations/002_apex_trading.sql (do NOT alter existing tables):
  trading_signals, paper_positions, paper_equity_snapshots, strategy_performance,
  price_cache, trading_logs. Full columns per APEX spec incl. is_paper (default true),
  tweet_id, on_chain_hash on trading_signals.
Enable RLS on all. Public SELECT policy on trading_signals only. Indexes:
  signals(asset), signals(status), signals(created_at DESC), positions(status),
  price_cache(asset,timeframe,ts DESC).
Apply via the existing Supabase migration flow used for 001_add_wallets_balance.sql.
```
**✅ VERIFY:** `Run migration, confirm 6 tables exist (Supabase dashboard or SQL). Manual insert→select→delete one trading_signals row works.`

## STEP 6 — Env vars & API client skeleton
**PROMPT:**
```
Add to backend env (.env + document in DEPLOY.md / Railway vars):
  PAPER_TRADING=true, PAPER_STARTING_CAPITAL=10000, DEFAULT_RISK_PCT=0.02,
  COINGECKO_API_KEY, ALPACA_API_KEY, ALPACA_API_SECRET,
  ALPACA_BASE_URL=https://paper-api.alpaca.markets, CRON_SECRET (random 32-char).
Fill backend/trading/api_clients.py:
- reuse db/supabase.py for the admin client
- is_market_open() -> bool (9:30-16:00 ET Mon-Fri)
- fetch_ohlcv(asset, timeframe, limit): DETERMINISTIC seeded simulated bars for now
  (# TODO: real data in Step 23), so downstream is buildable/testable
- fetch_alpaca_bars / fetch_coingecko_bars stubs that raise NotImplementedError
Use httpx (already a dep) for future real calls.
```
**✅ VERIFY:** `python -c "from trading.api_clients import fetch_ohlcv, is_market_open; b=fetch_ohlcv(...,100); print(len(b), all(x.high>=x.low for x in b), is_market_open())" → 100 True <bool>`

**🎯 END BLOCK A** — tested Python engine + edge-quality detection + live DB + data interface, zero UI/live-data yet.

---

# 📦 BLOCK B — DATA PIPELINE (Steps 7–12)
One at a time. All endpoints live in `backend/trading_api.py`.

## STEP 7 — Price endpoints
```
In trading_api.py: GET /api/trading/prices (asset,timeframe,limit → fetch_ohlcv, JSON, Cache-Control s-maxage=60)
and GET /api/trading/prices/{asset} (last price + 24h change/high/low).
```
**✅ VERIFY:** `GET /api/trading/prices?asset=BTC/USD&timeframe=5m&limit=50 → 50 bars. GET /api/trading/prices/BTC%2FUSD → last-price object.`

## STEP 8 — Signal generation + read endpoints
```
POST /api/trading/signals/generate (protected by CRON_SECRET header): scan ASSETS,
  run_strategies_on_bar on latest bar, skip assets with an OPEN position or past daily limit,
  insert trading_signals + paper_positions. GET /api/trading/signals (public, filter
  asset/status/strategy, paginated) + /api/trading/signals/latest (10 newest).
```
**✅ VERIFY:** `POST w/ correct secret → {generated, signals[]} and rows in both tables. Wrong secret → 401. GET returns them.`

## STEP 9 — Position monitor
```
POST /api/trading/positions/monitor (CRON_SECRET): fetch OPEN positions, current price each,
  check SL/TP per LONG/SHORT, close hits (update paper_positions + trading_signals status/exit/pnl),
  48h expiry, end-of-day equity snapshot. Mirror logic from signals/outcomes.py.
  GET /api/trading/positions (open w/ unrealized P&L + closed-today).
```
**✅ VERIFY:** `Insert a position w/ TP just below price → monitor closes WIN + signal row WIN+pnl. SL just above → LOSS. Both confirmed.`

## STEP 10 — Portfolio analytics
```
GET /api/trading/portfolio → full state INCLUDING edge_quality block (profit_concentration,
  return_ex_max_win, distributed_edge, consistency_score), strategy_breakdown[], equity curve,
  current streak, best/worst trade. GET /api/trading/portfolio/stats → rolling 7d/30d/all.
```
**✅ VERIFY:** `GET /api/trading/portfolio → non-null win_rate, equity[], edge_quality (distributed_edge bool, profit_concentration %).`

## STEP 11 — Backtest endpoint
```
POST /api/trading/backtest (asset,timeframe,days,starting_capital,risk_pct,min_votes,strategies[]?)
  → run_backtest + max consec wins/losses, avg bars held, per-strategy contribution, edge_quality.
  10-min in-memory cache keyed by params (functools/dict). Compare mode: each strategy isolated, side-by-side.
```
**✅ VERIFY:** `POST {BTC/USD,30,0.02,2} → BacktestResult w/ trades[], stats, strategy_breakdown, edge_quality. 2nd identical call faster (cache). Compare → 7 isolated results.`

## STEP 12 — Cron wiring (asyncio) + health
```
In main.py lifespan(), add two background tasks following the existing _cron_signal_poll pattern:
  _cron_apex_signals (every 5 min, startup grace) → calls signal-generate logic,
  _cron_apex_monitor (every 1 min) → calls position-monitor logic.
  Call the engine functions directly (in-process), not via HTTP. Guard each loop in try/except.
Expand GET /api/trading/health: last_signal_at, last_price_update_at, open_positions,
  today_signals, engine status. NO vercel.json.
```
**✅ VERIFY:** `Boot app → after grace, signals/positions tasks run (check trading_logs/health timestamps). GET /api/trading/health → status object updating.`

**🎯 END BLOCK B** — engine + pipeline working on simulated data; real swap at Step 23 is low-risk.

---

# 📦 BLOCK C — DASHBOARD UI (Steps 13–22)
One at a time. React + Recharts + Framer Motion. Use SWR-style polling via a small `useFetch`/`useInterval` hook or `@tanstack/react-query` if you add it; otherwise `useEffect` + `setInterval`.

## STEP 13 — Trading layout + data provider
`Flesh out TradingLayout.jsx: collapsible sidebar (8 links + live count badges), top bar with price ticker + portfolio summary (capital, today P&L, 30d win rate) + last-scan time + green/red engine dot. Add components/trading/TradingDataProvider.jsx (React context shell; hooks in Step 20).`
**✅ VERIFY:** `Layout on all 8 pages, badges show numbers, dot visible, no errors, mobile collapses to bottom bar.`

## STEP 14 — Main dashboard
`TradingDashboard.jsx: KPI row (Total Return, Win Rate, Max Drawdown, Expectancy) + EDGE QUALITY card (green "Distributed Edge ✓" or amber "Concentrated — one trade carrying P&L"), equity curve (Recharts, 2/3) w/ benchmark, open positions (1/3) live, signal feed, mini strategy leaderboard. Poll 30s.`
**✅ VERIFY:** `Loads real API data. Edge card shows correct state. Equity renders. No layout shift.`

## STEP 15 — Paper terminal
`PaperTerminal.jsx: asset tabs, candlestick chart (Recharts composed chart, or npm i lightweight-charts if true candles needed) w/ VWAP/EMA9/EMA21 overlays + entry markers + SL/TP lines, right panel current-signal + open-position w/ SL→TP progress bar + manual close, recent-signals table for that asset.`
**✅ VERIFY:** `Real candles per asset, overlays visible, SL/TP lines when open, manual close (paper) works, mobile full-width.`

## STEP 16 — Backtester page
`BacktestPage.jsx: config (asset, timeframe, period slider 7-90d, capital, risk slider, min-confluence slider, 7 strategy toggles, Run) + results (metrics grid, equity curve, sortable strategy table, paginated/filterable trade log, edge-quality summary, Compare side-by-side, export JSON/CSV).`
**✅ VERIFY:** `30d run populates. Toggle a strategy → results change. Compare → 7 cols. Export downloads.`

## STEP 17 — Signals feed
`SignalsFeedPage.jsx: header stats, filters (asset/dir/status/strategy/date/min-confidence/high-conviction toggle), sortable color-coded table, inline row expand w/ full metadata (RSI/VWAP/ATR), pagination, new PENDING animate in (30s poll).`
**✅ VERIFY:** `Filters work, row expands, sort by P&L works, pagination works.`

## STEP 18 — Strategy leaderboard
`StrategiesPage.jsx: 7 strategy cards (win rate, signals, avg P&L, avg R:R, max consec losses, best asset, mini equity), asset×strategy win-rate matrix (color scale), and the CONFLUENCE ANALYSIS bar chart (win rate vs #confluences 1/2/3/4/5+) — proves the core thesis. 7d/30d/all toggle.`
**✅ VERIFY:** `All 7 strategies show stats. Confluence chart renders + shows whether higher confluence = higher win rate. Matrix colors work.`

## STEP 19 — Journal
`JournalPage.jsx: rules reference, 30-day collection progress tracker (day counter, checklist, rolling win rate vs target), notes (localStorage), monetization roadmap timeline.`
**✅ VERIFY:** `Day counter shows, notes persist after refresh, progress bar reflects days elapsed.`

## STEP 20 — Real-time hooks
`frontend/src/hooks/useTradingData.js: usePrices(10s), useSignals(30s, toast on new), usePositions(15s, live unrealized P&L), usePortfolio(60s). Wire into TradingDataProvider. LIVE/STALE indicator (stale if >2min).`
**✅ VERIFY:** `Prices update without refresh. New signal → toast. LIVE shows; stop backend → STALE after 2min.`

## STEP 21 — Shared components
`components/trading/: SignalCard, EquityChart (Recharts), ConfluenceGauge (animated arc), StrategyPill, PriceDisplay (flash on update), PositionCard (SL→TP progress), KPICard, EdgeQualityBadge. Framer Motion entrances. Refactor pages to use them.`
**✅ VERIFY:** `All pages render post-refactor. EdgeQualityBadge correct. Gauge animates. No duplicated inline components.`

## STEP 22 — Mobile pass
`Responsive: sidebar→bottom tabs, dashboard single col, KPIs 2x2, terminal chart full-width, backtest config accordion, signals table→cards, charts responsive (Recharts ResponsiveContainer), 44px touch targets. Test 375px + 768px.`
**✅ VERIFY:** `375px + 768px: every page usable, no horizontal overflow, charts scale.`

**🎯 END BLOCK C** — full mobile-ready dashboard on simulated data.

---

# 📦 BLOCK D — LIVE ENGINE (Steps 23–30)
One at a time, verify hard.

## STEP 23 — Real prices (Alpaca + CoinGecko) ⚠️ CRITICAL SWAP
```
Implement fetch_alpaca_bars (stocks/ETFs, data.alpaca.markets v2, paper keys, httpx) and
fetch_coingecko_bars (crypto, /coins/{id}/ohlc, resample to 5m). Update fetch_ohlcv:
crypto→CoinGecko, stocks→Alpaca, cache-first via price_cache (5min freshness), store after fetch.
Keep simulated fallback ONLY when is_market_open() is False for stocks, with a "market_closed" flag.
```
**✅ VERIFY:** `fetch_ohlcv(BTC/USD) returns REAL CoinGecko price (cross-check Google, within a few %). fetch_ohlcv(NVDA) in market hours → real Alpaca bars. price_cache fills. DO NOT PROCEED until real prices confirmed.`

## STEP 24 — Production signal cron
```
Harden the signal-generate path: CRON_SECRET on the HTTP route, daily-limit + daily-drawdown
guard (stop if down 5% today), skip-if-open-position, real fetch_ohlcv, per-asset try/except so one
failure never breaks the loop, log every action to trading_logs.
```
**✅ VERIFY:** `Trigger → signals on REAL data. Force one asset error → others still scan. trading_logs has entries. Drawdown guard fires on a simulated down day.`

## STEP 25 — Production position monitor
```
Harden monitor on real prices: precise SL/TP, both-hit edge case (use closer-to-entry), 48h expiry,
per-position try/except, end-of-day equity snapshot, log to trading_logs. Reuse signals/outcomes.py helpers.
```
**✅ VERIFY:** `Unrealized P&L = (current-entry)/entry. Force a real-priced TP/SL → closes correctly. Snapshot inserts.`

## STEP 26 — Portfolio capital tracking
```
backend/trading/portfolio.py: get_current_capital, update_capital_after_close, get_equity_curve,
calculate_drawdown, calculate_sharpe, calculate_calmar, get_rolling_win_rate,
is_daily_drawdown_breached, get_edge_quality (profit concentration over real trades).
```
**✅ VERIFY:** `get_current_capital == 10000 + sum(closed pnl). is_daily_drawdown_breached True when forced -5%. get_edge_quality returns real distribution.`

## STEP 27 — Admin health page
```
TradingAdmin.jsx (gate behind require_admin / AuthGuard admin check): engine status, API health
(CoinGecko/Alpaca/Supabase OK/FAIL), today's activity, last 10 trading_logs errors, cron schedule
check, "Force Run" buttons (call the protected endpoints), "Reset Paper Portfolio" (type RESET).
```
**✅ VERIFY:** `Loads for admin only. Health pings OK. Force Run triggers a scan. Reset (after RESET) zeroes positions + sets capital 10000.`

## STEP 28 — X/Twitter auto-posting
```
Extend backend/integrations/twitter.py (already exists): post_signal_to_x(signal) — format w/ PAPER
label + confluences + TP/SL + track-record link, only votes>=4, max 3/day, store tweet_id. Call from
the signal cron for high-conviction. Add TWITTER_* env vars if missing.
```
**✅ VERIFY:** `Keys set → high-conviction signal posts a real tweet, tweet_id saved. No keys → no-op, cron survives. PAPER disclaimer present.`

## STEP 29 — Public track record ⚠️ HONESTY-CRITICAL
```
TradingTrackRecord.jsx (public, no login, route already added): hero win rate BUT prominently show
EDGE QUALITY — "Distributed Edge ✓" or honest "Concentrated" warning, profit-concentration %,
return-ex-best-trade. Closed signals only. Per-strategy breakdown. Confluence-tier win-rate chart.
CSV export. OG meta. Must NOT hide one-trade-luck. Improves on the existing /track-record honesty.
Reuse compute_track_record() from signals_api.py where it fits.
```
**✅ VERIFY:** `Loads WITHOUT login. Shows edge-quality honestly (says "Concentrated" if data is). Per-strategy + per-confluence render. Would a sophisticated buyer trust it?`

## STEP 30 — Notifications
```
backend uses integrations/resend.py (exists) for email. frontend: browser Notification API
(high-conviction) + "Enable Notifications" button in TradingLayout. trading_notification_prefs table.
Toasts (reuse existing toast lib or add sonner). Email template w/ paper disclaimer + min-votes pref.
```
**✅ VERIFY:** `Browser permission → high-conviction fires notification. Test email sends to you. Prefs persist.`

**🎯 END BLOCK D** — autonomous engine on real data, posting honest track record.

---

# 📦 BLOCK E — POLISH & DEPLOY (Steps 31–40)

## STEP 31 — Skeletons & error states
`Skeleton loaders (SignalCard, KPI, TableRow, Chart, Position) w/ shimmer + error states ("Failed to load X" + Retry) on every data component. Never blank.`
**✅ VERIFY:** `Throttle network → skeletons. Kill backend → error card + working Retry.`

## STEP 32 — Performance
`Code-split heavy pages (React.lazy already used), backend response caching (price_cache + in-proc TTL; add Redis only if Railway has it), column-select all Supabase queries, paginate lists (max 100), move heavy portfolio stats into a Postgres function if needed. Frontend Lighthouse >85.`
**✅ VERIFY:** `Lighthouse on /trading + /trading/paper both >85.`

## STEP 33 — Error boundaries
`React error boundary around charts + feeds, a /trading error fallback, try/except around every cron asset-loop iteration (already partly done). Log caught errors to trading_logs.`
**✅ VERIFY:** `Feed bad data to a chart → boundary shows friendly error, rest of page lives. Logged.`

## STEP 34 — Auth guard + tiering
`Protect /trading/* via AuthGuard except /trading/track-record (public). Logged-out → /login?redirect=/trading. Logged-out teaser on /trading dashboard (blurred + Sign up). Reuse existing AuthGuard. Show user email in sidebar.`
**✅ VERIFY:** `Logged out: track-record works, dashboard redirects. Logged in: full access. Teaser shows.`

## STEP 35 — Sentinel integration
`Add Trading Lab to main nav (BETA badge — done in Step 1, refine), add a homepage/dashboard widget ("Paper Portfolio +X% this week", "N signals today" → /trading), an APEX card on the existing dashboard.`
**✅ VERIFY:** `Existing pages show widget w/ live data + correct links. Nothing existing broke.`

## STEP 36 — SEO & OG images
`Meta tags on track-record + dynamic OG image. Vite/React: prerender via a small FastAPI OG-image endpoint (Pillow/satori-py) or a static generator — there is no @vercel/og. JSON-LD Dataset schema.`
**✅ VERIFY:** `Page source has OG tags. OG image endpoint renders an image w/ real stats. Twitter card validator passes.`

## STEP 37 — Full test suite
`Expand: indicators (done), strategies (each trigger/no-trigger), engine (backtest determinism, drawdown, edge-quality distributed vs concentrated), portfolio math. pytest backend, vitest frontend.`
**✅ VERIFY:** `cd backend && pytest -q AND cd frontend && npm test → all green, esp. edge-quality.`

## STEP 38 — Rate limiting & security
`Reuse existing backend/rate_limits.py + quota.py patterns: public 30/min/IP, auth 100/min/user,
backtest 5/min, cron secret + 1/min. Pydantic-validate all POST bodies (already idiomatic here).
Sanitize inputs. CORS already configured in main.py — confirm public reads allowed, external writes blocked.`
**✅ VERIFY:** `>30/min on a public endpoint → 429. Malformed backtest body → 422. Cron w/o secret → 401.`

## STEP 39 — Deploy to Railway
`Backend already deploys via railway.json (uvicorn). Set ALL env vars in Railway. Frontend deploys
via Cloudflare Pages (existing). Pre-deploy checklist: frontend npm run build clean, pytest + vitest pass,
migration applied, /api/trading/health OK.`
**✅ VERIFY:** `Deploy. Live /api/trading/health OK. Live /trading/track-record public. Cron tasks run in prod (check trading_logs).`

## STEP 40 — Seed 30 days of history
`backend/scripts/seed_trading_history.py: generate 30d of signals+trades+equity+strategy stats via the
engine, past timestamps, $10k start, 2% risk. REFUSE if trading_signals already has rows. Realistic
outcomes, honest edge-quality.`
**✅ VERIFY:** `Run once → charts populate, equity non-flat, leaderboard has data. Run again → refuses.`

**🎯 END BLOCK E** — deployed, tested, secured, 30-day history live.

---

# 📦 BLOCK F — MONETIZATION (Steps 41–50)

## STEP 41 — Performance report
`backend report endpoint (PDF via reportlab/weasyprint — no @react-pdf: summary, equity image, strategy breakdown, edge-quality, risk, conclusion). HTML version at /trading/report. Shareable /trading/report/[token] (7-day expiry, report_shares table).`
**✅ VERIFY:** `PDF downloads w/ real stats + edge-quality. Share link works w/o login, expires.`

## STEP 42 — Waitlist
`/trading/access page + POST /api/trading/waitlist (email + Resend confirmation via integrations/resend.py, GET admin count). trading_waitlist table. Show count on track-record. Weekly update email.`
**✅ VERIFY:** `Submit → row + confirmation email. Count shows. Duplicate handled.`

## STEP 43 — Stripe (Free vs Pro $49)
`Reuse existing billing infra (quota.py + billing columns from the security migration). Stripe checkout/webhook/portal. trading_subscriptions table (or extend existing). Gate paper/signals/backtest/strategies/journal behind Pro; track-record stays free. Upgrade prompts on locked pages.`
**✅ VERIFY:** `Test-mode checkout → Pro pages unlock. Cancel via portal → reverts. Webhook updates status.`

## STEP 44 — Strategy export & Pine Script
`/trading/export (Pro): strategy spec PDF, performance CSV, Pine Script v5 generator endpoint for ORB/VWAP/EMA. One-time $299 bundle payment link.`
**✅ VERIFY:** `Pine Script pastes into TradingView + compiles + plots. CSV opens in Excel. Spec PDF generates.`

## STEP 45 — Sharing & embeds
`Public /trading/share/[token] snapshot + share-token API. "Share Performance" button. Embeddable iframe widget (win rate + signal count) linking back to Sentinel.`
**✅ VERIFY:** `Share link → public snapshot. Embed in a test HTML → renders + links back.`

## STEP 46 — Email automation
`Resend sequences via integrations/resend.py: waitlist nurture (0/3/7/14/28), Pro onboarding (0/3/7), weekly Monday digest. Dark templates, live stats at send, unsubscribe, dedupe send history.`
**✅ VERIFY:** `Day-0 waitlist email received, themed, real stats, unsubscribe works. No dupes.`

## STEP 47 — Analytics
`Frontend analytics (existing Sentry + a lightweight event tracker) + custom events (page views, signal views, backtest runs, shares, waitlist joins, upgrade clicks) → trading_events table. Admin analytics view: DAU, top signals, popular backtests, waitlist conversion, top upgrade-trigger page.`
**✅ VERIFY:** `Tracked actions → trading_events rows. Admin view shows counts.`

## STEP 48 — PWA
`manifest.json (APEX, standalone, #060810), 192/512 icons, meta, install prompt after 3 visits (localStorage dismiss). Service worker scaffold (push not enabled in MVP). Vite PWA plugin OK.`
**✅ VERIFY:** `Mobile Chrome → Add to Home Screen → launches standalone w/ APEX icon.`

## STEP 49 — Go-live checklist
`Full pre-launch verification: engine (health green, manual scan generates, TP/SL/expiry close), dashboard (all tabs, edge-quality honest, track-record public), data (caches filling, snapshots inserting), notifications (browser/email/X fire). Produce a checklist report.`
**✅ VERIFY:** `Every box checked. Commit to a 30-day start date. NO real capital until 30 days of honest distributed-edge data exists.`

## STEP 50 — Launch
`Export 30-day report. X thread (setup → weekly → biggest win/loss → final stats + edge-quality → track-record link). Email waitlist (founding $29 vs $49). Post + communities. Stripe live. Monitor /trading/admin 24h. Targets: month 1 ~$888; scale to $2.9-4.9k/mo at 100 subs.`
**✅ VERIFY:** `Track-record public + honest. Waitlist email deliverable. Stripe live works. Admin monitoring active. FINAL GATE: promote real-money use ONLY if 30-day distributed_edge=True. If concentrated, keep iterating in paper.`

---

# 📊 EXECUTION SUMMARY

| Block | Steps | Send style | Gate that matters |
|-------|-------|-----------|-------------------|
| A · Foundation | 1–6 | Sequential, one session | pytest green before live data |
| B · Data Pipeline | 7–12 | One at a time | Signals generate + positions close |
| C · Dashboard | 13–22 | One at a time | Edge-quality visible, mobile works |
| D · Live Engine | 23–30 | One at a time | **Step 23: real prices confirmed** |
| E · Polish/Deploy | 31–40 | One at a time | Live /health OK, 30d seeded |
| F · Monetization | 41–50 | One at a time | **Step 50: distributed_edge=True before real money** |

**Stack-specific reminders:** Python engine (`backend/trading/`), FastAPI routes (`backend/trading_api.py`), asyncio crons in `lifespan()`, React Router pages (`frontend/src/pages/trading/`), pytest + vitest, Railway + Cloudflare Pages deploy. No Next.js, no Vercel, no TypeScript, no Jest.
