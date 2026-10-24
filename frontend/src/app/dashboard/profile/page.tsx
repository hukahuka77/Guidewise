"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { cacheGet, cacheSet } from "@/lib/cache";
import { loginPath } from "@/lib/nextPath";

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
          router.push(loginPath());
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
        setLoading(false);
      }
    })();
    return () => { cancelled = true };
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
    <div>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#1f1a17] sm:text-4xl">Your profile</h1>
            <p className="mt-1.5 text-[#5b524c]">View and edit your account details</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 rounded-3xl bg-white p-6 ring-1 ring-black/5 text-[#5b524c]">
            <Spinner size={20} colorClass="text-[#db2777]" />
            <span>Loading…</span>
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 space-y-6 sm:p-8">
            {error && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">{error}</div>
            )}
            {message && (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">{message}</div>
            )}

            <div>
              <label htmlFor="profile-email" className="block text-sm font-medium text-[#1f1a17]">Email</label>
              <input
                id="profile-email"
                type="email"
                disabled
                value={email}
                onChange={() => {}}
                className="mt-1.5 w-full rounded-xl border-0 bg-[#f6f2ee] px-4 py-3 text-[15px] text-[#8a7f77]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-name" className="block text-sm font-medium text-[#1f1a17]">Full Name</label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1.5 w-full rounded-xl border-0 bg-[#f6f2ee] px-4 py-3 text-[15px] text-[#1f1a17] placeholder:text-[#a0958d] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#db2777]/50"
                />
              </div>
              <div>
                <label htmlFor="profile-company" className="block text-sm font-medium text-[#1f1a17]">Company</label>
                <input
                  id="profile-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company or team"
                  className="mt-1.5 w-full rounded-xl border-0 bg-[#f6f2ee] px-4 py-3 text-[15px] text-[#1f1a17] placeholder:text-[#a0958d] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#db2777]/50"
                />
              </div>
              <div>
                <label htmlFor="profile-phone" className="block text-sm font-medium text-[#1f1a17]">Phone</label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="mt-1.5 w-full rounded-xl border-0 bg-[#f6f2ee] px-4 py-3 text-[15px] text-[#1f1a17] placeholder:text-[#a0958d] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#db2777]/50"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={onSave} disabled={saving} className="h-11 rounded-full px-6">
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={18} />
                    Saving…
                  </span>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
