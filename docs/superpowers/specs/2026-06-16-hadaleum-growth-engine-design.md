# Hadaleum Growth Engine — Design (v1)

**Date:** 2026-06-16
**Brand:** Hadaleum (product formerly "Sentinel"; repo namespace unchanged).
**Goal:** Solve the cold-start distribution problem so Hadaleum can reach ~$5k MRR.
A daily "Growth Brief" turns Hadaleum's own signal data into the exact ammo to win the
crypto-X reply game and convert borrowed attention into free signups → Pro.

---

## 0. Honest framing

The X account has **0 followers → 0 impressions**. That is arithmetic: X seeds posts to
your followers first, so zero followers = zero reach regardless of content quality. Posting
more does not help. The only way out of cold-start is **borrowing existing audiences** (data-
backed replies under big crypto accounts) plus **native, specific alpha** that earns profile
clicks → follows → a seed network the algorithm can finally expand.

**This system does not auto-post or auto-reply** (that gets the account banned and is against
X ToS). It removes the ~80% of the daily grind that is *finding alpha* and *deciding what to
say where*. The human still sends and is present daily.

**Expectation:** $5k/mo ≈ 100 Pro users. From zero that is a **3–6+ month** effort. The script
makes the grind efficient; it does not replace it. Success metric for v1 is leading indicators
(profile clicks, follows, free signups), not instant revenue.

---

## 1. Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Path to $5k/mo | Productize/distribute Hadaleum (not trade capital) |
| Channel | X/Twitter, cold-start from 0 followers |
| Approach | A — reply-alpha engine, human-in-loop (no auto-posting) |
| Delivery | Dated Markdown brief in repo + email via existing Resend |
| Target monitoring | Manual `targets.yaml`; user watches accounts, script supplies ammo |
| Data source | Live Hadaleum data (reuse existing backend modules) |
| Out of scope v1 | Auto-posting, paid X API monitoring, screenshot cards, Telegram/Reddit |

---

## 2. Architecture

New module `backend/growth/` inside the existing repo. Reuses, does not rebuild:
- `copy_traders_store.load_copy_traders()` → ranked traders
- `copy_trader_moves.fetch_recent_copy_moves(traders)` → live smart-money swaps
  (fields: `trader_label`, `rank`, `copy_score`, `amount_usd`, `action`,
  `sold`/`bought`, `unrealized_win_rate_pct`, `profit_factor`, `time`, `tx_hash`)
- `detected_moves.get_marketing_snapshot()` + `get_trust_pulse()` → win-ledger social proof
- `integrations.resend.send_email(to, subject, html)` → email delivery
- `db.supabase.supabase_client` → tracker persistence (graceful mock fallback already exists)

```
load_copy_traders ─┐
                   ├─▶ alpha_extractor ─▶ tweetability_ranker ─▶ top signals
fetch_recent_moves ┘                                                 │
get_marketing_snapshot ─▶ social-proof items ───────────────────────┤
                                                                     ▼
targets.yaml ─▶ engagement_planner ─────────────────▶ content_generator
                                                                     │
                                          (original posts + reply variants + CTA)
                                                                     ▼
                                                          brief_builder (Markdown)
                                                                     │
                                              ┌──────────────────────┴───────────┐
                                              ▼                                  ▼
                                  docs/growth/briefs/YYYY-MM-DD.md      Resend email
                                              │
            (next day) user logs results ─▶ tracker (Supabase: growth_metrics)
                                              │
                                  feeds back into ranker priorities
```

---

## 3. Module layout

```
backend/growth/
  __init__.py
  models.py            # Signal, RankedSignal, ContentPiece, BriefSection, DailyBrief (pydantic)
  alpha_extractor.py   # pull + normalize signals from live Hadaleum modules
  ranker.py            # tweetability_score() + select_top()
  content.py           # render original post + reply variants + CTA (templated)
  engagement.py        # load targets.yaml -> daily engagement checklist
  tracker.py           # write/read growth_metrics (Supabase), compute deltas
  brief.py             # assemble DailyBrief -> Markdown
  delivery.py          # write file + send email (reuses resend)
  run_daily.py         # CLI entrypoint: orchestrates the whole pipeline
  targets.yaml         # curated big crypto-X accounts (seeded, user-editable)
backend/tests/
  test_growth_ranker.py
  test_growth_content.py
  test_growth_tracker.py
  test_growth_brief.py
docs/growth/briefs/    # dated Markdown briefs land here
```

