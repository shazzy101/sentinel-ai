-- Optional cached signal columns on wallets (AI analysis also lives in analyses table).
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS signal TEXT DEFAULT 'NEUTRAL';
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS signal_reason TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}'::jsonb;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS last_scanned TIMESTAMPTZ;
