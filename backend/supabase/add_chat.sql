-- Chat-based itinerary editing (Premium feature): conversation history +
-- daily rate limit, plus exposing trips.user_id publicly so the share page
-- can tell an owner apart from a visitor.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- ── chat_messages ───────────────────────────────────────────
create table if not exists public.chat_messages (
  id            uuid primary key default uuid_generate_v4(),
  itinerary_id  uuid not null references public.itineraries(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  operations    jsonb,
  created_at    timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_own" on public.chat_messages;
create policy "chat_messages_own" on public.chat_messages
  for all using (auth.uid() = user_id);

-- ── shared_trip_info: expose destination/days/user_id on public share links ──
-- Needed so the owner-only chat panel on the share page can tell an owner
-- apart from an anonymous/other visitor (compares auth.uid() to user_id
-- client-side).
--
-- NOT a row-level-security policy on `trips` itself — RLS is row-scoped only,
-- so a bare "select" policy here would leak every column (budget, interests,
-- avoid, pace) for EVERY trip that has ever been shared, and would let
-- anyone holding the public anon key bulk-enumerate all shared trips via
-- `select=*`, not just the one trip a caller already knows the share_slug
-- for. A view (owned by the migration-running role, which bypasses RLS on
-- the underlying table by default) scoped to exactly the 3 safe columns
-- avoids both problems.
drop view if exists public.shared_trip_info;
create view public.shared_trip_info as
select t.id, t.user_id, t.destination, t.days
from public.trips t
join public.itineraries i on i.trip_id = t.id
where i.share_slug is not null;

grant select on public.shared_trip_info to anon, authenticated;

-- ── chat_usage: daily rate limit for premium chat, mirrors generation_usage ──
create table if not exists public.chat_usage (
  identity_key text not null,
  usage_date   date not null,
  count        int  not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (identity_key, usage_date)
);

alter table public.chat_usage enable row level security;
-- No policies added: RLS default-denies to anon/authenticated. Only the
-- backend's service-role client and the SECURITY DEFINER RPC below touch it.

create or replace function public.increment_chat_usage(
  p_identity_key text,
  p_usage_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.chat_usage (identity_key, usage_date, count, updated_at)
  values (p_identity_key, p_usage_date, 1, now())
  on conflict (identity_key, usage_date)
  do update set count = public.chat_usage.count + 1, updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.increment_chat_usage(text, date) from public;
revoke all on function public.increment_chat_usage(text, date) from anon;
revoke all on function public.increment_chat_usage(text, date) from authenticated;
grant execute on function public.increment_chat_usage(text, date) to service_role;
