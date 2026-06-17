# Hadaleum Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task ends with a commit.

**Goal:** Revolutionize the existing Sentinel app (live at hadaleum.com) into the full "Hadaleum" whale-signal + educational-onramp product described in the spec — Bloomberg + Apple + crypto aesthetic — WITHOUT a framework migration.

**Architecture:** Keep the working stack — FastAPI backend (Railway) + React 18/Vite/Tailwind frontend (Cloudflare Pages) + Supabase. Transform the product surface: a unified dark design system, a signal-centric dashboard, a credibility-first track record, a `signals`-table approval pipeline (`pending_review → active → win/loss`), an Admin approval UI that posts to X, 6 interactive Learn modules that gamify feature unlocks, and a signal detail page. Reuse the existing trust/detected-moves pipeline as the outcome-tracking engine; add the pattern A–D classifier on top.

**Tech Stack:** FastAPI, Python 3, pytest, tweepy (X API v2), Anthropic SDK (claude-sonnet-4-6), Supabase; React 18, Vite, Tailwind, Framer Motion, Recharts, react-router-dom, Vitest + React Testing Library (new).

**Design tokens (spec-mandated, apply globally):**
- `--bg-base: #0a0a0a`; accent green `#00ff88`; loss red `#ff4444`; text `#ffffff`; secondary `#888888`.
- Fonts: Inter (UI), JetBrains Mono (all numbers/data). Both already in `tailwind.config.js`.
- Numbers count up on first render (reuse existing `AnimatedCounter`). Confidence as filled circles `●●●○○`. Win = green glow, Loss = red glow. Skeletons, not spinners. Mobile responsive.

---

## Conventions for every task

- **Backend syntax check** after edits: `python3 -c "import ast; ast.parse(open('PATH').read())"`.
- **Backend tests:** `cd backend && python3 -m pytest tests/<file> -v`.
- **Frontend tests:** `cd frontend && npx vitest run <file>` (Vitest added in Task 1).
- **Visual verification:** start dev (`./start.sh` or `cd frontend && npm run dev`) and use the Claude_Preview / browser preview MCP to screenshot the page; confirm dark theme + tokens.
- **Commit** at the end of each task with a `feat(hadaleum):` / `test:` / `chore:` prefix.
- Reuse existing components in `frontend/src/components/` (layout, ui, primitives, charts, trust) — do not reinvent. Follow existing `.jsx` patterns.

---

## PHASE 0 — Foundations

### Task 1: Frontend test harness (Vitest)

**Files:**
- Modify: `frontend/package.json` (add devDeps + `test` script)
- Create: `frontend/vitest.config.js`
- Create: `frontend/src/test/setup.js`
- Create: `frontend/src/test/smoke.test.jsx`

- [ ] Add devDeps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts.
- [ ] `vitest.config.js`: environment `jsdom`, `globals: true`, `setupFiles: ['./src/test/setup.js']`.
- [ ] `setup.js`: `import '@testing-library/jest-dom'`.
- [ ] Smoke test: render a trivial `<div>ok</div>` via RTL, assert it's in the document.
- [ ] Run `cd frontend && npm install && npx vitest run` → PASS.
- [ ] Commit.

### Task 2: Design token unification

**Files:**
- Modify: `frontend/src/index.css` (CSS variables block)
- Modify: `frontend/tailwind.config.js` (ensure `signal`/`loss` color aliases exist)
- Create: `frontend/src/design/tokens.md` (one-page reference of the palette/typography rules)

