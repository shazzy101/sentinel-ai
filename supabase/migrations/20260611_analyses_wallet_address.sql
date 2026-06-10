-- Add wallet_address column to analyses table for direct wallet lookups.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/wuszhfqznudawpsjkgwv/sql

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Backfill from wallets join (run after adding column)
UPDATE analyses a
SET wallet_address = w.address
FROM wallets w
WHERE a.wallet_id = w.id
  AND a.wallet_address IS NULL;

CREATE INDEX IF NOT EXISTS idx_analyses_wallet_address
  ON analyses (wallet_address);

CREATE INDEX IF NOT EXISTS idx_analyses_wallet_id_generated
  ON analyses (wallet_id, generated_at DESC NULLS LAST);
