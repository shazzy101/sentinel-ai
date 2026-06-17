-- Hadaleum trade-signals table — core data model for trade signals published to Twitter.
-- Named `trade_signals` (NOT `signals`) to avoid colliding with the pre-existing
-- `signals` table from 20260610_hadaleum_schema.sql, which is a different model
-- (ETH directional accuracy: signal_type/outcome_24h/price-after) backing the old
-- /signals/performance widget. That old table is left untouched.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/wuszhfqznudawpsjkgwv/sql

create table if not exists trade_signals (
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
                     check (status in ('pending_review', 'active', 'win', 'loss', 'rejected')),
  outcome_return   numeric,
  tweet_id         text,
  approved_at      timestamptz,
  resolved_at      timestamptz
);

create index if not exists trade_signals_created_at_idx    on trade_signals (created_at desc);
create index if not exists trade_signals_status_idx        on trade_signals (status, created_at desc);
create index if not exists trade_signals_signal_number_idx on trade_signals (signal_number desc);

-- ─────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────

alter table trade_signals enable row level security;

-- Public/anon: SELECT only where status is not pending_review
drop policy if exists "Public read trade signals" on trade_signals;
create policy "Public read trade signals"
  on trade_signals for select
  to anon, authenticated
  using (status != 'pending_review');

-- Service role: full access (INSERT, UPDATE, DELETE)
drop policy if exists "Service role full access trade signals" on trade_signals;
create policy "Service role full access trade signals"
  on trade_signals for all
  to service_role
  using (true)
  with check (true);

-- If an earlier version of this table was created without 'rejected' in the
-- status check, this idempotent block updates the constraint. Safe to re-run.
alter table trade_signals
  drop constraint if exists trade_signals_status_check;

alter table trade_signals
  add constraint trade_signals_status_check
    check (status in ('pending_review', 'active', 'win', 'loss', 'rejected'));

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
