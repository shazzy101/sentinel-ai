-- APEX waitlist — top-of-funnel email capture for the paid track-record product.
-- Run in Supabase SQL Editor.

create table if not exists trading_waitlist (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null unique,
  source      text default 'track_record'
);

create index if not exists trading_waitlist_created_at_idx on trading_waitlist (created_at desc);

alter table trading_waitlist enable row level security;

-- anon can INSERT (join) but not read the list; service role full access.
drop policy if exists "Public join waitlist" on trading_waitlist;
create policy "Public join waitlist"
  on trading_waitlist for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Service role full access trading_waitlist" on trading_waitlist;
create policy "Service role full access trading_waitlist"
  on trading_waitlist for all
  to service_role using (true) with check (true);
