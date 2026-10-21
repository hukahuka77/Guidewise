import postgres from "postgres";

export type Sql = postgres.Sql;

let client: Sql | null | undefined;

/** Accept the same DATABASE_URL Flask used (SQLAlchemy-style driver suffixes are stripped). */
export function normalizeDatabaseUrl(url: string): string {
  return url.replace(/^postgres(?:ql)?\+\w+:\/\//, "postgresql://");
}

/**
 * Direct Postgres connection (Supabase pooler) for routes that need real transactions.
 * Returns null when DATABASE_URL is not configured so callers can fall back to Flask.
 */
export function getSql(): Sql | null {
  if (client !== undefined) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    client = null;
    return client;
  }
  const normalized = normalizeDatabaseUrl(url);
  client = postgres(normalized, {
    max: 1, // one connection per serverless instance; the pooler multiplexes
    prepare: false, // required for Supabase's transaction pooler
    idle_timeout: 20,
    connect_timeout: 10,
    ...(/[?&]sslmode=/.test(normalized) ? {} : { ssl: "prefer" as const }),
  });
  return client;
}

/** Test hook: use a specific client (or reset) instead of reading DATABASE_URL. */
export function setSqlForTests(next: Sql | null | undefined): void {
  client = next;
}
