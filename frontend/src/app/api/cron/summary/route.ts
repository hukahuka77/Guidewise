import { cronAuthorized } from "@/lib/server/cron";
import { getSql } from "@/lib/server/db";
import { isEmailConfigured, sendEmail } from "@/lib/server/email";
import { buildWeeklySummary, summaryRecipients } from "@/lib/server/weeklySummary";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Vercel Cron calls this on Monday mornings to email the admins a summary of the week. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Not found" }, { status: 404 });
  const sql = getSql();
  const to = summaryRecipients();
  if (!sql || !isEmailConfigured() || to.length === 0) return Response.json({ error: "Not configured" }, { status: 503 });
  const summary = await buildWeeklySummary(sql);
  const id = await sendEmail({ to, ...summary });
  return Response.json({ sent: to.length, id });
}
