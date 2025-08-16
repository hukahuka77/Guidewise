"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { cacheGet, cacheSet } from "@/lib/cache";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      // Serve from cache if present
      const cached = cacheGet<{ email: string; name: string; company: string; phone: string }>("profile:user");
      if (cached && !cancelled) {
        setEmail(cached.email);
        setName(cached.name);
        setCompany(cached.company);
        setPhone(cached.phone);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        if (!supabase) {
          if (!cached) setError("Authentication is not configured.");
          return;
        }
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          router.push("/login");
          return;
        }
        const emailVal = user.email || "";
        const md = (user.user_metadata || {}) as Record<string, unknown>;
        const nameVal = typeof md.name === "string" ? md.name : "";
        const companyVal = typeof md.company === "string" ? md.company : "";
        const phoneVal = typeof md.phone === "string" ? md.phone : "";
        if (!cancelled) {
          setEmail(emailVal);
          setName(nameVal);
          setCompany(companyVal);
          setPhone(phoneVal);
          cacheSet("profile:user", { email: emailVal, name: nameVal, company: companyVal, phone: phoneVal }, 10 * 60_000);
          if (!cached) setLoading(false);
        }
      } catch (e: unknown) {
        if (!cancelled && !cached) setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled && !cached) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const onSave = async () => {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name, company, phone },
      });
      if (error) throw error;
      cacheSet("profile:user", { email, name, company, phone }, 10 * 60_000);
      setMessage("Profile updated");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Your Profile</h1>
            <p className="text-gray-600 mt-1">View and edit your account details</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border p-6 text-gray-700 flex items-center gap-3">
            <Spinner size={20} colorClass="text-[oklch(0.6923_0.22_21.05)]" />
            <span>Loading…</span>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
            )}
            {message && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded">{message}</div>
            )}

            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                disabled
                value={email}
                onChange={() => {}}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company or team"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={onSave} disabled={saving} className="px-6">
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={18} />
                    Saving…
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
