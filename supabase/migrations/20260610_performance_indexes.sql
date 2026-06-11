-- Performance indexes — add an index for every column we filter or sort by.
-- Idempotent (IF NOT EXISTS); safe to re-run in the Supabase SQL editor.
-- Tables are small, so plain CREATE INDEX (brief lock) is fine — no CONCURRENTLY needed.

-- ─── wallets ───────────────────────────────────────────────
-- Watchlist / cron / rescan all filter chain='ethereum' then ORDER BY score DESC.
-- A composite covers the filter + sort in one index (idx_wallets_score alone misses the chain filter).
create index if not exists idx_wallets_chain_score on wallets (chain, score desc);
-- /api/stats orders by last_scanned DESC limit 1.
create index if not exists idx_wallets_last_scanned on wallets (last_scanned desc);
-- (wallets.address is UNIQUE → already has an implicit index.)

-- ─── analyses ──────────────────────────────────────────────
-- Cache lookups filter wallet_address; detail view filters wallet_id + ORDER BY generated_at DESC.
-- Mirrors 20260611_analyses_wallet_address.sql so this is correct even if that one hasn't run.
create index if not exists idx_analyses_wallet_address on analyses (wallet_address);
create index if not exists idx_analyses_wallet_id_generated on analyses (wallet_id, generated_at desc);

-- ─── news ──────────────────────────────────────────────────
-- Feed sorts by published_at DESC or importance_score DESC and filters by category.
create index if not exists idx_news_published_at on news (published_at desc);
create index if not exists idx_news_importance on news (importance_score desc);
create index if not exists idx_news_category on news (category);

-- ─── profiles ──────────────────────────────────────────────
-- Stripe webhook resolves the user on every event via stripe_customer_id.
create index if not exists idx_profiles_stripe_customer on profiles (stripe_customer_id);

-- ─── transactions ──────────────────────────────────────────
-- (wallet_id, timestamp DESC) and timestamp DESC already exist from prior migrations;
-- hash is UNIQUE (implicit index). No new index needed here.