---

## 4. Module contracts

### models.py
- `Signal` — normalized alpha item: `kind` (`smart_money_buy` | `take_profit` | `win_ledger`),
  `token`, `trader_label`, `rank`, `amount_usd`, `unrealized_win_rate_pct`, `action`, `ts`,
  `tx_hash`, `raw: dict`.
- `RankedSignal` — `Signal` + `tweetability: float` + `reasons: list[str]`.
- `ContentPiece` — `original_post: str`, `reply_variants: list[str]`, `cta: str`, `signal_ref`.
- `BriefSection` / `DailyBrief` — structured brief: date, top signals, content pieces,
  engagement checklist, yesterday's metrics delta.

### alpha_extractor.py
`async def extract_signals(limit=15) -> list[Signal]`. Calls `load_copy_traders()` →
`fetch_recent_copy_moves()`; maps swaps to `Signal`s. Adds 1–2 `win_ledger` signals from
`get_marketing_snapshot()`. Pure mapping; all network is inside the reused modules.

### ranker.py
`def tweetability_score(s: Signal) -> tuple[float, list[str]]` — deterministic, unit-tested.
Higher score for: specific liquid token, larger `amount_usd`, recent `ts`, high-rank/high-
`unrealized_win_rate_pct` trader, `action == buy` (fresh entries beat exits), non-stablecoin.
`def select_top(signals, n=5) -> list[RankedSignal]`.

### content.py
`def make_content(rs: RankedSignal) -> ContentPiece`. Templated, specific, no hype.
- Original post: "Smart money watch: a wallet ranked #{rank} ({unrealized_win_rate_pct}% win
  rate) just {action} ${amount_usd:k} of ${token} {mins} min ago." + soft CTA.
- Reply variants: 2–3 phrasings to drop under a relevant big-account post.
- CTA: "Live smart-money feed → hadaleum.com (free)". Enforced ≤ 280 chars, CTA present.

### engagement.py
`def plan(targets: list[dict], top: list[RankedSignal]) -> list[dict]`. Each item: an account
to watch + which signal/reply best fits its beat (e.g., memecoin acct ↔ memecoin signal).

### tracker.py
`record_metrics(date, followers, profile_clicks, signups)` → Supabase `growth_metrics`.
`latest_delta()` → yesterday-vs-today changes for the brief. Graceful no-op if Supabase mock.

### brief.py / delivery.py
`build_brief(...) -> DailyBrief`; `to_markdown(brief) -> str`.
`deliver(md, brief)` → write `docs/growth/briefs/<date>.md` + `send_email` (subject:
"Hadaleum Growth Brief — <date>", HTML from the markdown). Email best-effort (never raises).

### run_daily.py
Async orchestration: extract → rank → content → plan → tracker delta → brief → deliver.
Run by hand first; cron/launchd later (not in v1 scope).

---

## 5. Testing (TDD)

- `tweetability_score`: a specific+big+recent+high-winrate buy outranks a vague small stale exit.
- `select_top`: returns ≤ n, sorted desc, ties stable.
- `make_content`: CTA present, every string ≤ 280 chars, token + number appear.
- `tracker`: delta math correct; mock-Supabase path is a clean no-op.
- `brief.to_markdown`: contains date, ≥1 content piece, engagement checklist, metrics line.
- No live network in tests — feed `Signal` fixtures.

---

## 6. Definition of done (v1)

`python -m growth.run_daily` produces a dated Markdown brief (and emails it) containing: the
day's top ~5 ranked alpha signals, ready-to-send original posts + reply variants with the
Hadaleum CTA, an engagement checklist against `targets.yaml`, and yesterday's follower/signup
delta. All units unit-tested on fixtures. Brand strings say "Hadaleum". No auto-posting exists.

## 7. Out of scope (v1)

Auto-posting/replying, paid X API target monitoring, screenshot image cards, Telegram/Reddit
channels, paid ads, scheduling/cron infra. All deferred to phase 2, justified by leading-
indicator traction from v1.
