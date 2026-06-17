-- Add learn-progress columns to profiles.
-- Safe to run multiple times (IF NOT EXISTS guards).
-- Manual action: run this in the Supabase SQL editor or via `supabase db push`.

alter table profiles
  add column if not exists modules_completed int[] default '{}';

alter table profiles
  add column if not exists unlocked_features text[] default '{}';

alter table profiles
  add column if not exists notifications_enabled bool default true;
