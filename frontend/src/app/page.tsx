import Link from "next/link";
import Hero from "@/components/home/Hero";
import GuestTexts from "@/components/home/GuestTexts";
import HowItWorks from "@/components/home/HowItWorks";
import Features from "@/components/home/Features";
import StyleFan from "@/components/home/StyleFan";
import FreeForever from "@/components/home/FreeForever";
import { PROMOTION_CONFIG } from "@/config/promotion";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Promotional Banner */}
      {PROMOTION_CONFIG.enabled && (
        <div className="bg-gradient-to-r from-pink-600 to-orange-500 text-white py-3 px-4 text-center">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <span className="font-bold text-lg">{PROMOTION_CONFIG.badge}</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-sm sm:text-base">
              {PROMOTION_CONFIG.discountPercent}% off until {PROMOTION_CONFIG.endDateText}
            </span>
            <Link
              href="/pricing"
              className="mt-2 sm:mt-0 bg-white text-pink-600 px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              View Plans
            </Link>
          </div>
        </div>
      )}

      {/* The page is a scroll story: the live guidebook, the texts it replaces, how it's made, what it
          does, the styles, and the free plan. */}
      <main className="flex-1">
        <Hero />
        <GuestTexts />
        <HowItWorks />
        <Features />
        <StyleFan />
        <FreeForever />
      </main>
    </div>
  );
}
