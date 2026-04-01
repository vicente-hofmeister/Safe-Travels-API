import "./environment.js";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const databaseConfig = {
  host: process.env.SAFE_TRAVELS_DB_HOST ?? process.env.DB_HOST ?? "localhost",
  port: Number(process.env.SAFE_TRAVELS_DB_PORT ?? process.env.DB_PORT ?? 5432),
  database: process.env.SAFE_TRAVELS_DB_NAME ?? process.env.DB_NAME ?? "safe_travels",
  user: process.env.SAFE_TRAVELS_DB_USER ?? process.env.DB_USER ?? "safe_travels_user",
  password: process.env.SAFE_TRAVELS_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "safe_travels_pass",
  max: 10,
  idleTimeoutMillis: 30_000,
} as const;

const pool = new Pool(databaseConfig);

export function getDatabaseConfig() {
  return databaseConfig;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, [...values]);
}

export async function withDatabaseTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool.end();
}
