-- Reservation widget setup for your existing Supabase schema.
-- The app reads public settings directly from public.restaurants using the
-- Supabase anon key and these columns:
--
--   id, slug, name, logo_url, primary_color, background_color, text_color,
--   font_family, language, booking_widget_enabled, privacy_policy_url,
--   privacy_policy_version, min_party_size
--
-- Make sure each embeddable restaurant row has:
--   active = true
--   booking_widget_enabled = true
--   slug = the URL slug, for example 'starwok'

alter table public.restaurants enable row level security;

alter table public.restaurants
add column if not exists min_party_size integer not null default 1;

drop policy if exists "Public can read active widget restaurants" on public.restaurants;
create policy "Public can read active widget restaurants"
on public.restaurants
for select
to anon
using (
  active = true
  and booking_widget_enabled = true
  and slug is not null
);

create table if not exists public.restaurant_opening_hours (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  -- 0 = Sunday, 1 = Monday, ... 6 = Saturday, matching JavaScript getDay().
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  last_reservation_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at),
  check (
    last_reservation_time is null
    or (last_reservation_time >= opens_at and last_reservation_time <= closes_at)
  )
);

create index if not exists restaurant_opening_hours_restaurant_day_idx
on public.restaurant_opening_hours (restaurant_id, day_of_week, opens_at);

alter table public.restaurant_opening_hours enable row level security;

drop policy if exists "Public can read active widget opening hours"
on public.restaurant_opening_hours;
create policy "Public can read active widget opening hours"
on public.restaurant_opening_hours
for select
to anon
using (
  exists (
    select 1
    from public.restaurants
    where restaurants.id = restaurant_opening_hours.restaurant_id
      and restaurants.active = true
      and restaurants.booking_widget_enabled = true
      and restaurants.slug is not null
  )
);

-- Some existing projects use public.opening_hours for the same widget data.
-- Keep the policy in sync so the app can read either table name.
do $$
begin
  if to_regclass('public.opening_hours') is not null then
    alter table public.opening_hours enable row level security;

    drop policy if exists "Public can read active widget opening hours"
    on public.opening_hours;

    create policy "Public can read active widget opening hours"
    on public.opening_hours
    for select
    to anon
    using (
      exists (
        select 1
        from public.restaurants
        where restaurants.id = opening_hours.restaurant_id
          and restaurants.active = true
          and restaurants.booking_widget_enabled = true
          and restaurants.slug is not null
      )
    );
  end if;
end $$;

-- Booking inserts should still be done by n8n/server-side code, not by the
-- public widget anon key.
