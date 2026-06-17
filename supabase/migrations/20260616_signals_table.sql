-- Hadaleum signals table — core data model for trade signals published to Twitter.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/wuszhfqznudawpsjkgwv/sql

create table if not exists signals (
  id               uuid primary key default gen_random_uuid(),
  signal_number    bigserial not null,
  created_at       timestamptz not null default now(),
  asset            text not null,
  direction        text not null check (direction in ('long', 'short')),
  confidence       int not null check (confidence between 1 and 5),
  entry_low        numeric,
  entry_high       numeric,
  target           numeric,
  stop_loss        numeric,
  explanation      text,
  pattern_type     text,
  whale_wallets    text[],
  tx_hashes        text[],
  status           text not null default 'pending_review'
                     check (status in ('pending_review', 'active', 'win', 'loss')),
  outcome_return   numeric,
  tweet_id         text,
  approved_at      timestamptz,
  resolved_at      timestamptz
);

create index if not exists signals_created_at_idx    on signals (created_at desc);
create index if not exists signals_status_idx        on signals (status, created_at desc);
create index if not exists signals_signal_number_idx on signals (signal_number desc);

-- ─────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────

alter table signals enable row level security;

-- Public/anon: SELECT only where status is not pending_review
drop policy if exists "Public read signals" on signals;
create policy "Public read signals"
  on signals for select
  to anon, authenticated
  using (status != 'pending_review');

-- Service role: full access (INSERT, UPDATE, DELETE)
drop policy if exists "Service role full access signals" on signals;
create policy "Service role full access signals"
  on signals for all
  to service_role
  using (true)
  with check (true);

-- ─────────────────────────────────────────
-- Track Record Summary (aggregate cache)
-- ─────────────────────────────────────────

create table if not exists track_record_summary (
  id                   int primary key default 1,
  total_signals        int not null default 0,
  wins                 int not null default 0,
  losses               int not null default 0,
  win_rate             numeric not null default 0,
  avg_return           numeric not null default 0,
  best_signal_return   numeric not null default 0,
  updated_at           timestamptz not null default now()
);

-- Seed the single summary row if it does not yet exist
insert into track_record_summary (id)
values (1)
on conflict (id) do nothing;

alter table track_record_summary enable row level security;

drop policy if exists "Public read track record" on track_record_summary;
create policy "Public read track record"
  on track_record_summary for select
  to anon, authenticated
  using (true);

drop policy if exists "Service role full access track record" on track_record_summary;
create policy "Service role full access track record"
  on track_record_summary for all
  to service_role
  using (true)
  with check (true);
