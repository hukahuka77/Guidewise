import { withUser } from "@/lib/server/apiRoute";
import { billingSummary } from "@/lib/server/billingService";
import { getStripe } from "@/lib/server/stripeClient";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Plan, guidebook usage and (when Stripe is configured) subscription and invoices. */
export function GET(request: Request) {
  // Without Stripe keys the plan and usage still load; only the subscription and invoices are left out.
  return withUser(request, async ({ sql, user }) => Response.json(await billingSummary(sql, getStripe(), user)), { fallbackOnError: true });
}
