-- APEX paper-trading module schema.
-- Six new tables, isolated from existing Hadaleum tables (signals/trade_signals/etc).
-- Public read is exposed ONLY on trading_signals (the public track record); everything
-- else is service-role only. Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wuszhfqznudawpsjkgwv/sql

-- ─────────────────────────────────────────
-- trading_signals  (public track record)
-- ─────────────────────────────────────────
create table if not exists trading_signals (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  asset             text not null,
  timeframe         text not null default '5m',
  direction         text not null check (direction in ('LONG', 'SHORT')),
  price             numeric not null,
  sl                numeric not null,
  tp                numeric not null,
  confidence        numeric not null,            -- 0..1 avg conf of agreeing strategies
  confluence_score  numeric not null,
  votes             int not null,
  is_high_conviction boolean not null default false,
  strategies        text[] not null default '{}',
  rsi               numeric,
  vwap              numeric,
  atr               numeric,
  status            text not null default 'PENDING'
                      check (status in ('PENDING', 'WIN', 'LOSS', 'EXPIRED')),
  exit_price        numeric,
  pnl_pct           numeric,
  exit_reason       text,
  bars_held         int,
  is_paper          boolean not null default true,
  tweet_id          text,
  on_chain_hash     text,
  resolved_at       timestamptz
);

create index if not exists trading_signals_asset_idx      on trading_signals (asset);
create index if not exists trading_signals_status_idx     on trading_signals (status);
create index if not exists trading_signals_created_at_idx on trading_signals (created_at desc);

-- ─────────────────────────────────────────
-- paper_positions
-- ─────────────────────────────────────────
create table if not exists paper_positions (
  id            uuid primary key default gen_random_uuid(),
  signal_id     uuid references trading_signals (id) on delete cascade,
  asset         text not null,
  direction     text not null check (direction in ('LONG', 'SHORT')),
  entry_price   numeric not null,
  sl            numeric not null,
  tp            numeric not null,
  size          numeric not null,
  risk_pct      numeric not null,
  opened_at     timestamptz not null default now(),
  status        text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  exit_price    numeric,
  exit_at       timestamptz,
  pnl           numeric,
  pnl_pct       numeric,
  exit_reason   text
);

create index if not exists paper_positions_status_idx on paper_positions (status);

-- ─────────────────────────────────────────
-- paper_equity_snapshots
-- ─────────────────────────────────────────
create table if not exists paper_equity_snapshots (
  id          uuid primary key default gen_random_uuid(),
  taken_at    timestamptz not null default now(),
  equity      numeric not null,
  drawdown    numeric not null default 0,
  open_positions int not null default 0
);

create index if not exists paper_equity_snapshots_taken_at_idx on paper_equity_snapshots (taken_at desc);

-- ─────────────────────────────────────────
-- strategy_performance  (rolling per-strategy cache)
-- ─────────────────────────────────────────
create table if not exists strategy_performance (
  id            uuid primary key default gen_random_uuid(),
  strategy      text not null,
  window_label  text not null default 'all' check (window_label in ('7d', '30d', 'all')),
  signals       int not null default 0,
  wins          int not null default 0,
  losses        int not null default 0,
  win_rate      numeric not null default 0,
  avg_pnl_pct   numeric not null default 0,
  avg_rr        numeric not null default 0,
  best_asset    text,
  updated_at    timestamptz not null default now(),
  unique (strategy, window_label)
);

-- ─────────────────────────────────────────
-- price_cache
-- ─────────────────────────────────────────
create table if not exists price_cache (
  id          bigserial primary key,
  asset       text not null,
  timeframe   text not null,
  ts          bigint not null,           -- bar epoch ms
  open        numeric not null,
  high        numeric not null,
  low         numeric not null,
  close       numeric not null,
  volume      numeric not null,
  fetched_at  timestamptz not null default now(),
  unique (asset, timeframe, ts)
);

create index if not exists price_cache_lookup_idx on price_cache (asset, timeframe, ts desc);

-- ─────────────────────────────────────────
-- trading_logs
-- ─────────────────────────────────────────
create table if not exists trading_logs (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  level       text not null default 'info' check (level in ('info', 'warn', 'error')),
  source      text not null,             -- 'signal_cron' | 'monitor_cron' | 'api' ...
  message     text not null,
  meta        jsonb
);

create index if not exists trading_logs_created_at_idx on trading_logs (created_at desc);

-- ─────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────
alter table trading_signals        enable row level security;
alter table paper_positions        enable row level security;
alter table paper_equity_snapshots enable row level security;
alter table strategy_performance   enable row level security;
alter table price_cache            enable row level security;
alter table trading_logs           enable row level security;

-- Public read ONLY on trading_signals, and only for resolved/active rows.
drop policy if exists "Public read trading signals" on trading_signals;
create policy "Public read trading signals"
  on trading_signals for select
  to anon, authenticated
  using (status != 'PENDING');

-- Service role: full access on every table.
do $$
declare t text;
begin
  foreach t in array array[
    'trading_signals', 'paper_positions', 'paper_equity_snapshots',
    'strategy_performance', 'price_cache', 'trading_logs'
  ]
  loop
    execute format('drop policy if exists "Service role full access %1$s" on %1$s;', t);
    execute format(
      'create policy "Service role full access %1$s" on %1$s for all to service_role using (true) with check (true);',
      t
    );
  end loop;
end $$;
