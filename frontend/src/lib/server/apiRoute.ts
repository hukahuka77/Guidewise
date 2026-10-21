import { getAuthedUser, isAuthConfigured, type AuthedUser } from "./auth";
import { getSql, type Sql } from "./db";
import { ServiceError } from "./guidebookService";
import { proxyToBackend } from "./proxy";

export interface ApiContext {
  sql: Sql;
  user: AuthedUser;
  request: Request;
}

/** Parse a JSON body like Flask's `request.json or {}` (a bad or missing body is an empty object). */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

interface Options {
  /** Reads are safe to retry on Flask if something unexpected throws; writes are not. */
  fallbackOnError?: boolean;
}

/**
 * Wrap an authenticated API route:
 *  - not configured (no DATABASE_URL / Supabase auth) -> let Flask handle it, like before the migration
 *  - missing or invalid token -> 401
 *  - ServiceError -> `{ error }` with its status; anything else -> 500 (or Flask for reads)
 */
export async function withUser(
  request: Request,
  handler: (ctx: ApiContext) => Promise<Response>,
  options: Options = {},
): Promise<Response> {
  const sql = getSql();
  if (!sql || !isAuthConfigured()) return proxyToBackend(request);

  const user = await getAuthedUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return await handler({ sql, user, request });
  } catch (error) {
    if (error instanceof ServiceError) {
      return Response.json({ error: error.message, ...error.extra }, { status: error.status });
    }
    console.error(`${request.method} ${new URL(request.url).pathname} failed`, error);
    if (options.fallbackOnError) return proxyToBackend(request);
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "unexpected error";
    return Response.json({ error: `Request failed: ${detail}` }, { status: 500 });
  }
}
