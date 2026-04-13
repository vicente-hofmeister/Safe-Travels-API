CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id varchar(120) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username varchar(80) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS location_events (
  location_event_id bigserial PRIMARY KEY,
  user_id varchar(120) NOT NULL,
  latitude numeric(10, 7) NOT NULL,
  longitude numeric(10, 7) NOT NULL,
  accuracy_meters integer,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT location_events_latitude_range CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT location_events_longitude_range CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT location_events_accuracy_non_negative CHECK (
    accuracy_meters IS NULL OR accuracy_meters >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_location_events_user_id_captured_at
  ON location_events (user_id, captured_at DESC);
