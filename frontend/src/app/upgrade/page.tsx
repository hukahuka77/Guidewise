"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function UpgradePage() {
  const router = useRouter();
  const params = useSearchParams();
  const guidebookId = useMemo(() => params.get("gb") || "", [params]);
  const success = useMemo(() => params.get("success") || "", [params]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"free" | "pro" | "">("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!supabase) {
          if (!cancelled) {
            setLoading(false);
            setError("Supabase client not initialized");
          }
          return;
        }
        const sess = await supabase.auth.getSession();
        const token = sess.data.session?.access_token || null;
        setAccessToken(token);
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          router.replace(`/signup?next=/upgrade${guidebookId ? `?gb=${guidebookId}` : ""}`);
          return;
        }
        // Fetch plan from public.profiles
        const { data: prof } = await supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", user.id)
          .single();
        const p = (prof?.plan as "free" | "pro" | undefined) || "free";
        if (!cancelled) setPlan(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, guidebookId]);

  // When Stripe returns with success=1, proactively refresh plan from backend and auto-activate
  useEffect(() => {
    (async () => {
      try {
        if (!API_BASE || success !== '1') return;
        if (!supabase) return;
        // Ensure we have a token
        const sess = await supabase.auth.getSession();
        const token = sess.data.session?.access_token || null;
        if (!token) return;
        setAccessToken((prev) => prev || token);
        // Ask backend to sync plan from Stripe and activate if Pro
        const res = await fetch(`${API_BASE}/api/billing/refresh-plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && (json?.plan === 'pro' || json?.plan === 'free')) {
          setPlan(json.plan);
          if (json.plan === 'pro') {
            // Trigger activation flow automatically for a smoother UX
            try {
              const act = await fetch(`${API_BASE}/api/guidebooks/activate_for_user`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({}),
              });
              if (act.ok) {
                if (guidebookId) {
                  router.replace(`/guidebook/${guidebookId}`);
                } else {
                  router.replace('/dashboard');
                }
                return;
              }
            } catch {}
          }
        }
      } catch (e) {
        // Non-fatal; user can still click Activate Now
        console.warn('refresh-plan failed', e);
      }
    })();
  }, [success, guidebookId, router]);

  const startCheckout = async () => {
    if (!API_BASE) return;
    setBillingLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || undefined;
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token || null;
      const res = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to start checkout (${res.status})`);
      if (json.url) {
        window.location.href = json.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout error');
      setBillingLoading(false);
    }
  };

  const openBillingPortal = async () => {
    if (!API_BASE) return;
    setBillingLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || undefined;
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token || null;
      const res = await fetch(`${API_BASE}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to open billing portal (${res.status})`);
      if (json.url) {
        window.location.href = json.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Billing portal error');
      setBillingLoading(false);
    }
  };

  const onActivateNow = async () => {
    if (!API_BASE || !accessToken) return;
    setActivating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/guidebooks/activate_for_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Activation failed (${res.status}): ${txt}`);
        setActivating(false);
        return;
      }
      // If we have a guidebook id, send them to it now
      if (guidebookId) {
        router.replace(`/guidebook/${guidebookId}`);
      } else {
        router.replace("/dashboard");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation error");
      setActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl bg-white border rounded-2xl shadow-sm p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Guidebook Locked</h1>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${plan === "pro" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-gray-100 text-gray-700 border border-gray-200"}`}>
            {plan === "pro" ? "PRO" : "FREE"}
          </span>
        </div>

        <p className="mt-4 text-gray-600">
          This guidebook isn’t active yet. Activate it instantly by upgrading to Pro.
        </p>

        {loading ? (
          <div className="mt-8"><Spinner /></div>
        ) : (
          <div className="mt-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
            )}
            {plan !== "pro" ? (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <Button className="w-full" disabled={billingLoading} onClick={startCheckout}>
                    {billingLoading ? <div className="flex items-center gap-2"><Spinner size={18} /> Loading checkout…</div> : 'Upgrade to Pro'}
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => router.push("/dashboard/profile")}>
                    Go to Profile
                  </Button>
                </div>
                <p className="text-sm text-gray-500 text-center">After upgrading, return here and click “I’m Pro — Activate Now”.</p>
              </>
            ) : (
              <>
                <Button className="w-full" disabled={activating} onClick={onActivateNow}>
                  {activating ? <div className="flex items-center gap-2"><Spinner size={18} /> Activating…</div> : "I’m Pro — Activate Now"}
                </Button>
                <Button variant="outline" className="w-full" disabled={billingLoading} onClick={openBillingPortal}>
                  {billingLoading ? <div className="flex items-center gap-2"><Spinner size={18} /> Opening billing…</div> : 'Manage Billing'}
                </Button>
                {guidebookId ? (
                  <Button variant="secondary" className="w-full" onClick={() => router.replace(`/guidebook/${guidebookId}`)}>
                    Continue to Guidebook
                  </Button>
                ) : null}
              </>
            )}

            <div className="mt-6 text-xs text-gray-500 text-center">
              Powered by <Link className="font-semibold hover:underline" href="/">GUIDEWISE</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
