-- Ranked copy-trading wallets — single source of truth for DEX trader leaderboard
-- Populated by backend/scripts/sync_copy_traders_to_db.py (from ranker or Dune JSON)

create table if not exists copy_traders (
  id uuid default gen_random_uuid() primary key,
  address text not null unique,
  rank int not null,
  label text,
  chain text not null default 'ethereum',
  tags text[] default '{}',
  copy_trading_score numeric not null default 0,
  wallet_type text default 'DEX Trader',
  source text default 'ranker',
  metrics jsonb not null default '{}',
  on_chain_data jsonb default '{}',
  pnl_sparkline jsonb,
  estimated_return_pct numeric,
  metrics_meta jsonb default '{}',
  refreshed_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists copy_traders_rank_idx on copy_traders (rank asc);
create index if not exists copy_traders_score_idx on copy_traders (copy_trading_score desc);
create index if not exists copy_traders_refreshed_idx on copy_traders (refreshed_at desc);

alter table copy_traders enable row level security;

create policy "Public can read copy traders"
  on copy_traders for select
  to anon, authenticated
  using (true);

create policy "Service role can manage copy traders"
  on copy_traders for all
  to service_role
  using (true)
  with check (true);
