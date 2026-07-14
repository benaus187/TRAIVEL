-- TRAIVEL Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  display_name text,
  created_at  timestamptz default now()
);

create table public.trips (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.users(id) on delete cascade,
  destination text not null,
  days        int not null,
  interests   text[] default '{}',
  budget      text,
  pace        text,
  avoid       text[] default '{}',
  created_at  timestamptz default now()
);

create table public.itineraries (
  id          uuid primary key default uuid_generate_v4(),
  trip_id     uuid references public.trips(id) on delete cascade,
  version     int default 1,
  all_verified boolean default false,
  share_slug  text unique,
  created_at  timestamptz default now()
);

create table public.stops (
  id                uuid primary key default uuid_generate_v4(),
  itinerary_id      uuid references public.itineraries(id) on delete cascade,
  position          int not null,
  time              text not null,
  name              text not null,
  description       text,
  reason_codes      text[] default '{}',
  place_id          text,
  verified          boolean default false,
  weather_alternate text,
  created_at        timestamptz default now()
);

create table public.place_cache (
  place_id    text primary key,
  data        jsonb not null,
  cached_at   timestamptz default now()
);

create table public.weather_cache (
  id          uuid primary key default uuid_generate_v4(),
  destination text not null,
  date        date not null,
  data        jsonb not null,
  cached_at   timestamptz default now(),
  unique (destination, date)
);

create table public.trend_cache (
  destination text primary key,
  data        jsonb not null,
  cached_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

alter table public.users         enable row level security;
alter table public.trips         enable row level security;
alter table public.itineraries   enable row level security;
alter table public.stops         enable row level security;
alter table public.place_cache   enable row level security;
alter table public.weather_cache enable row level security;
alter table public.trend_cache   enable row level security;

-- users: own row only
create policy "users_own" on public.users
  for all using (auth.uid() = id);

-- trips: own rows only
create policy "trips_own" on public.trips
  for all using (auth.uid() = user_id);

-- itineraries: own via trip, or public share
create policy "itineraries_own" on public.itineraries
  for all using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

create policy "itineraries_public_read" on public.itineraries
  for select using (share_slug is not null);

-- stops: own via itinerary, or public share
create policy "stops_own" on public.stops
  for all using (
    exists (
      select 1 from public.itineraries i
      join public.trips t on t.id = i.trip_id
      where i.id = itinerary_id and t.user_id = auth.uid()
    )
  );

create policy "stops_public_read" on public.stops
  for select using (
    exists (
      select 1 from public.itineraries i
      where i.id = itinerary_id and i.share_slug is not null
    )
  );

-- caches: service role writes, authenticated reads
create policy "place_cache_read"   on public.place_cache   for select using (auth.role() = 'authenticated');
create policy "weather_cache_read" on public.weather_cache for select using (auth.role() = 'authenticated');
create policy "trend_cache_read"   on public.trend_cache   for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ─────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
