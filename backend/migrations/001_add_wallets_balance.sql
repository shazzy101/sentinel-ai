-- Add balance column to wallets (ETH held at last scan)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
COMMENT ON COLUMN wallets.balance IS 'ETH balance at last scan';
