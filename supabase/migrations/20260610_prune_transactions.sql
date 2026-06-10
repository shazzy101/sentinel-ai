-- Prune bloated transaction history and drop unused raw_data column.
-- Run once in Supabase SQL editor if MCP migration wasn't applied.

ALTER TABLE transactions DROP COLUMN IF EXISTS raw_data;

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_ts
  ON transactions (wallet_id, timestamp DESC NULLS LAST);

CREATE OR REPLACE FUNCTION prune_wallet_transactions(keep_count int DEFAULT 120)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted bigint;
BEGIN
  DELETE FROM transactions t
  USING (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY wallet_id
             ORDER BY timestamp DESC NULLS LAST, created_at DESC
           ) AS rn
    FROM transactions
  ) ranked
  WHERE t.id = ranked.id AND ranked.rn > keep_count;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- One-time cleanup (already run on 2026-06-10; safe to re-run):
-- SELECT prune_wallet_transactions(120);
-- VACUUM FULL ANALYZE transactions;
