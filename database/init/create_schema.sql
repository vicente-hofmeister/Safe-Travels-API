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
