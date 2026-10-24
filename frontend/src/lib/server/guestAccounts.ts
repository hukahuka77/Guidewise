import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db";
import { ServiceError } from "./guidebookService";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { recordGiftClaimed } from "./gifts";

/**
 * Guests: anyone can build a guidebook before creating an account. They get a Supabase anonymous
 * user, so every route works as usual, but their guidebooks aren't shown to guests at /g/<slug>
 * until they sign up. Signing up (or logging in) creates a different user, so the browser keeps a
 * signed claim ticket for the anonymous user and hands it in afterwards to move the guidebooks over.
 */

/** Guidebooks a guest can make before they need an account: the free plan's one. */
export const GUEST_GUIDEBOOK_LIMIT = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICKET_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function ticketKey(): Buffer | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret ? createHmac("sha256", secret).update("guidewise-guest-claim-v1").digest() : null;
}

const sign = (key: Buffer, payload: string) => createHmac("sha256", key).update(payload).digest("base64url");

/** A ticket that lets whoever holds it claim this guest's guidebooks for 30 days; null when unconfigured. */
export function createClaimTicket(guestId: string, now = Date.now()): string | null {
  const key = ticketKey();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({ g: guestId, exp: now + TICKET_TTL_MS })).toString("base64url");
  return `${payload}.${sign(key, payload)}`;
}

/** The guest user id in a valid, unexpired ticket; null otherwise. */
export function readClaimTicket(ticket: unknown, now = Date.now()): string | null {
  const key = ticketKey();
  if (!key || typeof ticket !== "string" || ticket.length > 1000) return null;
  const [payload, mac] = ticket.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(key, payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data?.g !== "string" || typeof data?.exp !== "number" || data.exp < now) return null;
    return data.g;
  } catch {
    return null;
  }
}

/** Whether a guidebook owner is still a guest (an anonymous Supabase user). */
export async function isGuestUser(sql: Sql, userId: string | null | undefined): Promise<boolean> {
  if (!userId || !UUID.test(userId)) return false;
  try {
    const rows = await sql`select is_anonymous from auth.users where id = ${userId}::uuid`;
    return rows[0]?.is_anonymous === true;
  } catch (error) {
    console.error("guest check failed; treating the owner as a member", error);
    return false;
  }
}

export async function assertGuestCanCreate(sql: Sql, guestId: string): Promise<void> {
  const [row] = await sql`select count(*)::int as total from guidebook where user_id = ${guestId}`;
  if (row.total >= GUEST_GUIDEBOOK_LIMIT) {
    throw new ServiceError(403, "Create a free account to keep making guidebooks.", { code: "account_required" });
  }
}

/**
 * Move a guest's guidebooks (with their hosts and properties) to the account that now holds the
 * ticket. Returns the guidebook ids moved, newest first; an already-claimed ticket moves nothing.
 */
export async function claimGuestGuidebooks(sql: Sql, guestId: string, userId: string): Promise<string[]> {
  if (guestId === userId) return [];
  if (!(await isGuestUser(sql, guestId))) return [];
  const moved = await sql.begin(async (tx) => {
    const rows = await tx`update guidebook set user_id = ${userId} where user_id = ${guestId} returning id, created_time`;
    await tx`update host set user_id = ${userId} where user_id = ${guestId}`;
    await tx`update property set user_id = ${userId} where user_id = ${guestId}`;
    // Newest first: the browser opens the one they just made
    return [...rows]
      .sort((x, y) => new Date(y.created_time).getTime() - new Date(x.created_time).getTime())
      .map((r) => String(r.id));
  });
  if (moved.length > 0) await recordGiftClaimed(sql, guestId, userId);
  // The anonymous user has nothing left; remove it so the ticket can't be used again (best effort)
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(guestId);
    if (error) console.error("could not delete the claimed guest user", error.message);
  }
  return moved;
}
