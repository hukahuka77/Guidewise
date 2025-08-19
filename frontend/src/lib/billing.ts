import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function startStripeCheckout(): Promise<void> {
  if (!API_BASE) throw new Error("API base not configured");
  const sess = await supabase?.auth.getSession();
  const token = sess?.data.session?.access_token || null;
  const { data } = await (supabase?.auth.getUser() || Promise.resolve({ data: { user: null as any } } as any));
  const email = data?.user?.email || undefined;
  const res = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Failed to start checkout (${res.status})`);
  }
  if (json?.url) {
    window.location.href = json.url as string;
    return;
  }
  throw new Error("No checkout URL returned");
}
