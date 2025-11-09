import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/**
 * Start Stripe checkout for a subscription plan.
 * @param plan - The plan tier: 'starter', 'growth', or 'pro' (default: 'growth')
 */
export async function startStripeCheckout(plan: 'starter' | 'growth' | 'pro' = 'growth'): Promise<void> {
  if (!API_BASE) throw new Error("API base not configured");
  if (!supabase) throw new Error("Supabase client not initialized");
  const sess = await supabase.auth.getSession();
  const token = sess.data.session?.access_token || null;
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email || undefined;
  const res = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email, plan }),
  });
  const json: unknown = await res.json().catch(() => ({}));

  // Handle case where user already has a subscription
  if (!res.ok && res.status === 409) {
    // Check if there's a redirect URL
    if (typeof json === "object" && json && "redirect" in json) {
      const { redirect } = json as { redirect?: string };
      if (redirect) {
        window.location.href = redirect;
        return;
      }
    }
    // Fallback to billing page
    window.location.href = "/dashboard/billing";
    return;
  }

  // Handle other errors
  if (!res.ok) {
    const msg = typeof json === "object" && json && "error" in json ? (json as { error?: string }).error : undefined;
    throw new Error(msg || `Failed to start checkout (${res.status})`);
  }

  // Success - redirect to Stripe checkout
  if (typeof json === "object" && json && "url" in json) {
    const { url } = json as { url?: string };
    if (url) {
      window.location.href = url;
      return;
    }
    return;
  }
  throw new Error("No checkout URL returned");
}