- [ ] Audit current `:root` vars in `index.css`. Set/confirm: `--bg-base:#0a0a0a`, `--text-primary:#ffffff`, `--text-secondary:#888888`, add `--signal:#00ff88`, `--loss:#ff4444`, `--glow-signal:0 0 24px rgba(0,255,136,.25)`, `--glow-loss:0 0 24px rgba(255,68,68,.25)`. Do NOT remove existing vars other code depends on — add aliases.
- [ ] In `tailwind.config.js` `colors`, add `signal: 'var(--signal)'`, `loss: 'var(--loss)'`. Add boxShadow `'glow-signal'`/`'glow-loss'`.
- [ ] Confirm `font-mono` maps to JetBrains Mono (already present).
- [ ] Visual check: load `/`, confirm background is `#0a0a0a` and no regressions.
- [ ] Commit.

### Task 3: `signals` table migration + Supabase helper

**Files:**
- Create: `supabase/migrations/20260616_signals_table.sql`
- Modify: `backend/db/supabase.py` (add signal CRUD helpers)
- Test: `backend/tests/test_signals_store.py`

- [ ] Migration creates the `signals` table exactly per spec (id uuid, created_at, asset, direction, confidence int, entry_low/high, target, stop_loss numeric, explanation, pattern_type, whale_wallets text[], tx_hashes text[], status default 'pending_review', outcome_return, tweet_id, approved_at, resolved_at). Add `signal_number serial`. Add RLS: public read for status != 'pending_review'; service role full. Also create `track_record_summary` (id pk default 1) per spec if not present.
- [ ] In `supabase.py` add: `insert_signal(dict)`, `list_signals(status=None, limit=...)`, `get_signal(id)`, `update_signal(id, dict)`, `list_pending_signals()`. Use explicit column lists (project rule: no `SELECT *`).
- [ ] Test with a mocked Supabase client (follow existing test patterns in `backend/tests/`): assert insert/list/update build correct payloads and filter by status.
- [ ] Run `pytest tests/test_signals_store.py -v` → PASS. Syntax-check.
- [ ] **MANUAL ACTION (document in commit body):** run the migration in Supabase SQL editor before the engine writes signals.
- [ ] Commit.

---

## PHASE 1 — Landing Page (spec §1)

### Task 4: Landing hero + live signal ticker

**Files:**
- Modify: `frontend/src/pages/Landing.jsx`
- Reuse/Modify: components in `frontend/src/components/landing/`
- Create: `frontend/src/components/landing/SignalTicker.jsx`
- Create: `frontend/src/hooks/useRecentSignals.js`
- Test: `frontend/src/components/landing/SignalTicker.test.jsx`

- [ ] Hero headline EXACTLY: "Erase the doubt. Every call, proven on-chain." with subhead + waitlist CTA. Keep existing animated/particle background; ensure tokens.
- [ ] `useRecentSignals(limit)` fetches `GET /api/intelligence/signals` (existing) OR new `/api/signals?limit=5`; returns `{signals, loading, error}`. (Wire to `/api/signals` once Task 13 exists; until then fall back to existing signals endpoint.)
- [ ] `SignalTicker`: horizontal marquee of last 5 signals showing asset, direction arrow, outcome badge. Skeleton while loading.
- [ ] Test: given mock signals, ticker renders 5 items with correct outcome badge class (win→signal, loss→loss, pending→muted).
- [ ] Run vitest → PASS. Visual check `/`.
- [ ] Commit.

### Task 5: Landing track-record stats + How-It-Works + waitlist

**Files:**
- Modify: `frontend/src/pages/Landing.jsx`
- Create: `frontend/src/components/landing/TrackRecordStats.jsx`
- Reuse: `AnimatedCounter`, existing waitlist form → `POST /api/waitlist` (exists)
- Test: `frontend/src/components/landing/TrackRecordStats.test.jsx`

- [ ] `TrackRecordStats`: total signals, win rate, avg return — each via `AnimatedCounter` (count-up). Source from `/api/trust-pulse/marketing` (exists) or `/api/track-record` (Task 14).
- [ ] How-It-Works: 3 steps (Detect → Alert → Track) with icons; reuse existing "How It Works" section if present, restyle to tokens.
- [ ] Confirm waitlist form posts to `/api/waitlist`, shows success + error states.
- [ ] Test: stats render counters with formatted win-rate `%`.
- [ ] vitest PASS; visual check.
- [ ] Commit.

