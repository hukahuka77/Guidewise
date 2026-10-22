"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { startStripeCheckout, type PaidPlan } from "@/lib/billing";
import Spinner from "@/components/ui/spinner";
import { PLAN_COPY, PRICING_FINE_PRINT } from "@/config/plans";

function Check() {
  return (
    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function PricingPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sess = await supabase?.auth.getSession();
      setIsAuthed(!!sess?.data.session);
    })();
  }, []);

  const handlePlanSelect = async (plan: PaidPlan) => {
    setError(null);
    if (!isAuthed) {
      setLoadingPlan(plan);
      window.location.href = `/signup?plan=${plan}`;
      return;
    }
    try {
      setLoadingPlan(plan);
      await startStripeCheckout(plan);
    } catch (e) {
      console.error("Checkout error:", e);
      setError(e instanceof Error ? e.message : "Could not start checkout. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">Free to create. Pay when guests come.</h1>
          <p className="mt-4 text-lg text-gray-600">
            Build as many guidebooks as you like. Upgrade when you want unlimited guest views and more.
          </p>
        </div>

        {error && (
          <div className="max-w-xl mx-auto mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {PLAN_COPY.map((plan) => (
            <div
              key={plan.key}
              className={`bg-white rounded-2xl p-6 flex flex-col relative ${plan.popular ? "border-2 border-[#CC7A52] shadow-lg" : "border shadow-sm"}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#CC7A52] text-white px-3 py-1 rounded-full text-xs font-semibold">
                  POPULAR
                </div>
              )}
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                <p className="text-gray-600 mt-1 text-sm">{plan.tagline}</p>
              </div>
              <div className="text-4xl font-extrabold text-gray-900">
                ${plan.price}
                <span className="text-lg font-medium text-gray-500">/mo</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-gray-700 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {plan.key === "free" ? (
                  <Link href={isAuthed ? "/onboarding" : "/signup"}>
                    <Button variant="outline" className="w-full">{isAuthed ? "Create a guidebook" : "Start free"}</Button>
                  </Link>
                ) : (
                  <Button
                    className={`w-full ${plan.popular ? "bg-[#CC7A52] hover:bg-[#B86B45]" : ""}`}
                    onClick={() => handlePlanSelect(plan.key as PaidPlan)}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === plan.key ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner size={16} />
                        Loading...
                      </span>
                    ) : isAuthed ? (
                      `Get ${plan.name}`
                    ) : (
                      `Sign up for ${plan.name}`
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto text-center mt-12 space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">{PRICING_FINE_PRINT}</p>
          <p className="text-sm text-gray-600">
            Need something custom? <Link href="/#contact" className="underline text-[#CC7A52]">Contact us</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
