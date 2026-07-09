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
CREATE TABLE public.opening_hours (
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
  CONSTRAINT opening_hours_pkey PRIMARY KEY (id),
  CONSTRAINT opening_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);