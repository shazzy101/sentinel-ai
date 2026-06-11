# Hadaleum — Deployment Guide

## Architecture
- **Backend:** FastAPI → Railway (live at `https://backend-production-250bf.up.railway.app`)
- **Frontend:** React/Vite → Cloudflare Pages (live at `https://sentinel-ai.pages.dev` → custom: `hadaleum.com`)
- **Database:** Supabase project `wuszhfqznudawpsjkgwv`

---

## Automatic Deployments

Both services auto-deploy when you push to `main` on GitHub:

```bash
git push origin main
```

- **Cloudflare Pages** → watches `frontend/` directory → builds `npm run build` → serves `dist/`
- **Railway** → watches `backend/` directory → restarts `uvicorn main:app`

---

## Environment Variables

### Railway (Backend)
Set in Railway dashboard → Project → Variables:
```
SUPABASE_URL=https://wuszhfqznudawpsjkgwv.supabase.co
SUPABASE_KEY=<service_role_key_from_backend/.env>
ANTHROPIC_API_KEY=<from_backend/.env>
ETHERSCAN_API_KEY=<from_backend/.env>
DUNE_API_KEY=<from_backend/.env>
CORS_ORIGINS=https://sentinel-ai.pages.dev,https://hadaleum.com,https://www.hadaleum.com
ADMIN_API_KEY=<random_32_char_secret>
CLAUDE_MAX_CALLS_PER_HOUR=80          # global shared AI budget
FREE_ASK_CALLS_PER_HOUR=10            # per free user
PRO_ASK_CALLS_PER_HOUR=60             # per pro / trial user
ANON_ASK_CALLS_PER_HOUR=5             # unauthenticated IP fallback
FREE_TOKENS_PER_HOUR=25000
PRO_TOKENS_PER_HOUR=150000
LOG_LEVEL=INFO
LOG_FORMAT=json                       # json in production, text locally
ENVIRONMENT=production
SENTRY_DSN=<optional>
```

### Cloudflare Pages (Frontend)
Set in Cloudflare Pages → Project → Settings → Environment Variables:
```
VITE_API_URL=https://backend-production-250bf.up.railway.app
VITE_SUPABASE_URL=https://wuszhfqznudawpsjkgwv.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key_from_supabase_dashboard_settings_api>
VITE_STRIPE_PUBLISHABLE_KEY=<pk_live_... from Stripe dashboard>
```

---

## Supabase Setup (one-time)

### 1. Run the migration SQL
Go to [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard/project/wuszhfqznudawpsjkgwv/sql) and run, in order:

1. `supabase/migrations/20260610_hadaleum_schema.sql`
2. `supabase/migrations/20260610_profiles_insert_policy.sql`
3. `supabase/migrations/20260610_profiles_billing_protect.sql`
4. `supabase/migrations/20260611_copy_traders.sql`
5. Other migrations in `supabase/migrations/` as needed

### Supabase Auth redirect URLs
Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://hadaleum.com`
- **Redirect URLs:** `https://hadaleum.com/auth/callback`, `https://hadaleum.com/reset-password`, `http://localhost:5173/auth/callback`, `http://localhost:5173/reset-password`

### 2. Deploy Edge Functions
```bash
# Install Supabase CLI first: brew install supabase/tap/supabase
supabase login
supabase link --project-ref wuszhfqznudawpsjkgwv
supabase functions deploy log-signal
supabase functions deploy score-signals
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

### 3. Set Edge Function Secrets
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_ANNUAL=price_...
supabase secrets set APP_URL=https://hadaleum.com
supabase secrets set INTERNAL_API_SECRET=<random_32_char_secret>
```

### 4. Get your Anon Key
Supabase Dashboard → Project Settings → API → `anon` `public` key → copy it into Cloudflare env vars above.

---

## Custom Domain (hadaleum.com)

1. In Cloudflare Pages → Project → Custom domains → Add `hadaleum.com`
2. Cloudflare auto-provisions SSL and updates DNS (since domain is on Cloudflare)
3. Update Railway `CORS_ORIGINS` to include `https://hadaleum.com`

---

## Stripe Setup (one-time)

Products and prices are **already created** on the live Stripe account (`acct_1TggstJ99lPC7hJA`):

| Item | ID |
|---|---|
| Product | `prod_Ug3DQVaNpdsoRs` |
| Monthly price ($19/mo) | `price_1Tgh7TJ99lPC7hJArhlkMRUt` |
| Annual price ($190/yr) | `price_1Tgh7TJ99lPC7hJAKI7D5KIg` |

These IDs are hardcoded in `create-checkout-session/index.ts` as defaults.

### Remaining manual steps:

1. **Enable card payments** — [Stripe → Payment Methods](https://dashboard.stripe.com/settings/payment_methods) → turn on "Card"

2. **Add webhook endpoint** — [Stripe → Webhooks → Add endpoint](https://dashboard.stripe.com/webhooks/create)
   - URL: `https://wuszhfqznudawpsjkgwv.supabase.co/functions/v1/stripe-webhook`
   - Events: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`
   - Copy the **signing secret** (`whsec_...`) → set as Supabase secret:
     ```bash
     supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
     ```

3. **Get your secret key** — [Stripe → API Keys](https://dashboard.stripe.com/apikeys) → copy `sk_live_...`
   - Set as Supabase secret: `supabase secrets set STRIPE_SECRET_KEY=sk_live_...`
   - Set as Railway env var for CORS reference

4. **Get your publishable key** — copy `pk_live_...` from same page
   - Add to Cloudflare Pages env vars: `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...`

---

## Health Check

```bash
curl https://backend-production-250bf.up.railway.app/health
# → {"success":true,"data":{"status":"healthy",...}}
```

## Trust Pulse (detected wins ledger)

Public flex page: **https://hadaleum.com/wins**

```bash
# Public stats + marketing copy
curl https://backend-production-250bf.up.railway.app/api/trust-pulse/marketing

# Manual ingest + score (requires X-Admin-Key matching Railway ADMIN_API_KEY)
curl -X POST https://backend-production-250bf.up.railway.app/api/admin/run-trust-pipeline \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY"

# Or run locally against production Supabase (uses backend/.env)
cd backend && python scripts/run_trust_pipeline.py
```

Cron ingests copy-trader swaps every 30 minutes; wins score 24h after detection.

---

## Local Development

```bash
# Backend
cd backend && source ../venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (new terminal)
cd frontend && npm run dev
# → http://localhost:5173
```
