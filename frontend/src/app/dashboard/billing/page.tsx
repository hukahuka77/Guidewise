"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { startAddonCheckout } from "@/lib/billing";
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
  plan: "free" | "pro" | string;
  stripe: {
    customer_id: string | null;
    subscription: { id: string; status?: string | null; current_period_end?: number | null } | null;
    upcoming_invoice: { amount_due?: number | null; next_payment_attempt?: number | null; currency?: string | null } | null;
    invoices: InvoiceItem[];
  };
  extra_slots: number;
  error?: string;
};

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

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
    if (typeof cents !== "number") return "—";
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

        {loading ? (
          <div className="bg-white rounded-xl border p-6 text-gray-700 flex items-center gap-3">
            <Spinner size={20} />
            <span>Loading…</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
        ) : summary ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Subscription</div>
                <div className="mt-1 font-semibold text-gray-800">
                  {summary.plan === 'pro' ? 'Pro' : 'Free'}
                  {summary.stripe.subscription?.current_period_end ? (
                    <span className="ml-2 text-sm text-gray-500">
                      (renews {new Date((summary.stripe.subscription.current_period_end as number) * 1000).toLocaleDateString()})
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-gray-500">Stripe status: {summary.stripe.subscription?.status || '—'}</div>
                {summary.plan === 'pro' ? (
                  <div className="text-xs text-gray-600 mt-1">Guidebook slots: <span className="font-semibold">{1 + (summary.extra_slots || 0)}</span></div>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={openPortal} disabled={portalLoading}>{portalLoading ? 'Opening…' : 'Manage Billing'}</Button>
                {summary.plan === 'pro' && (
                  <Button variant="outline" onClick={() => { void startAddonCheckout(); }}>+ Add guidebook slot</Button>
                )}
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