---

## PHASE 2 — Dashboard (spec §2)

### Task 6: SignalCard component

**Files:**
- Create: `frontend/src/components/signals/SignalCard.jsx`
- Create: `frontend/src/components/signals/ConfidenceDots.jsx`
- Create: `frontend/src/components/signals/OutcomeBadge.jsx`
- Test: `frontend/src/components/signals/SignalCard.test.jsx`

- [ ] `ConfidenceDots(score)`: renders 5 dots, `score` filled (`●`) rest hollow (`○`), green fill.
- [ ] `OutcomeBadge(status)`: Pending (muted), Win (signal green + glow), Loss (loss red + glow).
- [ ] `SignalCard(signal)`: asset, direction (Long/Short with arrow), ConfidenceDots, entry zone (low–high), target, stop, 2-sentence "Why" explanation, timestamp (relative), OutcomeBadge. Mono font for all numbers. Win glow / Loss glow on card border. Links to `/signal/:id`.
- [ ] Test: renders all fields; win signal has glow class; 3/5 confidence shows 3 filled + 2 hollow.
- [ ] vitest PASS.
- [ ] Commit.

### Task 7: Dashboard page (feed + top bar + history table)

**Files:**
- Create: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/App.jsx` (add `/dashboard` route behind `AuthGuard`)
- Create: `frontend/src/components/signals/SignalHistoryTable.jsx`
- Create: `frontend/src/hooks/useSignals.js`
- Test: `frontend/src/pages/Dashboard.test.jsx`

- [ ] Top bar: overall wins / losses / win rate / avg return (AnimatedCounter), from `/api/track-record`.
- [ ] Live feed: list of `SignalCard` from `useSignals()`. Subscribe to Supabase realtime on `signals` table (`@supabase/supabase-js` channel) for live insert/update; fall back to polling every 30s if realtime unavailable.
- [ ] Signal history table: every past signal, full details + outcome; sortable by date/confidence. Skeleton rows while loading.
- [ ] Add route `/dashboard` (AuthGuard). Keep existing `/intelligence` as alias or redirect — decide: redirect `/intelligence` → `/dashboard`.
- [ ] Test: feed renders N cards from mock; top bar shows computed win rate.
- [ ] vitest PASS; visual check `/dashboard` (use a test session).
- [ ] Commit.

### Task 8: Whale activity heatmap

**Files:**
- Create: `frontend/src/components/signals/WhaleHeatmap.jsx`
- Reuse: `/api/network/large-trades` (exists) or `/api/copy-trading/recent-moves`
- Test: `frontend/src/components/signals/WhaleHeatmap.test.jsx`

- [ ] 24h grid/heatmap of large wallet movements (bucket by hour × asset, color intensity = USD volume). Recharts or CSS grid.
- [ ] Test: given mock moves, renders correct number of buckets and intensity classes.
- [ ] vitest PASS; embed in Dashboard.
- [ ] Commit.

---

## PHASE 3 — Signal Detail (spec §3)

### Task 9: Signal detail page

**Files:**
- Create: `frontend/src/pages/SignalDetail.jsx`
- Modify: `frontend/src/App.jsx` (route `/signal/:id`)
- Create: `frontend/src/hooks/useSignal.js`
- Create: `backend` route `GET /api/signals/{id}` (Task 13 covers API; this consumes it)
- Test: `frontend/src/pages/SignalDetail.test.jsx`

- [ ] Full breakdown: asset/direction/confidence/entry/target/stop, full (untruncated) AI explanation.
- [ ] On-chain evidence: list whale_wallets (link to Etherscan) + tx_hashes (link to Etherscan tx).
- [ ] Price chart (Recharts) showing entry point + post-signal price path; data from `/api/market/eth` history or a new `/api/signals/{id}/price` (stub acceptable: plot entry/target/stop reference lines over available price series).
- [ ] Share button: generates the spec tweet template text and copies to clipboard / opens X intent URL.
- [ ] Test: renders wallets+hashes as Etherscan links; share button produces tweet text containing asset + entry.
- [ ] vitest PASS; visual check.
- [ ] Commit.

---

## PHASE 4 — Track Record (spec §4, credibility page)

### Task 10: Track record page

**Files:**
- Create: `frontend/src/pages/TrackRecord.jsx`
- Modify: `frontend/src/App.jsx` (route `/track-record`; redirect `/wins` → `/track-record` or keep both)
- Create: `frontend/src/components/trust/SignalFilters.jsx`
- Create: `frontend/src/lib/exportCsv.js`
- Test: `frontend/src/lib/exportCsv.test.js`, `frontend/src/pages/TrackRecord.test.jsx`

- [ ] All signals, timestamped, with outcomes. Filters: asset, confidence, time period, outcome.
- [ ] Stats: overall win rate, best signal, worst signal, avg return per confidence tier.
- [ ] Tagline EXACT: "Every signal was posted publicly before the move. Blockchain verified."
- [ ] Export to CSV button (`exportCsv(rows)` → downloads file).
- [ ] Reuse existing `DetectedWins.jsx`/trust components where useful.
- [ ] Test: `exportCsv` produces correct header + rows; filters narrow the list.
- [ ] vitest PASS; visual check.
- [ ] Commit.

---

## PHASE 5 — Learn (spec §5)

### Task 11: Learn module engine + progress persistence

**Files:**
- Create: `frontend/src/lib/learnModules.js` (content for all 6 modules, 3–5 screens each)
- Create: `frontend/src/components/learn/ModulePlayer.jsx`
- Create: `frontend/src/components/learn/ProgressBar.jsx`
- Create: `frontend/src/hooks/useLearnProgress.js`
- Modify: `supabase/migrations` — ensure `profiles.modules_completed int[]`, `unlocked_features text[]` (add migration if columns missing)
- Test: `frontend/src/hooks/useLearnProgress.test.js`, `frontend/src/components/learn/ModulePlayer.test.jsx`

- [ ] `learnModules.js`: 6 modules per spec titles, each 3–5 screens with title/body/optional real on-chain example pulled from Hadaleum data. Each module declares `unlocksFeature`.
- [ ] `ModulePlayer`: screen-by-screen, progress bar, next/prev, completion screen that calls `useLearnProgress.complete(moduleId)`.
- [ ] `useLearnProgress`: reads/writes `profiles.modules_completed` + `unlocked_features` via Supabase; optimistic update; falls back to localStorage when logged out.
- [ ] Migration for the two profile columns if not already present (verify first).
- [ ] Tests: completing module 1 marks it complete and adds its unlocked feature; progress bar reflects screen index.
- [ ] vitest PASS.
- [ ] Commit.

### Task 12: Learn page + feature-unlock gating

**Files:**
- Create: `frontend/src/pages/Learn.jsx`
- Modify: `frontend/src/App.jsx` (route `/learn`)
- Create: `frontend/src/components/learn/ModuleCard.jsx`
- Modify: dashboard/feature components to respect `unlocked_features` (light touch — gate ONE clearly-named feature, e.g. WhaleHeatmap, behind module completion)
- Test: `frontend/src/pages/Learn.test.jsx`

- [ ] Learn page: grid of 6 ModuleCards with completion state + which feature each unlocks. Robinhood-style.
- [ ] Gate the heatmap (or a named dashboard widget) behind its module; show a "Complete Module X to unlock" overlay otherwise.
- [ ] Test: completed modules show checkmark; locked feature shows unlock prompt.
- [ ] vitest PASS; visual check `/learn`.
- [ ] Commit.

---

## PHASE 6 — Signal API + Engine + Approval pipeline (spec §Signal Engine, §Twitter)

### Task 13: Signals REST API

**Files:**
- Modify: `backend/main.py` (add routes)
- Create: `backend/signals_api.py` (router/helpers) if it keeps main.py clean
- Test: `backend/tests/test_signals_api.py`

- [ ] `GET /api/signals?status=&limit=` → public, excludes `pending_review`.
- [ ] `GET /api/signals/{id}` → public single signal.
- [ ] `GET /api/track-record` → summary stats (total, wins, losses, win_rate, avg_return, best, worst, per-confidence-tier) computed from `signals` (+ reuse `track_record_summary`).
- [ ] Admin: `GET /api/admin/signals/pending`, `POST /api/admin/signals/{id}/approve`, `POST /api/admin/signals/{id}/reject`, `POST /api/admin/signals` (manual entry) — all `Depends(require_admin)`.
- [ ] Tests (FastAPI TestClient, mock supabase): pending excluded from public list; approve flips status→active + sets approved_at; reject sets status; track-record math correct.
- [ ] pytest PASS; syntax-check.
- [ ] Commit.

### Task 14: Pattern detection engine (A–D) + confidence + Claude explanation

**Files:**
- Create: `backend/signals/__init__.py`, `backend/signals/patterns.py`, `backend/signals/engine.py`
- Reuse: `backend/chains/ethereum.py` (Etherscan), `backend/ai/analyst.py` (Claude), `backend/data/wallets.py` (whale list)
- Test: `backend/tests/test_signal_patterns.py`

- [ ] `patterns.py`: pure functions `detect_stablecoin_staging`, `detect_contract_testing`, `detect_coordinated_accumulation`, `detect_quiet_whale_waking` operating on normalized tx/balance inputs; each returns `None` or a `PatternHit(pattern_type, wallets, tx_hashes, strength)`.
- [ ] `engine.py`: `confidence_from(hit, historical_accuracy) -> 1..5`; `targets_for(entry, direction) -> (target +8–15%, stop -4–6%)`; `build_signal(hit, market)` assembles a `signals` row dict with status `pending_review`; calls `ai.analyst` to generate the 2-sentence explanation (claude-sonnet-4-6); inserts via Task 3 helpers.
- [ ] TDD the pure logic: each detector with crafted fixtures (positive + negative); confidence bounds 1–5; target/stop percentages within spec ranges; explanation call is mocked.
- [ ] pytest PASS; syntax-check.
- [ ] Commit.

### Task 15: Engine scheduler + outcome tracking wiring

**Files:**
- Modify: `backend/main.py` (cron/background — follow existing `_cron_trust_pipeline` pattern)
- Create: `backend/signals/poller.py`, `backend/signals/outcomes.py`
- Test: `backend/tests/test_signal_outcomes.py`

- [ ] `poller.py`: every 5 min, pull large txs (>$500k) for tracked whales via existing Etherscan layer, run detectors, persist new `pending_review` signals (dedupe against recent). Reuse existing scheduler mechanism (don't add a new scheduler lib).
- [ ] `outcomes.py`: every 1h, for `active` signals check price (CoinGecko/existing market layer); target hit → status `win` + outcome_return; stop hit → `loss`; update `track_record_summary`. Mirror existing `score_pending_moves` logic.
- [ ] On resolution, if signal has `tweet_id`, enqueue a reply (Task 16).
- [ ] Tests: outcome resolver marks win/loss correctly given price series; track-record recompute correct.
- [ ] pytest PASS; syntax-check.
- [ ] Commit.

### Task 16: Twitter/X auto-post integration

**Files:**
- Create: `backend/integrations/twitter.py`
- Modify: `backend/requirements.txt` (`tweepy`)
- Modify: approve handler in `backend/main.py`/`signals_api.py` to call poster
- Test: `backend/tests/test_twitter.py`

- [ ] `format_signal_tweet(signal, number)` → EXACT spec template (🐋 HADALEUM SIGNAL #n, asset/direction, confidence stars, entry, target +%, stop, Why, ISO timestamp, track-record URL, hashtags).
- [ ] `post_signal(signal)` via X API v2 (tweepy Client w/ the 4 TWITTER_* env vars); returns tweet_id; store on signal.
- [ ] `reply_outcome(signal)` replies to original tweet with result when resolved.
- [ ] Approve endpoint: on approve → post tweet → save tweet_id → status `active`.
- [ ] Tests: tweet text matches template exactly (mock tweepy, assert payload); missing creds → graceful skip (log, don't crash).
- [ ] pytest PASS; syntax-check.
- [ ] **MANUAL ACTION:** set TWITTER_* env vars on Railway.
- [ ] Commit.

---

## PHASE 7 — Admin Panel (spec §6)

### Task 17: Admin approval UI

**Files:**
- Create: `frontend/src/pages/Admin.jsx`
- Modify: `frontend/src/App.jsx` (route `/admin`, password gate)
- Create: `frontend/src/components/admin/PendingSignalRow.jsx`
- Create: `frontend/src/components/admin/ManualSignalForm.jsx`
- Test: `frontend/src/pages/Admin.test.jsx`

- [ ] Password gate (compare against a value the user enters → sent as `X-Admin-Key` header; do NOT hardcode the key in the bundle — prompt for it, store in sessionStorage).
- [ ] Pending signals list with one-click Approve (→ `/api/admin/signals/{id}/approve`, auto-posts X) and Reject.
- [ ] Manual signal entry form → `POST /api/admin/signals`.
- [ ] View scheduled/posted (list signals with tweet_id) + track-record management (trigger recompute).
- [ ] Test: approve calls endpoint with admin header; manual form validates required fields.
- [ ] vitest PASS; visual check `/admin`.
- [ ] Commit.

---

## PHASE 8 — Polish & end-to-end

### Task 18: Navigation, mobile, loading-state sweep

**Files:**
- Modify: `frontend/src/components/layout/*` (nav links: Dashboard, Track Record, Learn, Admin)
- Modify: any page missing skeletons
- Test: manual + existing tests stay green

- [ ] Add nav entries; ensure mobile menu includes new pages.
- [ ] Sweep every new page: skeleton (not spinner) loading state, error state, empty state.
- [ ] Confirm all numbers use mono + count-up.
- [ ] Run full frontend `npx vitest run` + backend `pytest` → all green.
- [ ] Visual check each page at mobile width via preview MCP.
- [ ] Commit.

### Task 19: README / env / deploy notes

**Files:**
- Modify: `DEPLOY.md` and/or create `docs/hadaleum-revamp-notes.md`

- [ ] Document new env vars (TWITTER_*, any new), required Supabase migrations (Tasks 3, 11), and the manual cutover steps.
- [ ] Commit.

---

## Self-Review notes (spec coverage)

- Landing §1 → Tasks 4–5. Dashboard §2 → Tasks 6–8. Signal detail §3 → Task 9. Track record §4 → Task 10. Learn §5 → Tasks 11–12. Admin §6 → Task 17. Signal engine (patterns A–D, confidence, Claude explanation, targets, pending_review, outcome tracking) → Tasks 14–15. Twitter automation → Task 16. Schema → Tasks 3, 11. UI/UX requirements → Tasks 2, 6, 18.
- Reused (not rebuilt): waitlist API, intelligence/signals, trust/detected-moves pipeline (basis for outcome tracking), Etherscan + Claude + market layers, AnimatedCounter, AuthGuard, existing component library.
- Deviations from spec, by design: stack stays Vite/FastAPI (not Next.js) — equivalent capability, preserves the production signal backend; "Python microservice" = existing FastAPI app.
- Manual actions consolidated in Task 19.
```
