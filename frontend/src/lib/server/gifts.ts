import { createClient } from "@supabase/supabase-js";
import type { Sql } from "./db";
import { readClaimTicket } from "./guestAccounts";

/**
 * Gifts: for outreach, an admin builds a guidebook from a host's listing and sends them a link. The
 * guidebook belongs to a fresh guest (anonymous) user, so it stays private until the host opens the
 * gift link, signs up and claims it with the link's ticket (the normal guest claim).
 */

/** Admins are the comma-separated, verified sign-in emails in ADMIN_EMAILS. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/** A new guest user to own one gift; null when Supabase isn't configured or refuses. */
export async function createGiftOwner(): Promise<string | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    console.error("gift: could not create a guest owner", error);
    return null;
  }
  return data.user.id;
}

export interface Gift {
  guestId: string;
  guidebookId: string;
  propertyName: string | null;
  hostName: string | null;
}

/** The unclaimed guidebook behind a gift link; null when the ticket is bad, expired or already claimed. */
export async function findGift(sql: Sql, ticket: unknown): Promise<Gift | null> {
  const guestId = readClaimTicket(ticket);
  if (!guestId) return null;
  const rows = await sql`
    select g.id, p.name as property_name, h.name as host_name
      from guidebook g
      left join property p on p.id = g.property_id
      left join host h on h.id = g.host_id
     where g.user_id = ${guestId}
     order by g.created_time desc
     limit 1`;
  if (!rows[0]) return null;
  return { guestId, guidebookId: rows[0].id, propertyName: rows[0].property_name ?? null, hostName: rows[0].host_name ?? null };
}

// ---------------------------------------------------------------------------------------------
// Outreach results: each gift's row is stamped when it's built, opened and claimed. Recording is best
// effort: a tracking failure never breaks building, opening or claiming a gift.
// ---------------------------------------------------------------------------------------------

const cleanEmail = (value: unknown) => {
  const email = typeof value === "string" ? value.trim().slice(0, 254) : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export async function recordGiftCreated(
  sql: Sql,
  gift: { guestId: string; guidebookId: string; propertyName: string | null; prospectEmail?: unknown },
): Promise<void> {
  await sql`
    insert into public.outreach_gift (guest_id, guidebook_id, property_name, prospect_email)
    values (${gift.guestId}::uuid, ${gift.guidebookId}, ${gift.propertyName}, ${cleanEmail(gift.prospectEmail)})
    on conflict (guest_id) do nothing`.catch((error) => console.warn("outreach: could not record a gift", error));
}

export async function recordGiftOpened(sql: Sql, guestId: string): Promise<void> {
  await sql`
    update public.outreach_gift
       set opens = opens + 1, first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now()
     where guest_id = ${guestId}::uuid`.catch((error) => console.warn("outreach: could not record an open", error));
}

export async function recordGiftClaimed(sql: Sql, guestId: string, userId: string): Promise<void> {
  await sql`
    update public.outreach_gift set claimed_at = coalesce(claimed_at, now()), claimed_by = ${userId}::uuid
     where guest_id = ${guestId}::uuid`.catch((error) => console.warn("outreach: could not record a claim", error));
}

/** Every gift, newest first, with who claimed it; empty if the table isn't there yet. */
export async function outreachResults(sql: Sql) {
  const rows = await sql`
    select o.guest_id, o.guidebook_id, o.property_name, o.prospect_email, o.created_at, o.first_opened_at,
           o.last_opened_at, o.opens, o.claimed_at, o.reply_status, o.replied_at, o.reply_note, u.email as claimed_by_email
      from public.outreach_gift o left join auth.users u on u.id = o.claimed_by
     order by o.created_at desc
     limit 500`.catch(() => []);
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return rows.map((r) => ({
    guest_id: String(r.guest_id),
    property_name: (r.property_name as string) ?? null,
    prospect_email: (r.prospect_email as string) ?? null,
    created_at: iso(r.created_at),
    first_opened_at: iso(r.first_opened_at),
    last_opened_at: iso(r.last_opened_at),
    opens: Number(r.opens) || 0,
    claimed_at: iso(r.claimed_at),
    claimed_by_email: (r.claimed_by_email as string) ?? null,
    reply_status: (r.reply_status as ReplyStatus | null) ?? null,
    replied_at: iso(r.replied_at),
    reply_note: (r.reply_note as string) ?? null,
  }));
}

export const REPLY_STATUSES = ["replied", "interested", "declined"] as const;
export type ReplyStatus = (typeof REPLY_STATUSES)[number];

/**
 * Record how a prospect answered (null clears it). The reply time is kept when only the note or the
 * status changes, and set to now if none was given. False when there's no such gift.
 */
export async function setOutreachReply(
  sql: Sql,
  guestId: string,
  reply: { status: ReplyStatus | null; note?: string | null; repliedAt?: string | null },
): Promise<boolean> {
  const note = typeof reply.note === "string" ? reply.note.trim().slice(0, 500) || null : null;
  const at = reply.repliedAt && !Number.isNaN(Date.parse(reply.repliedAt)) ? new Date(reply.repliedAt).toISOString() : null;
  const rows = reply.status
    ? await sql`
        update public.outreach_gift
           set reply_status = ${reply.status}, reply_note = ${note},
               replied_at = coalesce(${at}::timestamptz, replied_at, now())
         where guest_id = ${guestId}::uuid returning guest_id`
    : await sql`
        update public.outreach_gift set reply_status = null, reply_note = null, replied_at = null
         where guest_id = ${guestId}::uuid returning guest_id`;
  return rows.length > 0;
}
