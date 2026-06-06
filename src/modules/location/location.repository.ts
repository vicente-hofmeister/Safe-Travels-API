import type { PoolClient } from "pg";
import { query } from "../../config/database.js";

export type LocationRow = {
  location_event_id: number;
  user_id: string;
  username: string;
  name: string;
  latitude: string;
  longitude: string;
  accuracy_meters: number | null;
  captured_at: string;
  created_at: string;
};

export type LocationEventInsertRow = {
  location_event_id: number;
  user_id: string;
  latitude: string;
  longitude: string;
  accuracy_meters: number | null;
  captured_at: string;
  created_at: string;
};

export type GroupLocationRow = {
  location_event_id: number;
  latitude: string;
  longitude: string;
  accuracy_meters: number | null;
  captured_at: string;
  created_at: string;
};

export async function findActiveTripForUser(client: PoolClient, userId: string) {
  return client.query<{ trip_id: string }>(
    `SELECT ut.trip_id
     FROM user_trips ut
     JOIN trips t ON t.trip_id = ut.trip_id
     WHERE ut.user_id = $1
       AND t.ended_at IS NULL
       AND t.deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
}

export async function insertLocationEvent(
  client: PoolClient,
  userId: string,
  latitude: number,
  longitude: number,
  accuracyMeters: number | null | undefined,
  capturedAt: string | null | undefined,
) {
  return client.query<LocationEventInsertRow>(
    `INSERT INTO location_events (user_id, latitude, longitude, accuracy_meters, captured_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
     RETURNING location_event_id, user_id, latitude, longitude, accuracy_meters, captured_at, created_at`,
    [userId, latitude, longitude, accuracyMeters ?? null, capturedAt ?? null],
  );
}

export async function findActiveGroupsForUser(client: PoolClient, userId: string) {
  return client.query<{ group_id: string }>(
    `SELECT DISTINCT gm.group_id
     FROM group_members gm
     JOIN trips t ON t.group_id = gm.group_id
     WHERE gm.user_id = $1
       AND t.ended_at IS NULL
       AND t.deleted_at IS NULL`,
    [userId],
  );
}

export async function insertLocationEventGroups(
  client: PoolClient,
  locationEventId: number,
  groupIds: string[],
) {
  return client.query(
    `INSERT INTO location_event_groups (location_event_id, group_id)
     SELECT $1, unnest($2::varchar[])`,
    [locationEventId, groupIds],
  );
}

export async function findActiveTripsForUser(client: PoolClient, userId: string) {
  return client.query<{ trip_id: string }>(
    `SELECT ut.trip_id
     FROM user_trips ut
     JOIN trips t ON t.trip_id = ut.trip_id
     WHERE ut.user_id = $1
       AND t.ended_at IS NULL
       AND t.deleted_at IS NULL`,
    [userId],
  );
}

export async function insertLocationEventTrips(
  client: PoolClient,
  locationEventId: number,
  tripIds: string[],
) {
  return client.query(
    `INSERT INTO location_event_trips (location_event_id, trip_id)
     SELECT $1, unnest($2::varchar[])`,
    [locationEventId, tripIds],
  );
}

export async function findLocationById(locationEventId: number) {
  return query<LocationRow>(
    `SELECT le.location_event_id, le.user_id, u.username, u.name,
            le.latitude, le.longitude, le.accuracy_meters, le.captured_at, le.created_at
     FROM location_events le
     JOIN users u ON u.user_id = le.user_id
     WHERE le.location_event_id = $1
     LIMIT 1`,
    [locationEventId],
  );
}

export async function findLatestLocationsPerUser(userIds?: string[]) {
  if (userIds && userIds.length > 0) {
    return query<LocationRow>(
      `SELECT DISTINCT ON (le.user_id)
         le.location_event_id, le.user_id, u.username, u.name,
         le.latitude, le.longitude, le.accuracy_meters, le.captured_at, le.created_at
       FROM location_events le
       JOIN users u ON u.user_id = le.user_id
       WHERE le.user_id = ANY($1::text[])
         AND EXISTS (
           SELECT 1 FROM user_trips ut
           JOIN trips t ON t.trip_id = ut.trip_id
           WHERE ut.user_id = le.user_id
             AND t.ended_at IS NULL AND t.deleted_at IS NULL
         )
       ORDER BY le.user_id, le.captured_at DESC`,
      [userIds],
    );
  }

  return query<LocationRow>(
    `SELECT DISTINCT ON (le.user_id)
       le.location_event_id, le.user_id, u.username, u.name,
       le.latitude, le.longitude, le.accuracy_meters, le.captured_at, le.created_at
     FROM location_events le
     JOIN users u ON u.user_id = le.user_id
     WHERE EXISTS (
       SELECT 1 FROM user_trips ut
       JOIN trips t ON t.trip_id = ut.trip_id
       WHERE ut.user_id = le.user_id
         AND t.ended_at IS NULL AND t.deleted_at IS NULL
     )
     ORDER BY le.user_id, le.captured_at DESC`,
  );
}

export async function findLatestLocationByUserId(userId: string) {
  return query<LocationRow>(
    `SELECT le.location_event_id, le.user_id, u.username, u.name,
            le.latitude, le.longitude, le.accuracy_meters, le.captured_at, le.created_at
     FROM location_events le
     JOIN users u ON u.user_id = le.user_id
     WHERE le.user_id = $1
     ORDER BY le.captured_at DESC
     LIMIT 1`,
    [userId],
  );
}

export async function findGroupById(groupId: string) {
  return query<{ group_id: string }>(
    `SELECT group_id FROM groups WHERE group_id = $1 AND deleted_at IS NULL`,
    [groupId],
  );
}

export async function findActiveTripForGroup(groupId: string) {
  return query<{ trip_id: string }>(
    `SELECT trip_id FROM trips
     WHERE group_id = $1 AND ended_at IS NULL AND deleted_at IS NULL
     LIMIT 1`,
    [groupId],
  );
}

export async function findLatestGroupLocations(groupId: string) {
  return query<GroupLocationRow>(
    `SELECT DISTINCT ON (le.user_id)
       le.location_event_id, le.latitude, le.longitude,
       le.accuracy_meters, le.captured_at, le.created_at
     FROM location_events le
     JOIN location_event_groups leg ON leg.location_event_id = le.location_event_id
     WHERE leg.group_id = $1
     ORDER BY le.user_id, le.captured_at DESC`,
    [groupId],
  );
}
