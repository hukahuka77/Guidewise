/**
 * Promotion Configuration
 *
 * The Summer Sale (90% off the first year) belonged to the previous pricing and has ended, so the banner
 * is off. To run a new promotion, set `enabled` and fill in the copy; src/app/page.tsx renders the banner.
 */

export const PROMOTION_CONFIG = {
  enabled: false,

  badge: "",
  campaignName: "",
  discountPercent: "",
  endDateText: "",
  billingTermNote: "",
} as const;

export type PromotionConfig = typeof PROMOTION_CONFIG;
