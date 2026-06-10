-- Prevent authenticated users from self-upgrading plan / Stripe fields via RLS update.

create or replace function public.protect_profile_billing_fields()
returns trigger as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    new.plan := old.plan;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_profile_billing on profiles;
create trigger protect_profile_billing
  before update on profiles
  for each row execute procedure public.protect_profile_billing_fields();
