-- On-chain copy moves Hadaleum detects + scored 24h outcomes (public trust ledger).

create table if not exists detected_moves (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  detected_at timestamptz not null,
  tx_hash text not null unique,
  trader_address text not null,
  trader_label text,
  trader_rank int,
  copy_score numeric,
  win_rate_pct numeric,
  profit_factor numeric,
  action text not null,
  token_bought text,
  token_sold text,
  sold_amount numeric,
  bought_amount numeric,
  amount_usd numeric,
  outcome_status text not null default 'PENDING',
  outcome_scored_at timestamptz,
  token_tracked text,
  price_at_detection numeric,
  price_24h_after numeric,
  return_pct_24h numeric,
  hypothetical_pnl_usd numeric,
  notional_usd numeric not null default 1000,
  source text not null default 'copy_trader_scan'
);

create index if not exists detected_moves_detected_at_idx on detected_moves (detected_at desc);
create index if not exists detected_moves_outcome_idx on detected_moves (outcome_status, detected_at desc);

alter table detected_moves enable row level security;

drop policy if exists "Public read detected moves" on detected_moves;
create policy "Public read detected moves"
  on detected_moves for select
  to anon, authenticated
  using (true);
