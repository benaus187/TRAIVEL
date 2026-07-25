-- Usage-quota system: plan tier on users + per-identity daily generation counter.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- ── users.plan ──────────────────────────────────────────────
alter table public.users
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'premium'));

-- Prevent a signed-in user from self-upgrading via the anon/authenticated
-- PostgREST role (the existing "users_own" RLS policy is `for all`, which
-- covers UPDATE with no column-level restriction). Dashboard/SQL-editor
-- edits and the backend's service-role client are unaffected — auth.role()
-- is NULL or 'service_role' respectively in those contexts.
create or replace function public.prevent_plan_self_upgrade()
returns trigger language plpgsql as $$
begin
  if new.plan is distinct from old.plan and auth.role() = 'authenticated' then
    new.plan := old.plan;
  end if;
  return new;
end;
$$;

drop trigger if exists users_prevent_plan_self_upgrade on public.users;
create trigger users_prevent_plan_self_upgrade
  before update on public.users
  for each row execute procedure public.prevent_plan_self_upgrade();

-- ── generation_usage ────────────────────────────────────────
create table if not exists public.generation_usage (
  identity_key text not null,
  usage_date   date not null,
  count        int  not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (identity_key, usage_date)
);

alter table public.generation_usage enable row level security;
-- No policies added: RLS default-denies to anon/authenticated. Only the
-- backend's service-role client and the SECURITY DEFINER RPC below touch it.

-- ── atomic increment RPC ────────────────────────────────────
create or replace function public.increment_generation_usage(
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
  insert into public.generation_usage (identity_key, usage_date, count, updated_at)
  values (p_identity_key, p_usage_date, 1, now())
  on conflict (identity_key, usage_date)
  do update set count = public.generation_usage.count + 1, updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

-- Lock the RPC down to the backend's service-role key only — otherwise any
-- client holding the public anon/authenticated key could call this directly
-- over PostgREST and spam-increment an arbitrary identity_key (e.g. spoof
-- another user's `user:<uuid>` key to grief their quota).
revoke all on function public.increment_generation_usage(text, date) from public;
revoke all on function public.increment_generation_usage(text, date) from anon;
revoke all on function public.increment_generation_usage(text, date) from authenticated;
grant execute on function public.increment_generation_usage(text, date) to service_role;
