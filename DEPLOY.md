# Sentinel AI — Deployment Guide

## Architecture
- **Backend:** FastAPI → Railway (free tier)
- **Frontend:** React/Vite → Cloudflare Pages (free tier, unlimited CDN)
- **Database:** Supabase (existing, free tier)

Total cost: **$0/month** on free tiers.

---

## Step 1 — Push to GitHub

```bash
cd /Users/shazaibamlani/Sentinel
git remote add origin https://github.com/YOUR_USERNAME/sentinel-ai.git
git push -u origin main
```

---

## Step 2 — Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select the `sentinel-ai` repository
3. Set the **Root Directory** to `backend`
4. Railway auto-detects the `Procfile` and runs:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. Add these **Environment Variables** in Railway dashboard:
   ```
   SUPABASE_URL=https://wuszhfqznudawpsjkgwv.supabase.co
   SUPABASE_KEY=<your_service_role_key>
   ANTHROPIC_API_KEY=<your_anthropic_key>
   ETHERSCAN_API_KEY=<your_etherscan_key>
   CORS_ORIGINS=https://sentinel-ai.pages.dev,https://sentinel.yourdomain.com
   ```
6. After deploy, note your Railway URL e.g. `https://sentinel-backend-production.up.railway.app`

---

## Step 3 — Deploy Frontend to Cloudflare Pages

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) → **Create a project** → **Connect to Git**
2. Select your `sentinel-ai` repo
3. Set:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add **Environment Variable:**
   ```
   VITE_API_URL=https://sentinel-backend-production.up.railway.app
   ```
5. Click **Save and Deploy**

The `_redirects` file ensures React Router works correctly (all routes → `index.html`).

---

## Step 4 — Custom Domain (optional)

In Cloudflare Pages dashboard → **Custom domains** → add `sentinel.yourdomain.com`

Then update Railway's `CORS_ORIGINS` to include your custom domain.

---

## Step 5 — Verify

```bash
curl https://sentinel-backend-production.up.railway.app/health
```

Should return `{"success": true, "data": {"status": "healthy", ...}}`

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase **service_role** key |
| `ANTHROPIC_API_KEY` | ✅ | Claude AI API key |
| `ETHERSCAN_API_KEY` | ✅ | Etherscan v2 API key |
| `CORS_ORIGINS` | ✅ prod | Comma-separated list of allowed frontend origins |
| `PORT` | Auto | Set by Railway automatically |

---

## Local Development

```bash
# Backend
cd backend
source ../venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (new terminal)
cd frontend
npm run dev
```

Frontend at http://localhost:5173 — proxied to backend via Vite config.
