import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function startStripeCheckout(): Promise<void> {
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
    body: JSON.stringify({ email }),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof json === "object" && json && "error" in json ? (json as { error?: string }).error : undefined;
    throw new Error(msg || `Failed to start checkout (${res.status})`);
  }
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
