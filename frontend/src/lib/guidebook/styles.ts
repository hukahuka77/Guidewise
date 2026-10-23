// Guidebook styles (templates) and which are premium. Shared by the server (enforcement) and the UI (locks).

/** Every plan gets Signature; the other styles come with Power and Pro. */
export const PREMIUM_STYLE_KEYS = ["template_generic", "template_lifestyle", "template_welcomebook"];

/** The cheapest plan with premium styles, for upgrade messages. */
export const PREMIUM_STYLE_PLAN = "Power";

export const isPremiumStyle = (key: unknown): boolean => typeof key === "string" && PREMIUM_STYLE_KEYS.includes(key);

export const PREMIUM_STYLE_MESSAGE = `Lifestyle and Welcoming are premium styles, included with the ${PREMIUM_STYLE_PLAN} and Pro plans.`;
