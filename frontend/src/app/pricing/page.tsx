"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isGuestSession } from "@/lib/guest";
import { supabase } from "@/lib/supabaseClient";
import { startStripeCheckout, type PaidPlan } from "@/lib/billing";
import Spinner from "@/components/ui/spinner";
import { Check } from "lucide-react";
import { PLAN_COPY, PRICING_FINE_PRINT } from "@/config/plans";

const CheckIcon = () => <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#db2777]" strokeWidth={2.5} aria-hidden />;

export default function PricingPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sess = await supabase?.auth.getSession();
      setIsAuthed(!!sess?.data.session && !isGuestSession(sess?.data.session));
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

  const free = PLAN_COPY.find((p) => p.key === "free")!;
  const paid = PLAN_COPY.filter((p) => p.key !== "free");

  return (
    <div className="min-h-screen bg-[#F8F5F1]">
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] text-[#1f1a17] md:text-5xl">Free to create. Pay when guests come.</h1>
          <p className="mt-4 text-lg text-[#5b524c]">Your first guidebook is free. Upgrade for unlimited guest views, more guidebooks and more.</p>
        </div>

        {error && (
          <div className="mx-auto mb-6 max-w-xl rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">{error}</div>
        )}

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {paid.map((plan) => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-[2rem] p-7 sm:p-8 ${
                plan.popular
                  ? "bg-[#fff4f8] shadow-[0_30px_60px_-30px_rgba(219,39,119,0.45)] ring-2 ring-[#db2777]"
                  : "bg-white shadow-[0_30px_60px_-30px_rgba(60,40,30,0.3)] ring-1 ring-black/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1f1a17]">{plan.name}</h2>
                {plan.popular && (
                  <span className="rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-3 py-1 text-xs font-semibold text-white">Most popular</span>
                )}
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-[#5b524c]">{plan.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-5xl font-semibold tracking-[-0.03em] text-[#1f1a17]">${plan.price}</span>
                <span className="text-lg font-medium text-[#5b524c]">/month</span>
              </div>
              <button
                type="button"
                onClick={() => handlePlanSelect(plan.key as PaidPlan)}
                disabled={loadingPlan !== null}
                className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold transition disabled:opacity-60 ${
                  plan.popular
                    ? "bg-gradient-to-r from-[#db2777] to-[#f97316] text-white shadow-[0_10px_24px_-10px_rgba(219,39,119,0.7)] hover:-translate-y-0.5"
                    : "bg-white text-[#1f1a17] ring-1 ring-[#1f1a17]/20 hover:bg-[#faf7f4]"
                }`}
              >
                {loadingPlan === plan.key ? (
                  <span className="flex items-center gap-2"><Spinner size={16} /> Loading…</span>
                ) : isAuthed ? `Get ${plan.name}` : `Sign up for ${plan.name}`}
              </button>
              <div className="my-7 h-px bg-[#1f1a17]/10" />
              {plan.includes && <p className="mb-4 text-[15px] font-semibold text-[#1f1a17]">Everything in {plan.includes} +</p>}
              <ul className="space-y-3 text-[15px] text-[#3d3530]">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3"><CheckIcon /><span>{f}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[2rem] bg-white p-7 shadow-[0_30px_60px_-30px_rgba(60,40,30,0.3)] ring-1 ring-black/5 sm:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[#1f1a17]">{free.name}</h2>
              <p className="mt-2 text-[15px] text-[#5b524c]">{free.tagline}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-[-0.03em] text-[#1f1a17]">$0</span>
                <span className="text-lg font-medium text-[#5b524c]">/month, forever</span>
              </div>
            </div>
            <Link
              href="/onboarding"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#1f1a17] px-8 text-[15px] font-semibold text-white no-underline transition hover:bg-black hover:no-underline md:w-auto"
            >
              {isAuthed ? "Create a guidebook" : "Create your free guidebook"}
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-[#1f1a17]/10 pt-7 text-[15px] text-[#3d3530] sm:grid-cols-2 lg:grid-cols-3">
            {free.features.map((f) => (
              <li key={f} className="flex items-start gap-3"><CheckIcon /><span>{f}</span></li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-3 text-center">
          <p className="text-xs leading-relaxed text-[#8a7f77]">{PRICING_FINE_PRINT}</p>
          <p className="text-sm text-[#5b524c]">
            Need something custom? <Link href="/contact" className="font-medium text-[#be185d] underline-offset-2 hover:underline">Contact us</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
