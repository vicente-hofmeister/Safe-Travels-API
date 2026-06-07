-- Migração 001 — adiciona suporte a viagens (branch trips)
-- Segura para rodar em produção: todos os statements usam IF NOT EXISTS.
-- Não altera tabelas existentes (users, groups, group_members, location_events, location_event_groups).

-- Viagem vinculada a um grupo OU a um usuário individual (nunca os dois, nunca nenhum).
-- group_id IS NULL → viagem individual (só o owner); group_id NOT NULL → viagem de grupo.
CREATE TABLE IF NOT EXISTS trips (
  trip_id     varchar(120) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        varchar(150) NOT NULL,
  description varchar(500),
  owner_id    varchar(120) NOT NULL,
  group_id    varchar(120),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_trips_owner_id ON trips (owner_id);
CREATE INDEX IF NOT EXISTS idx_trips_group_id ON trips (group_id) WHERE group_id IS NOT NULL;

-- Membros de uma viagem (owner + quem foi adicionado).
CREATE TABLE IF NOT EXISTS user_trips (
  trip_id   varchar(120) NOT NULL,
  user_id   varchar(120) NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id),
  CONSTRAINT fk_ut_trip FOREIGN KEY (trip_id)
    REFERENCES trips(trip_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_trips_user_id ON user_trips (user_id);

-- Vincula eventos de localização às viagens ativas no momento do registro.
CREATE TABLE IF NOT EXISTS location_event_trips (
  location_event_id bigint NOT NULL,
  trip_id           varchar(120) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_event_id, trip_id),
  CONSTRAINT fk_let_event FOREIGN KEY (location_event_id)
    REFERENCES location_events(location_event_id) ON DELETE CASCADE,
  CONSTRAINT fk_let_trip FOREIGN KEY (trip_id)
    REFERENCES trips(trip_id)
);

CREATE INDEX IF NOT EXISTS idx_location_event_trips_trip_id
  ON location_event_trips (trip_id, location_event_id DESC);
