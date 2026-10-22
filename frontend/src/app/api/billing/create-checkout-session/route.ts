import { readJson, withUser } from "@/lib/server/apiRoute";
import { createCheckoutSession } from "@/lib/server/billingService";
import { SITE_ORIGIN } from "@/lib/server/env";
import { getStripe } from "@/lib/server/stripeClient";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Start a Stripe Checkout session for a paid plan. */
export function POST(request: Request) {
  return withUser(
    request,
    async ({ sql, user }) => {
      const stripe = getStripe();
      if (!stripe) return Response.json({ error: "Stripe not configured" }, { status: 500 });
      const origin = SITE_ORIGIN || new URL(request.url).origin;
      return Response.json(await createCheckoutSession(sql, stripe, user, await readJson(request), origin));
    },
    { needs: () => getStripe() !== null },
  );
}
