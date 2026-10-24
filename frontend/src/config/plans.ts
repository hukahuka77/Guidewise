/**
 * Plan copy shown on the pricing page and the home page. Limits themselves live in
 * src/lib/server/plans.ts; keep the two in step.
 */
export type PlanKey = "free" | "starter" | "power" | "pro";

export interface PlanCopy {
  key: PlanKey;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  /** The plan whose features this one also has ("Everything in Free +"). */
  includes?: string;
  popular?: boolean;
}

export const PLAN_COPY: PlanCopy[] = [
  {
    key: "free",
    name: "Free",
    price: 0,
    tagline: "Everything you need to share a guidebook. No credit card, no trial clock.",
    features: [
      "1 guidebook",
      "30 guest views per month",
      "Signature guidebook style",
      "AI content and place recommendations (3 runs / month)",
      "Airbnb & VRBO listing import",
    ],
  },
  {
    key: "starter",
    name: "Starter",
    price: 5,
    tagline: "For hosts with a place or two",
    includes: "Free",
    features: [
      "Unlimited guest views on up to 3 guidebooks",
      "Download your guidebook as a PDF",
      "15 AI recommendation runs / month",
    ],
  },
  {
    key: "power",
    name: "Power",
    price: 15,
    tagline: "For growing portfolios",
    includes: "Starter",
    popular: true,
    features: [
      "Up to 15 guidebooks",
      "Premium guidebook styles: Lifestyle and Welcoming",
      "View analytics for every guidebook",
      "50 AI recommendation runs / month",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 39,
    tagline: "For professional property managers",
    includes: "Power",
    features: [
      "Up to 50 guidebooks",
      "150 AI recommendation runs / month",
      "Priority support",
    ],
  },
];

export const PRICING_FINE_PRINT =
  "Guest views are counted per visitor (each visitor counts once per guidebook per day, and search engines and link previews are not counted) across all of your guidebooks, each calendar month. When a Free account reaches its monthly views, its guidebooks show a temporary \"unavailable\" notice to guests until the next month or until the host upgrades. If you move to a plan with fewer guidebooks, your oldest ones stay live and the rest are paused for guests (you can still edit them) until you upgrade. Need more than 50 guidebooks? Contact us for a custom plan. Free and Starter guidebooks use the Signature style; the Lifestyle and Welcoming styles come with Power and Pro. AI allowances reset monthly. Prices in USD, billed monthly. Cancel anytime; guidebooks stay online on the Free plan.";
