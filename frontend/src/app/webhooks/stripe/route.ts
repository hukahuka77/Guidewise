import { notConfigured } from "@/lib/server/apiRoute";
import { handleStripeEvent } from "@/lib/server/billingService";
import { getSql } from "@/lib/server/db";
import { getStripe, webhookVerifier } from "@/lib/server/stripeClient";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/**
 * Stripe webhook. The signature is verified against the raw request body before anything is
 * processed. Needs STRIPE_WEBHOOK_SECRET and DATABASE_URL.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sql = getSql();
  if (!secret || !sql) return notConfigured();

  const payload = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("stripe-signature") || "";

  let event;
  try {
    event = webhookVerifier().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Webhook error: ${detail}` }, { status: 400 });
  }

  try {
    await handleStripeEvent(sql, getStripe(), event);
  } catch (error) {
    // Fail so Stripe retries: the updates are idempotent, and a swallowed error would leave a
    // paying customer on the wrong plan.
    console.error(`stripe webhook ${event.type} (${event.id}) failed`, error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
