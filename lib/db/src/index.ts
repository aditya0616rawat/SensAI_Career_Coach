import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
export { Pool };
export type { PoolClient } from "pg";

export function createPool(connectionString?: string): pg.Pool | null {
  const connStr = connectionString || process.env.DATABASE_URL;
  if (!connStr) return null;

  return new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
}

export const pool = process.env.DATABASE_URL
  ? createPool(process.env.DATABASE_URL)
  : null;

export const db: NodePgDatabase<typeof schema> | null = pool
  ? drizzle(pool, { schema })
  : null;

/**
 * Ensures Neon PostgreSQL tables exist automatically on startup.
 * Idempotent and safe to run on every deploy.
 */
export async function bootstrapPostgresSchema(targetPool?: pg.Pool): Promise<void> {
  const p = targetPool || pool;
  if (!p) return;

  const ddl = `
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      profile_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      title VARCHAR(256) NOT NULL,
      company VARCHAR(256),
      job_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recruiter_access (
      user_id VARCHAR(128) PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id VARCHAR(128) PRIMARY KEY,
      candidate_id VARCHAR(128) NOT NULL,
      job_id INTEGER NOT NULL,
      status VARCHAR(64) DEFAULT 'APPLIED' NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);
  `;

  await p.query(ddl);
}

export * from "./schema";

