-- Allow authenticated users to create their own profile row (signup fallback if trigger lags)
create policy if not exists "Users can insert own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);
