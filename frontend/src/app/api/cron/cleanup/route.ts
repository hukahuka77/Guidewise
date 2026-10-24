import { timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/server/db";
import { cleanupAbandonedGuests } from "@/lib/server/guestCleanup";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";
export const maxDuration = 300;

/** Vercel Cron calls this daily with `Authorization: Bearer $CRON_SECRET`; nobody else can run it. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") || "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Not found" }, { status: 404 });
  const sql = getSql();
  if (!sql) return Response.json({ error: "Not configured" }, { status: 503 });
  const result = await cleanupAbandonedGuests(sql);
  console.log("guest cleanup", JSON.stringify(result));
  return Response.json(result);
}
