-- SECURITY FIX: prevent users from self-upgrading to Pro.
--
-- The "Users can update own profile" RLS policy gates by ROW (auth.uid() = id)
-- but not by COLUMN, so a signed-in user could call
--   supabase.from('profiles').update({ plan: 'pro' }).eq('id', <own id>)
-- with the public anon key and grant themselves Pro for free. Billing columns
-- must only ever be written by the Stripe webhook (service_role).
--
-- Two layers:
--   1. Column-level privileges: authenticated/anon may only UPDATE `email`.
--   2. A trigger that hard-reverts any change to billing columns unless the
--      caller is the service_role (defense-in-depth if grants are reset).

-- ── Layer 1: column-level UPDATE privilege ──────────────────────────────
revoke update on table profiles from authenticated, anon;
grant update (email) on table profiles to authenticated;

-- Tighten the policy with an explicit WITH CHECK as well.
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── Layer 2: trigger guard on billing columns ───────────────────────────
create or replace function public.guard_profile_billing_columns()
returns trigger as $$
begin
  -- service_role bypasses RLS and is what the Stripe webhook uses; allow it.
  if current_setting('request.jwt.claims', true) is null
     or (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' then
    return new;
  end if;

  -- For everyone else, billing-controlled columns are immutable: snap them back
  -- to their previous values regardless of what the update tried to set.
  new.plan                 := old.plan;
  new.stripe_customer_id   := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.subscription_status  := old.subscription_status;
  new.trial_ends_at        := old.trial_ends_at;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists guard_profile_billing on profiles;
create trigger guard_profile_billing
  before update on profiles
  for each row execute function public.guard_profile_billing_columns();
