/**
 * Plan catalogue. Guidebooks are free to create; plans differ in how many guidebooks you can keep,
 * how many guest views per month they get, and a few features. `null` = unlimited.
 */
export interface PlanConfig {
  key: string;
  name: string;
  /** Environment variable holding the Stripe price id for this plan (null = not purchasable). */
  priceEnv: string | null;
  priceUsd: number;
  /** Total guidebooks the account can hold (not advertised on the pricing page, fine print only). */
  guidebookLimit: number | null;
  /** Guest views per calendar month (UTC), summed across all of the account's guidebooks. */
  viewsPerMonth: number | null;
  /** AI recommendation generations per calendar month. */
  aiPerMonth: number | null;
  /** PDF templates the account may download (`null` = all, including the QR poster). */
  pdfTemplates: string[] | null;
  printPdf: boolean;
  /** Per-guidebook view analytics (daily series). */
  analytics: boolean;
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: {
    key: "free",
    name: "Free",
    priceEnv: null,
    priceUsd: 0,
    guidebookLimit: null,
    viewsPerMonth: 30,
    aiPerMonth: 3,
    pdfTemplates: ["template_pdf_original"],
    printPdf: false,
    analytics: false,
  },
  starter: {
    key: "starter",
    name: "Starter",
    priceEnv: "STRIPE_STARTER_PRICE_ID",
    priceUsd: 5,
    guidebookLimit: 5,
    viewsPerMonth: null,
    aiPerMonth: 30,
    pdfTemplates: null,
    printPdf: true,
    analytics: false,
  },
  power: {
    key: "power",
    name: "Power",
    priceEnv: "STRIPE_POWER_PRICE_ID",
    priceUsd: 15,
    guidebookLimit: 100,
    viewsPerMonth: null,
    aiPerMonth: 150,
    pdfTemplates: null,
    printPdf: true,
    analytics: true,
  },
  pro: {
    key: "pro",
    name: "Pro",
    priceEnv: "STRIPE_PRO_PRICE_ID",
    priceUsd: 30,
    guidebookLimit: null,
    viewsPerMonth: null,
    aiPerMonth: 500, // fair-use ceiling
    pdfTemplates: null,
    printPdf: true,
    analytics: true,
  },
};

/** Plan names stored by earlier versions of the app. */
const LEGACY_PLAN_ALIASES: Record<string, string> = { trial: "free", growth: "power", enterprise: "pro" };

/** Map whatever is stored in `profiles.plan` (or a request) to a current plan key; unknown values are free. */
export function normalizePlan(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value in PLAN_CONFIGS) return value;
  return LEGACY_PLAN_ALIASES[value] ?? "free";
}

export const planConfig = (raw: unknown): PlanConfig => PLAN_CONFIGS[normalizePlan(raw)];

/** Plans that can be bought through Stripe checkout. */
export const PURCHASABLE_PLANS = Object.keys(PLAN_CONFIGS).filter((k) => PLAN_CONFIGS[k].priceEnv);

/** Stripe price id for a plan, read at call time so deployments can change it without a code change. */
export function planPriceId(plan: string): string | null {
  const env = PLAN_CONFIGS[plan]?.priceEnv;
  return (env && process.env[env]) || null;
}

/** Map a Stripe price id back to the plan that sells it. */
export function planForPriceId(priceId: string | undefined | null): string | null {
  if (!priceId) return null;
  for (const key of PURCHASABLE_PLANS) {
    if (planPriceId(key) === priceId) return key;
  }
  return null;
}

/** Cheapest plan that unlocks a PDF template / print PDF (used in upgrade messages). */
export const PDF_UPGRADE_PLAN = "starter";
