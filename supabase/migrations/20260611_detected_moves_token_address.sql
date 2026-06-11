-- Store the tracked token's ERC-20 contract address so small-cap moves can be
-- priced via CoinGecko's token_price endpoint (not just the ~30 major symbols).
-- Without this, alt-token moves stay PENDING forever and never score win/loss.
alter table detected_moves add column if not exists token_tracked_address text;

create index if not exists idx_detected_moves_status_detected
  on detected_moves (outcome_status, detected_at desc);
