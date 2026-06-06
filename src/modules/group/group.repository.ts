import type { PoolClient } from "pg";
import { query } from "../../config/database.js";

export type GroupRow = {
  group_id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_username: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
};

export type GroupListRow = GroupRow & { joined_at: string };

export type MemberRow = {
  user_id: string;
  username: string;
  name: string;
  joined_at: string;
};

export async function insertGroup(
  client: PoolClient,
  name: string,
  description: string | null,
  ownerUserId: string,
) {
  return client.query<{
    group_id: string;
    name: string;
    description: string | null;
    owner_id: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO groups (name, description, owner_id)
     VALUES ($1, $2, $3)
     RETURNING group_id, name, description, owner_id, created_at, updated_at`,
    [name, description, ownerUserId],
  );
}

export async function insertGroupMember(client: PoolClient, groupId: string, userId: string) {
  return client.query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)`,
    [groupId, userId],
  );
}

export async function findOwnerForGroup(client: PoolClient, userId: string) {
  return client.query<{ username: string; name: string }>(
    `SELECT username, name FROM users WHERE user_id = $1`,
    [userId],
  );
}
export async function findGroupOwner(groupId: string) {
  return query<{ owner_id: string }>(
    `SELECT owner_id FROM groups WHERE group_id = $1 AND deleted_at IS NULL`,
    [groupId],
  );
}

export async function findGroupWithOwner(groupId: string) {
  return query<GroupRow>(
    `SELECT g.group_id, g.name, g.description, g.owner_id, g.created_at, g.updated_at,
            u.username AS owner_username, u.name AS owner_name
     FROM groups g
     JOIN users u ON u.user_id = g.owner_id
     WHERE g.group_id = $1 AND g.deleted_at IS NULL`,
    [groupId],
  );
}

export async function findGroupMembers(groupId: string) {
  return query<MemberRow>(
    `SELECT gm.user_id, gm.joined_at, u.username, u.name
     FROM group_members gm
     JOIN users u ON u.user_id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`,
    [groupId],
  );
}

export async function findGroupsByUserId(userId: string) {
  return query<GroupListRow>(
    `SELECT g.group_id, g.name, g.description, g.owner_id, g.created_at, g.updated_at,
            u.username AS owner_username, u.name AS owner_name,
            gm.joined_at
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.group_id
     JOIN users u ON u.user_id = g.owner_id
     WHERE gm.user_id = $1 AND g.deleted_at IS NULL
     ORDER BY gm.joined_at DESC`,
    [userId],
  );
}

export async function deleteGroupMember(groupId: string, userId: string) {
  return query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
}

export async function softDeleteGroup(groupId: string) {
  return query(
    `UPDATE groups SET deleted_at = now(), updated_at = now() WHERE group_id = $1`,
    [groupId],
  );
}

export async function upsertGroupMember(groupId: string, userId: string) {
  return query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [groupId, userId],
  );
}
