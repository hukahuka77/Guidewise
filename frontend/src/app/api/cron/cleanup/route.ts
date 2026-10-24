import { cronAuthorized } from "@/lib/server/cron";
import { getSql } from "@/lib/server/db";
import { cleanupAbandonedGuests } from "@/lib/server/guestCleanup";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";
export const maxDuration = 300;

/** Vercel Cron calls this weekly; nobody else can run it. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Not found" }, { status: 404 });
  const sql = getSql();
  if (!sql) return Response.json({ error: "Not configured" }, { status: 503 });
  const result = await cleanupAbandonedGuests(sql);
  console.log("guest cleanup", JSON.stringify(result));
  return Response.json(result);
}
