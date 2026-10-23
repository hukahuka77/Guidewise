import { getAuthedUser, isAuthConfigured, type AuthedUser } from "./auth";
import { getSql, type Sql } from "./db";
import { ServiceError } from "./guidebookService";
import { rateLimited } from "./rateLimit";

export interface ApiContext {
  sql: Sql;
  user: AuthedUser;
  request: Request;
}

/** Parse a JSON object body; a bad or missing body is an empty object. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A route whose configuration (database, auth, Stripe, API keys) is missing in this environment. */
export const notConfigured = () => Response.json({ error: "This feature is not configured on the server." }, { status: 503 });

interface Options {
  /** Extra configuration the route needs (e.g. Stripe); when it returns false the route answers 503. */
  needs?: () => boolean;
  /** Per-user sliding-window limit (requests per minute). */
  rateLimit?: { name: string; limit: number };
  /** Let guests (anonymous users who haven't created an account yet) use the route. */
  allowGuest?: boolean;
}

/** Guests can create and preview a guidebook; everything else needs an account. */
const accountRequired = () =>
  Response.json({ error: "Create a free account to do that.", code: "account_required" }, { status: 403 });

/**
 * Wrap an authenticated API route:
 *  - not configured (no DATABASE_URL / Supabase auth, or `needs` is false) -> 503
 *  - missing or invalid token -> 401
 *  - a guest, unless `allowGuest` -> 403
 *  - ServiceError -> `{ error }` with its status; anything else -> 500
 */
export async function withUser(
  request: Request,
  handler: (ctx: ApiContext) => Promise<Response>,
  options: Options = {},
): Promise<Response> {
  const sql = getSql();
  if (!sql || !isAuthConfigured() || (options.needs && !options.needs())) return notConfigured();

  const user = await getAuthedUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isGuest && !options.allowGuest) return accountRequired();

  try {
    return await handler({ sql, user, request });
  } catch (error) {
    if (error instanceof ServiceError) {
      return Response.json({ error: error.message, ...error.extra }, { status: error.status });
    }
    console.error(`${request.method} ${new URL(request.url).pathname} failed`, error);
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "unexpected error";
    return Response.json({ error: `Request failed: ${detail}` }, { status: 500 });
  }
}

/**
 * Like `withUser` for routes that need auth but not the database (Places, AI, listing import).
 * Not configured (no Supabase auth, or `needs` is false) -> 503.
 */
export async function withAuth(
  request: Request,
  handler: (user: AuthedUser) => Promise<Response>,
  options: Pick<Options, "needs" | "rateLimit" | "allowGuest"> = {},
): Promise<Response> {
  if (!isAuthConfigured() || (options.needs && !options.needs())) return notConfigured();
  const user = await getAuthedUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isGuest && !options.allowGuest) return accountRequired();
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
