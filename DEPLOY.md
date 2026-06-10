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
Go to [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard/project/wuszhfqznudawpsjkgwv/sql) and paste `supabase/migrations/20260610_hadaleum_schema.sql`.

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
supabase secrets set STRIPE_PRO_MONTHLY_PRICE_ID=price_...
supabase secrets set STRIPE_PRO_ANNUAL_PRICE_ID=price_...
supabase secrets set SITE_URL=https://hadaleum.com
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
