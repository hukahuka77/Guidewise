/**
 * Plan copy shown on the pricing page and the home page. Limits themselves live in
 * src/lib/server/plans.ts; keep the two in step. The Starter guidebook cap is deliberately
 * not advertised (it is in the fine print only).
 */
export type PlanKey = "free" | "starter" | "power" | "pro";

export interface PlanCopy {
  key: PlanKey;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  popular?: boolean;
}

export const PLAN_COPY: PlanCopy[] = [
  {
    key: "free",
    name: "Free",
    price: 0,
    tagline: "Everything you need to try Guidewise",
    features: [
      "Unlimited guidebooks",
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
    features: [
      "Unlimited guest views",
      "Print-ready PDF of your guidebook",
      "30 AI recommendation runs / month",
      "Everything in Free",
    ],
  },
  {
    key: "power",
    name: "Power",
    price: 15,
    tagline: "For growing portfolios",
    popular: true,
    features: [
      "Up to 100 guidebooks",
      "Premium guidebook styles: Lifestyle and Welcoming",
      "View analytics for every guidebook",
      "150 AI recommendation runs / month",
      "Everything in Starter",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 30,
    tagline: "For professional property managers",
    features: [
      "Unlimited guidebooks",
      "Highest AI allowance (500 runs / month)",
      "Priority support",
      "Everything in Power",
    ],
  },
];

export const PRICING_FINE_PRINT =
  "Guest views are counted per visitor (each visitor counts once per guidebook per day, and search engines and link previews are not counted) across all of your guidebooks, each calendar month. When a Free account reaches its monthly views, its guidebooks show a temporary \"unavailable\" notice to guests until the next month or until the host upgrades. Starter includes up to 5 guidebooks and Power up to 100. Free and Starter guidebooks use the Signature style; the Lifestyle and Welcoming styles come with Power and Pro. AI allowances reset monthly. Prices in USD, billed monthly. Cancel anytime; guidebooks stay online on the Free plan.";
