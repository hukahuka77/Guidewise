"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { startStripeCheckout } from "@/lib/billing";
import Spinner from "@/components/ui/spinner";
import { PROMOTION_CONFIG } from "@/config/promotion";

export default function PricingPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<'starter' | 'growth' | 'pro' | null>(null);

  useEffect(() => {
    (async () => {
      const sess = await supabase?.auth.getSession();
      setIsAuthed(!!sess?.data.session);
    })();
  }, []);

  const handlePlanSelect = async (plan: 'starter' | 'growth' | 'pro') => {
    if (!isAuthed) {
      // Redirect to signup with plan in query param
      setLoadingPlan(plan);
      window.location.href = `/signup?plan=${plan}`;
      return;
    }
    try {
      setLoadingPlan(plan);
      await startStripeCheckout(plan);
    } catch (error) {
      console.error('Checkout error:', error);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">Simple, Transparent Pricing</h1>
          <p className="mt-4 text-lg text-gray-600">Choose the plan that fits your needs. All plans include AI content generation, custom templates, and unlimited previews.</p>
        </div>

        {/* Promotion Banner */}
        {PROMOTION_CONFIG.enabled && (
          <div className="max-w-4xl mx-auto mb-10">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-600 to-orange-500 p-8 shadow-xl">
              {/* Badge */}
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                LIMITED TIME
              </div>
              
              {/* Content */}
              <div className="text-center text-white">
                <h2 className="text-3xl md:text-4xl font-extrabold mb-2">
                  {PROMOTION_CONFIG.badge}
                </h2>
                <p className="text-xl md:text-2xl font-semibold mb-1 text-white/95">
                  Get {PROMOTION_CONFIG.discountPercent}% off your first year!
                </p>
                <p className="text-2xl md:text-3xl font-bold mt-3">
                  Starting at just ${PROMOTION_CONFIG.starter.promoPrice}/month
                </p>
                <p className="mt-4 text-sm text-white/90">
                  Choose any plan below to claim your exclusive Black Friday discount
                </p>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-6 items-stretch">
          {/* Starter Plan */}
          <div className="bg-white border rounded-2xl shadow-sm p-6 flex flex-col relative">
            {PROMOTION_CONFIG.enabled && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-pink-600 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                {PROMOTION_CONFIG.discountPercent}% OFF
              </div>
            )}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Starter</h2>
              <p className="text-gray-600 mt-1">Perfect for individuals</p>
            </div>
            {PROMOTION_CONFIG.enabled ? (
              <div>
                <div className="relative inline-block">
                  <div className="text-3xl font-bold text-gray-400">
                    ${PROMOTION_CONFIG.starter.originalPrice}<span className="text-base font-medium">/mo</span>
                  </div>
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-black"></div>
                  </div>
                </div>
                <div className="text-4xl font-extrabold text-gray-900 mt-2">
                  ${PROMOTION_CONFIG.starter.promoPrice}<span className="text-lg font-medium text-gray-500">/mo</span>
                </div>
                <div className="text-xs text-pink-600 font-semibold mt-1">First year only</div>
              </div>
            ) : (
              <div className="text-4xl font-extrabold text-gray-900">${PROMOTION_CONFIG.starter.originalPrice}<span className="text-lg font-medium text-gray-500">/mo</span></div>
            )}
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
              <Button 
                className="w-full" 
                onClick={() => handlePlanSelect('starter')}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === 'starter' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size={16} />
                    Loading...
                  </span>
                ) : (
                  isAuthed ? 'Get Starter' : 'Sign Up for Starter'
                )}
              </Button>
            </div>
          </div>

          {/* Growth Plan */}
          <div className="bg-white border-2 border-[#CC7A52] rounded-2xl shadow-lg p-6 flex flex-col relative">
            {PROMOTION_CONFIG.enabled && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-pink-600 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                {PROMOTION_CONFIG.discountPercent}% OFF
              </div>
            )}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Growth</h2>
              <p className="text-gray-600 mt-1">For growing hosts</p>
            </div>
            {PROMOTION_CONFIG.enabled ? (
              <div>
                <div className="relative inline-block">
                  <div className="text-3xl font-bold text-gray-400">
                    ${PROMOTION_CONFIG.growth.originalPrice}<span className="text-base font-medium">/mo</span>
                  </div>
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-black"></div>
                  </div>
                </div>
                <div className="text-4xl font-extrabold text-gray-900 mt-2">
                  ${PROMOTION_CONFIG.growth.promoPrice}<span className="text-lg font-medium text-gray-500">/mo</span>
                </div>
                <div className="text-xs text-pink-600 font-semibold mt-1">First year only</div>
              </div>
            ) : (
              <div className="text-4xl font-extrabold text-gray-900">${PROMOTION_CONFIG.growth.originalPrice}<span className="text-lg font-medium text-gray-500">/mo</span></div>
            )}
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
              <Button 
                className="w-full bg-[#CC7A52] hover:bg-[#B86B45]" 
                onClick={() => handlePlanSelect('growth')}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === 'growth' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size={16} />
                    Loading...
                  </span>
                ) : (
                  isAuthed ? 'Get Growth' : 'Sign Up for Growth'
                )}
              </Button>
            </div>
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-[#CC7A52] text-white px-3 py-1 rounded-full text-xs font-semibold">
              POPULAR
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-white border rounded-2xl shadow-sm p-6 flex flex-col relative">
            {PROMOTION_CONFIG.enabled && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-pink-600 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                {PROMOTION_CONFIG.discountPercent}% OFF
              </div>
            )}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Pro</h2>
              <p className="text-gray-600 mt-1">For professionals</p>
            </div>
            {PROMOTION_CONFIG.enabled ? (
              <div>
                <div className="relative inline-block">
                  <div className="text-3xl font-bold text-gray-400">
                    ${PROMOTION_CONFIG.pro.originalPrice}<span className="text-base font-medium">/mo</span>
                  </div>
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-black"></div>
                  </div>
                </div>
                <div className="text-4xl font-extrabold text-gray-900 mt-2">
                  ${PROMOTION_CONFIG.pro.promoPrice}<span className="text-lg font-medium text-gray-500">/mo</span>
                </div>
                <div className="text-xs text-pink-600 font-semibold mt-1">First year only</div>
              </div>
            ) : (
              <div className="text-4xl font-extrabold text-gray-900">${PROMOTION_CONFIG.pro.originalPrice}<span className="text-lg font-medium text-gray-500">/mo</span></div>
            )}
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
              <Button 
                className="w-full" 
                onClick={() => handlePlanSelect('pro')}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === 'pro' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size={16} />
                    Loading...
                  </span>
                ) : (
                  isAuthed ? 'Get Pro' : 'Sign Up for Pro'
                )}
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
