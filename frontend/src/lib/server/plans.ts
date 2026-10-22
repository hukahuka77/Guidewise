/** Plan catalogue (port of PLAN_CONFIGS in backend/app.py). `guidebookLimit: null` = unlimited. */
export interface PlanConfig {
  name: string;
  /** Environment variable holding the Stripe price id for this plan (null = not purchasable). */
  priceEnv: string | null;
  guidebookLimit: number | null;
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  trial: { name: "Trial", priceEnv: null, guidebookLimit: 0 },
  starter: { name: "Starter", priceEnv: "STRIPE_STARTER_PRICE_ID", guidebookLimit: 1 },
  growth: { name: "Growth", priceEnv: "STRIPE_GROWTH_PRICE_ID", guidebookLimit: 3 },
  pro: { name: "Pro", priceEnv: "STRIPE_PRO_PRICE_ID", guidebookLimit: 10 },
  enterprise: { name: "Enterprise", priceEnv: null, guidebookLimit: null },
};

/** Guidebook limits per plan, used by the guidebook routes. */
export const PLAN_GUIDEBOOK_LIMITS: Record<string, number | null> = Object.fromEntries(
  Object.entries(PLAN_CONFIGS).map(([key, plan]) => [key, plan.guidebookLimit]),
);

/** Stripe price id for a plan, read at call time so deployments can change it without a code change. */
export function planPriceId(plan: string): string | null {
  const env = PLAN_CONFIGS[plan]?.priceEnv;
  return (env && process.env[env]) || null;
}

/** Map a Stripe price id back to the plan that sells it. */
export function planForPriceId(priceId: string | undefined | null): string | null {
  if (!priceId) return null;
  for (const key of Object.keys(PLAN_CONFIGS)) {
    if (planPriceId(key) === priceId) return key;
  }
  return null;
}
