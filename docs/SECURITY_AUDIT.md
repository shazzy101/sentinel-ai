# Hadaleum — Security Audit (2026-06-11)

Scope: FastAPI backend, React frontend, Supabase (Auth + RLS + Edge Functions),
Stripe billing. Findings ordered by severity. ✅ = fixed in this pass.

## Critical

### C1 — Users could self-upgrade to Pro for free ✅
`profiles` RLS update policy gated by row (`auth.uid() = id`) but **not by
column**, so any signed-in user could
`supabase.from('profiles').update({ plan: 'pro' })` on their own row with the
public anon key and grant themselves Pro — full payment bypass.
**Fix:** `supabase/migrations/20260611_lock_profile_billing_columns.sql` —
column-level UPDATE grant (authenticated may only write `email`) + a
`before update` trigger that reverts `plan`/`stripe_*`/`subscription_status`/
`trial_ends_at` for any non-service-role caller. Billing columns are now
writable only by the Stripe webhook (service_role).
**Action required:** run this migration in Supabase (SQL editor / `supabase db push`).

## Medium

### M1 — Over-broad CORS preview origin ✅
`allow_origin_regex = https://.*\.pages\.dev` with `allow_credentials=True`
allowed **any** Cloudflare Pages deployment (any attacker site) to make
credentialed cross-origin requests. Auth is Bearer-token (not cookies), which
limits the blast radius, but the wildcard was still wrong.
**Fix:** scoped to `https://([a-z0-9-]+\.)?sentinel-ai\.pages\.dev`.

## Low

### L1 — Non-constant-time admin key check ✅
`require_admin` compared `X-Admin-Key` with `!=` (timing side-channel).
**Fix:** `hmac.compare_digest`.

### L2 — Hardcoded Supabase anon key fallback (frontend/src/lib/supabase.js)
The **anon** key is public by design and is now protected by hardened RLS
(C1), so this is acceptable, but prefer loading it only from
`import.meta.env` and dropping the inline fallback to avoid stale-key drift.
**Not changed** (cosmetic / no exposure).

## Verified OK (no action)

- **JWT validation** — `auth_context.resolve_user` validates Bearer tokens via
  Supabase `/auth/v1/user` (real verification, not bare decode); 5-min cache.
- **Stripe webhook** — `stripe.webhooks.constructEvent` verifies the signature
  before any DB write; uses service_role server-side only.
- **Checkout session** — verifies the caller's JWT, prices come from server-side
  env (not client-trusted), billing param constrained to monthly/annual.
- **Admin/cron routes** — all `/api/admin/*` gated by `require_admin`, which
  fails closed (503) when `ADMIN_API_KEY` is unset; expensive ops have cooldowns.
- **Rate limiting** — slowapi limits on public routes; `/api/ask` has per-user +
  global Claude budget gates.
- **RLS** — enabled on profiles/signals/copy_traders/detected_moves; profile
  rows scoped to `auth.uid()`; writes restricted to service_role.
- **Secrets** — `.env*` gitignored; no service-role key or live secret in
  frontend or git history; only the public anon key appears client-side.
- **XSS** — no `dangerouslySetInnerHTML`/`eval`; React escaping intact.
