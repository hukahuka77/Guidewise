import { getAuthedUser, isAuthConfigured, type AuthedUser } from "./auth";
import { getSql, type Sql } from "./db";
import { ServiceError } from "./guidebookService";
import { proxyToBackend } from "./proxy";
import { rateLimited } from "./rateLimit";

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
  /** Extra configuration the route needs (e.g. Stripe); when it returns false Flask handles the request. */
  needs?: () => boolean;
  /** Per-user sliding-window limit (requests per minute). */
  rateLimit?: { name: string; limit: number };
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
  if (!sql || !isAuthConfigured() || (options.needs && !options.needs())) return proxyToBackend(request);

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

/**
 * Like `withUser` for routes that need auth but not the database (Places, AI, listing import).
 * Not configured (no Supabase auth, or `needs` is false) -> Flask handles it.
 */
export async function withAuth(
  request: Request,
  handler: (user: AuthedUser) => Promise<Response>,
  options: Pick<Options, "needs" | "rateLimit"> = {},
): Promise<Response> {
  if (!isAuthConfigured() || (options.needs && !options.needs())) return proxyToBackend(request);
  const user = await getAuthedUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (options.rateLimit && rateLimited(`${options.rateLimit.name}:${user.id}`, options.rateLimit.limit)) {
    return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  try {
    return await handler(user);
  } catch (error) {
    if (error instanceof ServiceError) {
      return Response.json({ error: error.message, ...error.extra }, { status: error.status });
    }
    console.error(`${request.method} ${new URL(request.url).pathname} failed`, error);
    return Response.json({ error: "Request failed" }, { status: 500 });
  }
}
