import Link from "next/link";
import { PLAN_COPY } from "@/config/plans";

export default function Pricing() {
  return (
    <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
      <div className="container px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-4">Free to create. Pay when guests come.</h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Build as many guidebooks as you like. Upgrade for unlimited guest views, more PDF layouts and analytics.
        </p>
        <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2 md:gap-8">
          {PLAN_COPY.map((plan) => (
            <div
              key={plan.key}
              className={`grid gap-1 p-6 rounded-lg bg-white hover:shadow-lg transition-shadow relative ${plan.popular ? "border-2 border-[#CC7A52]" : "border"}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#CC7A52] text-white px-3 py-1 rounded-full text-xs font-semibold">
                  POPULAR
                </div>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-sm text-gray-500">{plan.tagline}</p>
              <div className="text-4xl font-bold mt-4">${plan.price}</div>
              <p className="text-sm text-gray-500">per month</p>
              <ul className="grid gap-2 mt-4 text-sm">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 mt-8">
          <Link href="/pricing" className="underline">See full pricing details</Link>
        </p>
      </div>
    </section>
  );
}
