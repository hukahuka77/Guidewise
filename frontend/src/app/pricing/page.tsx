"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { startStripeCheckout } from "@/lib/billing";

export default function PricingPage() {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const sess = await supabase?.auth.getSession();
      setIsAuthed(!!sess?.data.session);
    })();
  }, []);

  const handlePlanSelect = (plan: 'starter' | 'growth' | 'pro') => {
    if (!isAuthed) {
      // Redirect to signup with plan in query param
      window.location.href = `/signup?plan=${plan}`;
      return;
    }
    void startStripeCheckout(plan);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">Simple, Transparent Pricing</h1>
          <p className="mt-4 text-lg text-gray-600">Choose the plan that fits your needs. All plans include AI content generation, custom templates, and unlimited previews.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-6 items-stretch">
          {/* Starter Plan */}
          <div className="bg-white border rounded-2xl shadow-sm p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Starter</h2>
              <p className="text-gray-600 mt-1">Perfect for individuals</p>
            </div>
            <div className="text-4xl font-extrabold text-gray-900">$9.99<span className="text-lg font-medium text-gray-500">/mo</span></div>
            <ul className="mt-6 space-y-3 text-sm text-gray-700 flex-1">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span><strong>1 Active Guidebook</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>AI Content Generation</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>All Templates</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>PDF Export</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Unlimited Previews</span>
              </li>
            </ul>
            <div className="mt-6">
              <Button className="w-full" onClick={() => handlePlanSelect('starter')}>
                {isAuthed ? 'Get Starter' : 'Sign Up for Starter'}
              </Button>
            </div>
          </div>

          {/* Growth Plan */}
          <div className="bg-white border-2 border-[#CC7A52] rounded-2xl shadow-lg p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#CC7A52] text-white px-3 py-1 rounded-full text-xs font-semibold">
              POPULAR
            </div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Growth</h2>
              <p className="text-gray-600 mt-1">For growing hosts</p>
            </div>
            <div className="text-4xl font-extrabold text-gray-900">$19.99<span className="text-lg font-medium text-gray-500">/mo</span></div>
            <ul className="mt-6 space-y-3 text-sm text-gray-700 flex-1">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span><strong>3 Active Guidebooks</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>AI Content Generation</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>All Templates</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>PDF Export</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Unlimited Previews</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Priority Support</span>
              </li>
            </ul>
            <div className="mt-6">
              <Button className="w-full bg-[#CC7A52] hover:bg-[#B86B45]" onClick={() => handlePlanSelect('growth')}>
                {isAuthed ? 'Get Growth' : 'Sign Up for Growth'}
              </Button>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-white border rounded-2xl shadow-sm p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Pro</h2>
              <p className="text-gray-600 mt-1">For professionals</p>
            </div>
            <div className="text-4xl font-extrabold text-gray-900">$29.99<span className="text-lg font-medium text-gray-500">/mo</span></div>
            <ul className="mt-6 space-y-3 text-sm text-gray-700 flex-1">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span><strong>10 Active Guidebooks</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>AI Content Generation</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>All Templates</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>PDF Export</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Unlimited Previews</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Priority Support</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Custom Branding</span>
              </li>
            </ul>
            <div className="mt-6">
              <Button className="w-full" onClick={() => handlePlanSelect('pro')}>
                {isAuthed ? 'Get Pro' : 'Sign Up for Pro'}
              </Button>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border rounded-2xl shadow-sm p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Enterprise</h2>
              <p className="text-gray-600 mt-1">For large teams</p>
            </div>
            <div className="text-3xl font-extrabold text-gray-900">Custom<span className="text-lg font-medium text-gray-500 block mt-1">Contact us</span></div>
            <ul className="mt-6 space-y-3 text-sm text-gray-700 flex-1">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span><strong>Unlimited Guidebooks</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Everything in Pro</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Dedicated Support</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>API Access</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Custom Integrations</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>SLA Agreement</span>
              </li>
            </ul>
            <div className="mt-6">
              <Link href="/#contact">
                <Button variant="outline" className="w-full">Contact Sales</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="max-w-4xl mx-auto text-center mt-12">
          <p className="text-gray-600 mb-4">All plans include unlimited draft guidebooks in preview mode (with watermark). Activate what you need, when you need it.</p>
          <p className="text-sm text-gray-500">All prices in USD. Cancel anytime. No hidden fees.</p>
        </div>
      </section>
    </div>
  );
}
