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

CREATE TABLE IF NOT EXISTS groups (
  group_id varchar(120) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name varchar(150) NOT NULL,
  description varchar(500),
  owner_id varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id varchar(120) NOT NULL,
  user_id varchar(120) NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members (user_id);

CREATE TABLE IF NOT EXISTS location_event_groups (
  location_event_id bigint NOT NULL,
  group_id varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_event_id, group_id),
  CONSTRAINT fk_leg_event FOREIGN KEY (location_event_id)
    REFERENCES location_events(location_event_id) ON DELETE CASCADE,
  CONSTRAINT fk_leg_group FOREIGN KEY (group_id)
    REFERENCES groups(group_id)
);

CREATE INDEX IF NOT EXISTS idx_location_event_groups_group_id
  ON location_event_groups (group_id, location_event_id DESC);

-- location_event_trips: FK para trips será adicionada quando o módulo for implementado
CREATE TABLE IF NOT EXISTS location_event_trips (
  location_event_id bigint NOT NULL,
  trip_id varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_event_id, trip_id),
  CONSTRAINT fk_let_event FOREIGN KEY (location_event_id)
    REFERENCES location_events(location_event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_location_event_trips_trip_id
  ON location_event_trips (trip_id, location_event_id DESC);
