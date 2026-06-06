import { query } from "../../config/database.js";

export type AuthUserRecord = {
  user_id: string;
  username: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export async function findUserByEmailOrUsername(email: string, username: string) {
  return query<{ user_id: string }>(
    `SELECT user_id FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
    [email, username],
  );
}

export async function insertUser(
  username: string,
  name: string,
  email: string,
  passwordHash: string,
) {
  return query<AuthUserRecord>(
    `INSERT INTO users (username, name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, username, name, email, password_hash, created_at, updated_at`,
    [username, name, email, passwordHash],
  );
}

export async function findUserByEmail(email: string) {
  return query<AuthUserRecord>(
    `SELECT user_id, username, name, email, password_hash, created_at, updated_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );
}
