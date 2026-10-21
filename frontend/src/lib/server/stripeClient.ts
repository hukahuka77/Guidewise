import Stripe from "stripe";

// Same Stripe API version the Flask backend's SDK used, so response shapes do not change.
export const STRIPE_API_VERSION = "2025-07-30.basil";

let client: Stripe | null | undefined;

/** Stripe client from STRIPE_SECRET_KEY, or null when billing is not configured. */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key, { apiVersion: STRIPE_API_VERSION as never }) : null;
  return client;
}

/** Test hook: inject a fake client (or reset with undefined). */
export function setStripeForTests(next: Stripe | null | undefined): void {
  client = next;
}

/** Signature verification only needs a Stripe instance, not an API key. */
export function webhookVerifier(): Stripe {
  return getStripe() ?? new Stripe("sk_unused_for_webhook_verification", { apiVersion: STRIPE_API_VERSION as never });
}
