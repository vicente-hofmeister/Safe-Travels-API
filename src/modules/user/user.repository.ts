import { query } from "../../config/database.js";

export type UserRow = {
  user_id: string;
  username: string;
  name: string;
  email: string;
  created_at: string;
};

export async function findUserById(userId: string) {
  return query<UserRow>(
    `SELECT user_id, username, name, email, created_at
     FROM users
     WHERE user_id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
}

export async function searchUsers(q: string) {
  return query<UserRow>(
    `SELECT user_id, username, name, email, created_at
     FROM users
     WHERE deleted_at IS NULL
       AND (username ILIKE $1 OR name ILIKE $1)
     ORDER BY username ASC
     LIMIT 20`,
    [`%${q}%`],
  );
}
