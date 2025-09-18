"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { startStripeCheckout, startAddonCheckout } from "@/lib/billing";

export default function PricingPage() {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const sess = await supabase?.auth.getSession();
      setIsAuthed(!!sess?.data.session);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      <section className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">Simple, fair pricing</h1>
          <p className="mt-3 text-gray-600">Start free. Upgrade anytime to unlock unlimited hosting and premium templates. Need more than one guidebook? Add extra guidebooks for just $3/month each.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mt-10 items-stretch">
          {/* Free Plan */}
          <div className="bg-white border rounded-2xl shadow-sm p-6 md:p-8 flex flex-col min-h-[460px]">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Free</h2>
              <p className="text-gray-600 mt-1">Great for trying Guidewise</p>
            </div>
            <div className="text-4xl font-extrabold text-gray-900">$0<span className="text-lg font-medium text-gray-500">/mo</span></div>
            <ul className="mt-6 space-y-3 text-gray-700">
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Basic PDF download</li>
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Guidebook hosting for 14 days</li>
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Core features to get started</li>
            </ul>
            <div className="mt-auto pt-4">
              {isAuthed ? (
                <Link href="/dashboard">
                  <Button className="w-full" variant="outline">Get Started for Free</Button>
                </Link>
              ) : (
                <Link href="/signup">
                  <Button className="w-full" variant="outline">Get Started for Free</Button>
                </Link>
              )}
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-white border rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 md:p-8 flex flex-col relative min-h-[460px]">
            <div className="absolute -top-3 right-6 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Most Popular</div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Pro</h2>
              <p className="text-gray-600 mt-1">For active hosts who want more</p>
            </div>
            <div className="text-4xl font-extrabold text-gray-900">$7<span className="text-lg font-medium text-gray-500">/mo</span></div>
            <ul className="mt-6 space-y-3 text-gray-700">
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Unlimited guidebook hosting while subscribed</li>
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Full suite of premium PDF templates</li>
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> QR code PDFs</li>
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Live preview & share links</li>
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Publish snapshots</li>
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Priority support</li>
              <li className="flex items-center gap-2"><svg className="w-5 h-5 text-emerald-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Each additional guidebook just $3/mo</li>
            </ul>
            {isAuthed && (
              <div className="mt-4 text-center">
                <div className="text-sm text-gray-600 mb-2">Need another guidebook? Add another for just $3/mo</div>
                <Button variant="outline" className="w-full" onClick={() => { void startAddonCheckout(); }}>Add guidebook</Button>
              </div>
            )}
            <div className="mt-auto pt-4">
              <Button className="w-full"  onClick={() => { void startStripeCheckout(); }}>Upgrade to Pro</Button>
            </div>

          </div>
        </div>

        {/* Comparison section removed per product decision */}

        {/* FAQ / footer blurb */}
        <div className="max-w-3xl mx-auto text-center text-gray-600 mt-12">
          <p>All prices in USD. Cancel anytime. Your guidebooks stay live on Pro for as long as your subscription is active.</p>
        </div>
      </section>
    </div>
  );
}
