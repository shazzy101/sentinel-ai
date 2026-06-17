# Hadaleum Revamp — Deploy & Cutover Notes

Branch: `hadaleum-revamp`. Plan: [docs/superpowers/plans/2026-06-16-hadaleum-revamp.md](superpowers/plans/2026-06-16-hadaleum-revamp.md).

Transforms the existing Vite/FastAPI app into the full Hadaleum whale-signal + educational-onramp product (spec pages 1–6, signal engine A–D, outcome tracking, X auto-post). No framework migration — same stack.

## New surface

| Route | Auth | Source |
|---|---|---|
| `/` | public | revamped Landing (hero, signal ticker, track-record stats, how-it-works, waitlist) |
| `/dashboard` | authed | live signal feed, top bar, whale heatmap (gated by Learn module 1), history table |
| `/signal/:id` | public | full breakdown, on-chain evidence, price chart, share-tweet |
| `/track-record` | public | all signals + filters + per-tier stats + CSV export |
| `/learn` | public | 6 interactive modules, progress persisted, feature unlocks |
| `/admin` | password (X-Admin-Key) | pending approval → X post, reject, manual entry, posted list, pipeline recompute |

Backend signals API: `GET /api/signals`, `GET /api/signals/{id}`, `GET /api/track-record`, `GET /api/admin/signals/pending`, `POST /api/admin/signals/{id}/approve|reject`, `POST /api/admin/signals`.

Signal engine: `backend/signals/patterns.py` (A Stablecoin Staging, B Contract Testing, C Coordinated Accumulation, D Quiet Whale Waking), `engine.py` (confidence 1–5, targets +8–15%/stop −4–6%, Claude explanation), `poller.py` (5-min detect→insert, deduped), `outcomes.py` (1-hr win/loss resolve + track-record recompute). Both jobs registered as asyncio tasks in `main.py`.

## REQUIRED manual actions before this works in prod

1. **Run SQL migration** `supabase/migrations/20260616_signals_table.sql` in the Supabase SQL editor (creates `signals` + `track_record_summary`, RLS hides `pending_review` from anon). On an EXISTING DB the `create table if not exists` skips — run the appended `ALTER TABLE ... CHECK` block standalone so the `'rejected'` status is allowed.
2. **Run SQL migration** `supabase/migrations/20260616_profiles_learn_columns.sql` (adds `profiles.modules_completed int[]`, `unlocked_features text[]`, `notifications_enabled bool`). Without it the logged-in Learn-progress persist path fails (logged-out falls back to localStorage).
3. **Set Railway env vars** for X auto-post (absent = tweet calls silently no-op, app still runs):
   - `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
4. **Admin key**: `/admin` sends `X-Admin-Key`; the backend `require_admin` reads it from the same `ADMIN_API_KEY`/admin credential already configured. Confirm it's set on Railway. (Memory note: rotate `ADMIN_API_KEY` if it was ever pasted in plaintext.)
5. **Install deps:**
   - frontend: `cd frontend && npm install` (new devDeps: vitest, @testing-library/*, jsdom)
   - backend: `cd backend && pip install -r requirements.txt` (new dep: `tweepy==4.14.0`)
6. **Deploy:** Railway auto-deploys backend on push to main; Cloudflare Pages auto-deploys frontend. Merge `hadaleum-revamp` → main when migrations are run.

## Env vars (full list — most already set)
`NEXT_PUBLIC_SUPABASE_URL` (here `VITE_SUPABASE_URL`), anon key, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ETHERSCAN_API_KEY`, `MORALIS_API_KEY`, `TWITTER_*` (new), `RESEND_API_KEY`, admin key. (Spec lists Next.js/Vercel names; this app uses the Vite/Railway equivalents already configured.)

## Test status at cutover
- Frontend: 216 Vitest tests pass; `vite build` clean.
- Backend signals suite: 205 pass. Known: one cross-file test-isolation flake in `test_signal_engine.py::test_returns_string` (passes isolated; leaked mock from another test — tracked separately, not a product bug).

## Deviations from spec (by design)
- Stack stays React-Vite + FastAPI (not Next.js/Vercel) — equivalent capability, preserves the working production signal backend. "Python microservice" = the existing FastAPI app.
- Background near-black is `#050509` (existing) with `#0a0a0a` available via `--hd-bg`; signal-green `#00ff88` / loss-red `#ff4444` accent system added globally.
