import type { GuidebookRow } from "@/lib/guidebook/types";
import { getSql } from "./db";
import { limitReachedResponse, liveGuidebookResponse } from "./guidebookResponse";
import { decideView } from "./usage";

/**
 * Serve a public guidebook, applying the owner's plan: free owners are metered per request and blocked once
 * the month's allowance is used; paid owners are served from the CDN cache and counted by a beacon.
 * Without DATABASE_URL there is no metering.
 */
export async function serveLiveGuidebook(request: Request, gb: GuidebookRow): Promise<Response> {
  const sql = getSql();
  if (!sql) return liveGuidebookResponse(request, gb);
  const decision = await decideView(sql, request, gb.id, gb.user_id);
  if (decision.action === "blocked") return limitReachedResponse();
  return liveGuidebookResponse(request, gb, { cacheable: decision.cacheable, beacon: decision.beacon });
}
