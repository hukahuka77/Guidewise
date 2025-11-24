/**
 * Promotion Configuration
 * 
 * Centralized config for active promotions displayed on the pricing page.
 * Set NEXT_PUBLIC_PROMO_ENABLED="true" or "false" in your hosting provider to toggle.
 * Edit the values below to change promotion details.
 */

export const PROMOTION_CONFIG = {
  // Toggle via environment variable (defaults to true if not set)
  enabled: process.env.NEXT_PUBLIC_PROMO_ENABLED === "true" || 
           process.env.NEXT_PUBLIC_PROMO_ENABLED === undefined,
  
  // Promotion details
  badge: "🎉 BLACK FRIDAY",
  discountPercent: "90",
  
  // Pricing for each plan (promotional prices)
  starter: {
    promoPrice: "0.99",
    originalPrice: "9.99",
  },
  growth: {
    promoPrice: "1.99",
    originalPrice: "19.99",
  },
  pro: {
    promoPrice: "2.99",
    originalPrice: "29.99",
  },
} as const;

export type PromotionConfig = typeof PROMOTION_CONFIG;
