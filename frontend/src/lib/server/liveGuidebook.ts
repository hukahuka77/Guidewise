import type { GuidebookRow } from "@/lib/guidebook/types";
import { getSql } from "./db";
import { isGuestUser } from "./guestAccounts";
import { guidebookResponse, limitReachedResponse, notSavedResponse } from "./guidebookResponse";
import { decideView } from "./usage";

/**
 * Serve a guidebook, applying the owner's plan: free owners are metered per request and blocked once
 * the month's allowance is used; paid owners are served from the CDN cache and counted by a beacon.
 * A guest's guidebook (made before signing up) isn't shown until they create an account.
 * Without DATABASE_URL there is no metering.
 */
export async function serveGuidebook(request: Request, gb: GuidebookRow): Promise<Response> {
  const sql = getSql();
  if (!sql) return guidebookResponse(request, gb);
  if (await isGuestUser(sql, gb.user_id)) return notSavedResponse();
  const decision = await decideView(sql, request, gb.id, gb.user_id);
  if (decision.action === "blocked") return limitReachedResponse();
  return guidebookResponse(request, gb, { cacheable: decision.cacheable, beacon: decision.beacon });
}
