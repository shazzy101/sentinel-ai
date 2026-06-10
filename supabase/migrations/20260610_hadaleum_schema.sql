-- Hadaleum schema migration
-- Run this in your Supabase SQL editor

-- ─── Profiles table ─────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade,
  email text,
  plan text default 'free',              -- 'free' | 'pro'
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,               -- 'active' | 'canceled' | 'trialing'
  trial_ends_at timestamptz,
  created_at timestamptz default now(),
  primary key (id)
);

-- RLS: users can only read/update their own profile
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, trial_ends_at)
  values (
    new.id,
    new.email,
    now() + interval '7 days'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Signals table ───────────────────────────────────
create table if not exists signals (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  signal_type text not null,             -- 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  reasoning text,
  eth_price_at_signal numeric,
  eth_price_24h_after numeric,
  eth_price_48h_after numeric,
  eth_price_7d_after numeric,
  outcome_24h text default 'PENDING',    -- 'CORRECT' | 'INCORRECT' | 'NEUTRAL' | 'PENDING'
  outcome_48h text default 'PENDING',
  outcome_7d text default 'PENDING',
  whale_trigger_address text
);

-- Public read access so landing page accuracy widget works without auth
alter table signals enable row level security;

create policy "Public can read signals"
  on signals for select
  to anon, authenticated
  using (true);

create policy "Service role can insert signals"
  on signals for insert
  to service_role
  with check (true);

create policy "Service role can update signals"
  on signals for update
  to service_role
  using (true);

-- Index for the accuracy widget query
create index if not exists signals_created_at_idx on signals (created_at desc);
create index if not exists signals_outcome_idx on signals (outcome_24h, outcome_7d);
