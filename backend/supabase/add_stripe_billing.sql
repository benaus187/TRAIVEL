-- Stripe billing: subscription linkage on users.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).

alter table public.users
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text; -- e.g. 'active', 'canceled', 'past_due', null

create unique index if not exists users_stripe_customer_id_idx
  on public.users (stripe_customer_id) where stripe_customer_id is not null;

-- No changes needed to users_prevent_plan_self_upgrade — it only guards the
-- `plan` column. Webhook-driven writes to plan/stripe_* columns must go
-- through the backend's service-role client (get_db()), same as every other
-- write to users.plan — that trigger only allows changes when auth.role()
-- is NULL (SQL editor) or 'service_role', not 'authenticated'.
