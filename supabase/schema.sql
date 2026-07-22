-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.capacity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  dow_id integer NOT NULL CHECK (dow_id >= 0 AND dow_id <= 6),
  day_of_week text NOT NULL,
  meal_period text NOT NULL CHECK (meal_period = ANY (ARRAY['Lunch'::text, 'Dinner'::text])),
  hour time without time zone,
  max_seats integer NOT NULL CHECK (max_seats >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  agent_id text,
  CONSTRAINT capacity_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bookings (
  reservation_id text NOT NULL,
  restaurant_id text NOT NULL,
  date date NOT NULL,
  time time without time zone NOT NULL,
  meal_period text NOT NULL CHECK (meal_period = ANY (ARRAY['Lunch'::text, 'Dinner'::text])),
  name text NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status text NOT NULL DEFAULT 'CONFIRMED'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'CANCELLED'::text, 'MODIFIED'::text, 'NO_SHOW'::text, 'REJECTED'::text])),
  phone_number text,
  marketing_consent boolean,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text,
  marketing_consent_at timestamp with time zone,
  booking_source text,
  privacy_policy_accepted boolean DEFAULT false,
  privacy_policy_accepted_at timestamp with time zone,
  privacy_policy_version text,
  confirmation_token text,
  CONSTRAINT bookings_pkey PRIMARY KEY (reservation_id)
);
CREATE TABLE public.restaurants (
  id text NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  agent_id text UNIQUE,
  calendar_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  language text,
  slug text UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#111111'::text,
  background_color text DEFAULT '#ffffff'::text,
  text_color text DEFAULT '#111111'::text,
  font_family text DEFAULT 'Inter'::text,
  booking_widget_enabled boolean DEFAULT false,
  privacy_policy_url text,
  privacy_policy_version text DEFAULT 'v1'::text,
  min_party_size integer NOT NULL DEFAULT 1,
  require_confirmation boolean NOT NULL DEFAULT false,
  implementated_at date,
  CONSTRAINT restaurants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id text UNIQUE,
  restaurant_id text,
  agent_id text,
  phone_number text,
  called_number text,
  transcript text,
  summary text,
  status text NOT NULL DEFAULT ''::text,
  rationale text,
  duration_seconds integer,
  language text,
  call_started_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT call_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.reservation_times (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  dow_id smallint NOT NULL CHECK (dow_id >= 0 AND dow_id <= 6),
  day_of_week text NOT NULL,
  opens_at time without time zone NOT NULL,
  closes_at time without time zone NOT NULL,
  last_reservation_time time without time zone,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservation_times_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_times_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'manager'::text, 'host'::text, 'staff'::text, 'read_only'::text])),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_memberships_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.restaurant_settings (
  restaurant_id text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Lisbon'::text,
  default_duration_minutes smallint NOT NULL DEFAULT 120 CHECK (default_duration_minutes >= 30 AND default_duration_minutes <= 480),
  booking_interval_minutes smallint NOT NULL DEFAULT 30 CHECK (booking_interval_minutes >= 5 AND booking_interval_minutes <= 180),
  default_buffer_minutes smallint NOT NULL DEFAULT 0 CHECK (default_buffer_minutes >= 0 AND default_buffer_minutes <= 180),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_settings_pkey PRIMARY KEY (restaurant_id),
  CONSTRAINT restaurant_settings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_feature_flags (
  restaurant_id text NOT NULL,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT restaurant_feature_flags_pkey PRIMARY KEY (restaurant_id, feature_key),
  CONSTRAINT restaurant_feature_flags_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_feature_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.restaurant_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_areas_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_areas_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.dining_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  area_id uuid,
  name text NOT NULL,
  min_capacity smallint NOT NULL DEFAULT 1 CHECK (min_capacity > 0),
  max_capacity smallint NOT NULL,
  shape text NOT NULL DEFAULT 'square'::text CHECK (shape = ANY (ARRAY['round'::text, 'square'::text, 'rectangle'::text])),
  position_x numeric NOT NULL DEFAULT 0,
  position_y numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  operational_state text NOT NULL DEFAULT 'available'::text CHECK (operational_state = ANY (ARRAY['available'::text, 'reserved'::text, 'occupied'::text, 'cleaning'::text, 'blocked'::text, 'unavailable'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dining_tables_pkey PRIMARY KEY (id),
  CONSTRAINT dining_tables_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT dining_tables_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.restaurant_areas(id)
);
CREATE TABLE public.reservation_table_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  reservation_id text NOT NULL,
  table_id uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  active boolean NOT NULL DEFAULT true,
  assigned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservation_table_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_table_assignments_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT reservation_table_assignments_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.bookings(reservation_id),
  CONSTRAINT reservation_table_assignments_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.dining_tables(id),
  CONSTRAINT reservation_table_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id)
);
CREATE TABLE public.reservation_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  area_id uuid,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  block_type text NOT NULL CHECK (block_type = ANY (ARRAY['entire_day'::text, 'specific_hours'::text, 'lunch'::text, 'dinner'::text, 'date_range'::text])),
  reason text NOT NULL,
  internal_note text,
  customer_message text,
  channels ARRAY NOT NULL DEFAULT ARRAY['website_widget'::text, 'ai_receptionist'::text, 'integration'::text] CHECK (cardinality(channels) > 0),
  allow_manager_override boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  ended_by uuid,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  max_bookable_covers integer CHECK (max_bookable_covers IS NULL OR max_bookable_covers >= 0 AND max_bookable_covers <= 9999),
  CONSTRAINT reservation_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_blocks_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT reservation_blocks_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.restaurant_areas(id),
  CONSTRAINT reservation_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT reservation_blocks_ended_by_fkey FOREIGN KEY (ended_by) REFERENCES auth.users(id)
);
CREATE TABLE public.reservation_idempotency_requests (
  restaurant_id text NOT NULL,
  idempotency_key text NOT NULL,
  operation text NOT NULL,
  reservation_id text,
  response jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  CONSTRAINT reservation_idempotency_requests_pkey PRIMARY KEY (restaurant_id, idempotency_key),
  CONSTRAINT reservation_idempotency_requests_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT reservation_idempotency_requests_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.bookings(reservation_id),
  CONSTRAINT reservation_idempotency_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
