CREATE TABLE IF NOT EXISTS users (
  user_id uuid PRIMARY KEY,
  username varchar(80) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  phone varchar(20) UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  profile_image text,
  location_data text NOT NULL,
  privacy_settings varchar(30) NOT NULL,
  email_verified_at timestamptz,
  phone_verified_at timestamptz
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tier varchar(20) NOT NULL,
  followed_at timestamptz NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS groups (
  group_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  profile_image text,
  location_data text NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id uuid NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS trips (
  trip_id uuid PRIMARY KEY,
  title varchar(150) NOT NULL,
  description text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  trip_image text,
  start_date date NOT NULL,
  end_date date,
  location_data text NOT NULL
);

CREATE TABLE IF NOT EXISTS user_trips (
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, trip_id)
);

CREATE TABLE IF NOT EXISTS group_trips (
  group_id uuid NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, trip_id)
);
