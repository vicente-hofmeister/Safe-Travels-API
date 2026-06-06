import type { PoolClient } from "pg";
import { query } from "../../config/database.js";

export type TripRow = {
  trip_id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_username: string;
  owner_name: string;
  group_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TripMemberRow = {
  user_id: string;
  username: string;
  name: string;
  joined_at: string;
};

export type TripRoutePointRow = {
  location_event_id: number;
  latitude: string;
  longitude: string;
  accuracy_meters: number | null;
  captured_at: string;
};

export async function findGroupMembership(client: PoolClient, groupId: string, userId: string) {
  return client.query<{ group_id: string; owner_id: string }>(
    `SELECT g.group_id, g.owner_id
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.group_id AND gm.user_id = $2
     WHERE g.group_id = $1 AND g.deleted_at IS NULL`,
    [groupId, userId],
  );
}

export async function insertTrip(
  client: PoolClient,
  name: string,
  description: string | null,
  ownerId: string,
  groupId: string | null,
  startedAt: string | null,
) {
  return client.query<Omit<TripRow, "owner_username" | "owner_name">>(
    `INSERT INTO trips (name, description, owner_id, group_id, started_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
     RETURNING trip_id, name, description, owner_id, group_id,
               started_at, ended_at, created_at, updated_at`,
    [name, description, ownerId, groupId, startedAt],
  );
}

export async function findUserForTrip(client: PoolClient, userId: string) {
  return client.query<{ username: string; name: string }>(
    `SELECT username, name FROM users WHERE user_id = $1`,
    [userId],
  );
}

export async function insertUserTrip(client: PoolClient, tripId: string, userId: string) {
  return client.query(
    `INSERT INTO user_trips (trip_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [tripId, userId],
  );
}

export async function insertGroupMembersAsTrip(
  client: PoolClient,
  tripId: string,
  groupId: string,
) {
  return client.query(
    `INSERT INTO user_trips (trip_id, user_id)
     SELECT $1, gm.user_id FROM group_members gm WHERE gm.group_id = $2
     ON CONFLICT DO NOTHING`,
    [tripId, groupId],
  );
}

export async function findTripWithOwner(tripId: string) {
  return query<TripRow>(
    `SELECT t.trip_id, t.name, t.description, t.owner_id, t.group_id,
            t.started_at, t.ended_at, t.created_at, t.updated_at,
            u.username AS owner_username, u.name AS owner_name
     FROM trips t
     JOIN users u ON u.user_id = t.owner_id
     WHERE t.trip_id = $1 AND t.deleted_at IS NULL`,
    [tripId],
  );
}

export async function findTripMembers(tripId: string) {
  return query<TripMemberRow>(
    `SELECT u.user_id, u.username, u.name, ut.joined_at
     FROM user_trips ut
     JOIN users u ON u.user_id = ut.user_id
     WHERE ut.trip_id = $1
     ORDER BY ut.joined_at ASC`,
    [tripId],
  );
}

export async function findTripRoute(tripId: string) {
  return query<TripRoutePointRow>(
    `SELECT le.location_event_id, le.latitude, le.longitude, le.accuracy_meters, le.captured_at
     FROM location_event_trips let_
     JOIN location_events le ON le.location_event_id = let_.location_event_id
     WHERE let_.trip_id = $1
     ORDER BY le.captured_at ASC`,
    [tripId],
  );
}

export async function findTripsByUserId(userId: string) {
  return query<TripRow>(
    `SELECT t.trip_id, t.name, t.description, t.owner_id, t.group_id,
            t.started_at, t.ended_at, t.created_at, t.updated_at,
            u.username AS owner_username, u.name AS owner_name
     FROM trips t
     JOIN user_trips ut ON ut.trip_id = t.trip_id AND ut.user_id = $1
     JOIN users u ON u.user_id = t.owner_id
     WHERE t.deleted_at IS NULL
     ORDER BY t.started_at DESC`,
    [userId],
  );
}

export async function findGroupById(groupId: string) {
  return query<{ group_id: string }>(
    `SELECT group_id FROM groups WHERE group_id = $1 AND deleted_at IS NULL`,
    [groupId],
  );
}

export async function findTripsByGroupId(groupId: string) {
  return query<TripRow>(
    `SELECT t.trip_id, t.name, t.description, t.owner_id, t.group_id,
            t.started_at, t.ended_at, t.created_at, t.updated_at,
            u.username AS owner_username, u.name AS owner_name
     FROM trips t
     JOIN users u ON u.user_id = t.owner_id
     WHERE t.group_id = $1 AND t.deleted_at IS NULL
     ORDER BY t.started_at DESC`,
    [groupId],
  );
}

export async function findTripForUpdate(tripId: string) {
  return query<{ trip_id: string; owner_id: string; ended_at: string | null }>(
    `SELECT trip_id, owner_id, ended_at FROM trips WHERE trip_id = $1 AND deleted_at IS NULL`,
    [tripId],
  );
}

export async function endTrip(tripId: string) {
  return query(
    `UPDATE trips SET ended_at = now(), updated_at = now() WHERE trip_id = $1`,
    [tripId],
  );
}

export async function softDeleteTrip(tripId: string) {
  return query(
    `UPDATE trips SET deleted_at = now(), updated_at = now() WHERE trip_id = $1`,
    [tripId],
  );
}

export async function findUserExists(userId: string) {
  return query<{ user_id: string }>(
    `SELECT user_id FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
}

export async function insertTripMember(tripId: string, userId: string) {
  return query(
    `INSERT INTO user_trips (trip_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [tripId, userId],
  );
}

export async function findTripForOwnerCheck(tripId: string) {
  return query<{ trip_id: string; owner_id: string; group_id: string | null; ended_at: string | null }>(
    `SELECT trip_id, owner_id, group_id, ended_at FROM trips WHERE trip_id = $1 AND deleted_at IS NULL`,
    [tripId],
  );
}

export async function deleteTripMember(tripId: string, userId: string) {
  return query(
    `DELETE FROM user_trips WHERE trip_id = $1 AND user_id = $2`,
    [tripId, userId],
  );
}
