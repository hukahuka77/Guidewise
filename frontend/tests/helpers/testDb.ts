import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import type { Sql } from "../../src/lib/server/db";

/** schema.sql mirrors the production tables used by the guidebook routes (columns, defaults, FKs, unique slug). */
const SCHEMA = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

export interface TestDb {
  sql: Sql;
  close: () => Promise<void>;
  reset: () => Promise<void>;
}

/** Real Postgres (PGlite) behind a socket, queried with the same postgres.js client the app uses. */
export async function startTestDb(): Promise<TestDb> {
  const pg = await PGlite.create();
  await pg.exec(SCHEMA);
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1" });
  await server.start();
  const address = (server as unknown as { server?: { address(): { port: number } } }).server?.address();
  const port = address?.port;
  if (!port) throw new Error("could not determine PGlite socket port");

  const sql = postgres(`postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  return {
    sql,
    reset: async () => {
      await pg.exec("truncate guidebook, host, property, profiles, auth.users, guidebook_view_daily, view_dedupe, ai_usage_monthly, guidebook_pdf_plan restart identity cascade");
    },
    close: async () => {
      await sql.end({ timeout: 2 });
      await server.stop();
      await pg.close();
    },
  };
}

export const OWNER = "11111111-1111-4111-8111-aaaaaaaaaaaa";
export const OTHER = "22222222-2222-4222-8222-bbbbbbbbbbbb";

export async function setPlan(sql: Sql, userId: string, plan: string, limit: number | null = null) {
  await sql`insert into profiles (user_id, plan, guidebook_limit) values (${userId}::uuid, ${plan}, ${limit})
            on conflict (user_id) do update set plan = excluded.plan, guidebook_limit = excluded.guidebook_limit`;
}
