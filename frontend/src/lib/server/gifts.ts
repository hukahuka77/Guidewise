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
