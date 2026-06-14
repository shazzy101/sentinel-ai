-- Shorten the default free trial from 7 days to 3 days.
-- handle_new_user is the source of truth for ALL signups (incl. Google OAuth,
-- which never hits the signup form), so update it here.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, trial_ends_at)
  values (
    new.id,
    new.email,
    now() + interval '3 days'
  );
  return new;
end;
$$ language plpgsql security definer;
