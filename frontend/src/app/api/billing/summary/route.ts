import { withUser } from "@/lib/server/apiRoute";
import { billingSummary } from "@/lib/server/billingService";
import { getStripe } from "@/lib/server/stripeClient";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Plan, guidebook usage and (when Stripe is configured) subscription and invoices. */
export function GET(request: Request) {
  return withUser(
    request,
    async ({ sql, user }) => Response.json(await billingSummary(sql, getStripe(), user)),
    // Until Stripe is configured here, Flask keeps returning the Stripe details.
    { fallbackOnError: true, needs: () => getStripe() !== null },
  );
}
