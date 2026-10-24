import type { Sql } from "./db";
import { deleteGuidebook } from "./guidebookService";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Guest accounts (someone building before signing up, or an outreach gift) are only removed when they're
 * claimed. This clears out the ones nobody came back for, with their guidebooks, uploads, hosts and
 * properties. Run daily by the cleanup cron.
 *
 * - With guidebooks: once the account is older than GUEST_MIN_AGE_DAYS (gift links last 30 days, so every
 *   gift link has expired by then) and none of its guidebooks was edited in the last GUEST_IDLE_DAYS.
 * - Without guidebooks (started, never built anything): after EMPTY_GUEST_IDLE_DAYS without signing in.
 */
export const GUEST_MIN_AGE_DAYS = 37;
export const GUEST_IDLE_DAYS = 30;
export const EMPTY_GUEST_IDLE_DAYS = 7;
/** Per run, so one run stays well inside the function time limit; the rest go the next day. */
const BATCH = 100;

export interface CleanupResult {
  guests: number;
  guidebooks: number;
  failed: number;
}

type DeleteUser = (id: string) => Promise<void>;

const deleteAuthUser: DeleteUser = async (id) => {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
};

export async function abandonedGuests(sql: Sql): Promise<string[]> {
  const rows = await sql`
    select u.id::text as id
      from auth.users u
     where u.is_anonymous
       and (
         (exists (select 1 from guidebook g where g.user_id = u.id::text)
           and u.created_at < now() - make_interval(days => ${GUEST_MIN_AGE_DAYS})
           and not exists (
             select 1 from guidebook g
              where g.user_id = u.id::text
                and coalesce(g.last_modified_time, g.created_time) > now() - make_interval(days => ${GUEST_IDLE_DAYS})))
         or
         (not exists (select 1 from guidebook g where g.user_id = u.id::text)
           and coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => ${EMPTY_GUEST_IDLE_DAYS}))
       )
     order by u.created_at
     limit ${BATCH}`;
  return rows.map((r) => r.id as string);
}

export async function cleanupAbandonedGuests(sql: Sql, deleteUser: DeleteUser = deleteAuthUser): Promise<CleanupResult> {
  const result: CleanupResult = { guests: 0, guidebooks: 0, failed: 0 };
  for (const userId of await abandonedGuests(sql)) {
    try {
      const guidebooks = await sql`select id from guidebook where user_id = ${userId}`;
      for (const { id } of guidebooks) {
        await deleteGuidebook(sql, userId, id as string);
        result.guidebooks++;
      }
      await sql`delete from host where user_id = ${userId}`;
      await sql`delete from property where user_id = ${userId}`;
      await sql`delete from ai_usage_monthly where user_id = ${userId}`;
      await deleteUser(userId); // the profile row goes with it
      result.guests++;
    } catch (error) {
      result.failed++;
      console.error("guest cleanup: could not remove", userId, error instanceof Error ? error.message : error);
    }
  }
  return result;
}
