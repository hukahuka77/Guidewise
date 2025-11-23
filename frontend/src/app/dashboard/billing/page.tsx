"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type InvoiceItem = {
  id: string;
  status?: string | null;
  paid?: boolean | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  created?: number | null;
  currency?: string | null;
  hosted_invoice_url?: string | null;
};

type BillingSummary = {
  plan: "trial" | "starter" | "growth" | "pro" | "enterprise" | string;
  guidebook_limit: number | null;
  active_guidebooks: number;
  can_activate_more: boolean;
  plan_display: string;
  stripe: {
    customer_id: string | null;
    subscription: { id: string; status?: string | null; current_period_end?: number | null } | null;
    upcoming_invoice: { amount_due?: number | null; next_payment_attempt?: number | null; currency?: string | null } | null;
    invoices: InvoiceItem[];
  };
  error?: string;
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Handle success banner from portal return
  useEffect(() => {
    const updated = searchParams?.get('updated');
    if (updated === '1') {
      setShowSuccessBanner(true);
      // Clean up URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('updated');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (!supabase) throw new Error("Supabase not initialized");
        const sess = await supabase.auth.getSession();
        const token = sess.data.session?.access_token || null;
        if (!token) throw new Error("Not authenticated");
        const res = await fetch(`${API_BASE}/api/billing/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as BillingSummary;
        if (!cancelled) setSummary(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load billing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPortal = async () => {
    if (!API_BASE) return;
    setPortalLoading(true);
    try {
      if (!supabase) throw new Error("Supabase not initialized");
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || undefined;
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token || null;
      const res = await fetch(`${API_BASE}/api/billing/create-portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to open billing portal (${res.status})`);
      if (json.url) window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open billing portal");
      setPortalLoading(false);
    }
  };

  const money = (cents?: number | null, currency?: string | null) => {
    if (typeof cents !== "number") return "-";
    const amount = (cents / 100).toFixed(2);
    return `${amount} ${(currency || "USD").toUpperCase()}`;
    };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Billing</h1>
            <p className="text-gray-600 mt-1">Manage your subscription and invoices</p>
          </div>
        </div>

        {showSuccessBanner && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-green-800">Subscription Updated Successfully</p>
                <p className="text-sm text-green-700 mt-0.5">Your plan changes have been applied. Your new limits are now active.</p>
              </div>
            </div>
            <button
              onClick={() => setShowSuccessBanner(false)}
              className="text-green-600 hover:text-green-800"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border p-6 text-gray-700 flex items-center gap-3">
            <Spinner size={20} />
            <span>Loading…</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm text-gray-600">Current Plan</div>
                  <div className="mt-1 font-semibold text-2xl text-gray-800">
                    {summary.plan_display}
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="text-sm text-gray-600">
                      {summary.plan === 'trial' || summary.guidebook_limit === 0 ? (
                        <span className="font-semibold text-amber-700">Preview only</span>
                      ) : summary.guidebook_limit === null ? (
                        <span className="font-semibold text-green-700">Unlimited active guidebooks</span>
                      ) : (
                        <span>
                          <span className="font-semibold">{summary.active_guidebooks} / {summary.guidebook_limit}</span> guidebooks active
                        </span>
                      )}
                    </div>
                    {summary.stripe.subscription?.current_period_end && (
                      <div className="text-xs text-gray-500">
                        Renews {new Date((summary.stripe.subscription.current_period_end as number) * 1000).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {summary.plan !== 'trial' && (
                    <Button onClick={openPortal} disabled={portalLoading}>
                      {portalLoading ? 'Opening…' : 'Manage Subscription'}
                    </Button>
                  )}
                  {summary.plan === 'trial' && (
                    <Link href="/pricing">
                      <Button>Upgrade Plan</Button>
                    </Link>
                  )}
                  {!summary.can_activate_more && summary.plan !== 'enterprise' && (
                    <Link href="/pricing">
                      <Button variant="outline">Upgrade for More</Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming Payment section removed per product decision */}

            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Invoice History</h2>
              </div>
              {summary.stripe.invoices && summary.stripe.invoices.length > 0 ? (
                <ul className="divide-y">
                  {summary.stripe.invoices.map((inv) => (
                    <li key={inv.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800">{money(inv.amount_paid ?? inv.amount_due, inv.currency)}</div>
                        <div className="text-xs text-gray-500">{new Date((inv.created || 0) * 1000).toLocaleString()} • {inv.status}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {inv.hosted_invoice_url ? (
                          <Link href={inv.hosted_invoice_url} target="_blank">
                            <Button size="sm">View</Button>
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-600">No invoices found.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
