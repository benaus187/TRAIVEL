-- User profile fields: phone number + date of birth, self-editable.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).

alter table public.users
  add column if not exists phone text,
  add column if not exists date_of_birth date;

-- No trigger needed: unlike `plan`, these columns have no self-upgrade
-- concern, so the existing "users_own" RLS policy (for all, own row only)
-- already lets a signed-in user read/write them directly via supabase-js.
