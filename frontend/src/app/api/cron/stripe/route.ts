import { cronAuthorized } from "@/lib/server/cron";
import { getSql } from "@/lib/server/db";
import { getStripe } from "@/lib/server/stripeClient";
import { reconcileStripe } from "@/lib/server/stripeReconcile";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";
export const maxDuration = 300;

/** Vercel Cron calls this nightly to catch plan changes a missed Stripe webhook left behind. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Not found" }, { status: 404 });
  const sql = getSql();
  const stripe = getStripe();
  if (!sql || !stripe) return Response.json({ error: "Not configured" }, { status: 503 });
  const result = await reconcileStripe(sql, stripe);
  // Fixes mean a webhook went missing: worth a look in the logs
  if (result.fixed.length || result.unmatched.length) console.warn("stripe reconcile", JSON.stringify(result));
  else console.log("stripe reconcile", JSON.stringify({ checked: result.checked, manual: result.manual }));
  return Response.json(result);
}
