"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!supabase) {
      setError("Authentication is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    try {
      setLoading(true);
      let emailRedirectTo: string | undefined = undefined;
      if (typeof window !== 'undefined') {
        // Prefer runtime origin in the browser to avoid using a prod URL during local dev
        const baseUrl = window.location.origin || process.env.NEXT_PUBLIC_SITE_URL;
        const gb = (sessionStorage.getItem('guidebookId') || localStorage.getItem('guidebookId')) || '';
        const token = (sessionStorage.getItem('claimToken') || localStorage.getItem('claimToken')) || '';
        const hasPending = gb && token;
        if (hasPending) {
          const hash = `#gb=${encodeURIComponent(gb)}&token=${encodeURIComponent(token)}`;
          emailRedirectTo = `${baseUrl}/success${hash}`;
        } else {
          emailRedirectTo = `${baseUrl}/dashboard`;
        }
      }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
      if (error) {
        const msg = (error?.message || '').toLowerCase();
        const isDuplicate = /already|registered|exists/.test(msg);
        setError(isDuplicate ? 'Email already in use. Please log in' : error.message);
        return;
      }
      // Detect duplicates even when signUp does not throw:
      // 1) Some tenants return an existing user with empty identities
      // 2) Others return a user that already has email_confirmed_at populated
      // 3) Fallback: identity list contains an email provider that isn't new
      const user = (data?.user ?? null) as unknown as { identities?: unknown[]; email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
      const identities: unknown[] = Array.isArray(user?.identities) ? (user!.identities as unknown[]) : [];
      const isEmptyIdentities = identities.length === 0;
      const isAlreadyConfirmed = !!(user && (user.email_confirmed_at || user.confirmed_at));
      const hasEmailProvider = (() => {
        return identities.some((i) => {
          if (i && typeof i === 'object') {
            const rec = i as Record<string, unknown>;
            if (typeof rec.provider === 'string' && rec.provider === 'email') return true;
            const idData = rec.identity_data as Record<string, unknown> | undefined;
            if (idData && typeof idData.provider === 'string' && idData.provider === 'email') return true;
          }
          return false;
        });
      })();
      if (isEmptyIdentities || isAlreadyConfirmed || hasEmailProvider) {
        if (process.env.NODE_ENV !== 'production') {
          // Helpful debugging in dev only
          console.log('Duplicate signup detected', { user, identities });
        }
        setError('Email already in use. Please log in');
        return;
      }
      // Depending on Supabase email confirmation settings, user may need to confirm via email
      setMessage("Check your email to confirm your account. Once confirmed, you can log in.");
      // Optionally redirect to login immediately
      // router.push("/login");
    } catch (err: unknown) {
      // Network or unexpected errors
      const msg = err instanceof Error ? err.message : 'Signup failed';
      // Normalize common duplicate email messages if thrown through this path
      const lower = msg.toLowerCase();
      if (/already|registered|exists/.test(lower)) {
        setError('Email already in use. Please log in');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const BG_URL = "/images/signup_picture.avif"; // from public/images

  return (
    <div className="min-h-[calc(100vh-56px)] w-full grid grid-cols-1 md:grid-cols-2">
      {/* Left: full-height form area */}
      <div className="w-full h-full flex items-center justify-center px-6 md:px-10 lg:px-16 py-10 md:py-0 bg-white">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to Guidewise</h1>
          <p className="mt-2 text-sm text-gray-600">Start crafting beautiful, always-up-to-date guidebooks.</p>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <strong className="font-semibold">Error: </strong>
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="mt-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded">
              <span>{message}</span>
            </div>
          )}
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-lg bg-[#db2777] hover:bg-[#be185d] text-white font-semibold disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating…" : "Create Account"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 py-6">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-500">or</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            {/* Social auth */}
            <button
              type="button"
              disabled={!supabase || oauthLoading}
              onClick={async () => {
                if (!supabase) {
                  setError("Authentication is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
                  return;
                }
                try {
                  setOauthLoading(true);
                  const { hasPendingPreview, gb, token } = (() => {
                    try {
                      const id = sessionStorage.getItem('guidebookId') || localStorage.getItem('guidebookId');
                      const tok = sessionStorage.getItem('claimToken') || localStorage.getItem('claimToken');
                      return { hasPendingPreview: !!(id && tok), gb: id, token: tok };
                    } catch { return { hasPendingPreview: false, gb: null, token: null }; }
                  })();
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${(typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL)}${hasPendingPreview ? `/success#gb=${encodeURIComponent(gb as string)}&token=${encodeURIComponent(token as string)}` : '/dashboard'}`,
                      queryParams: { prompt: 'select_account' },
                    },
                  });
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : 'Google sign-in failed';
                  setError(msg);
                } finally {
                  setOauthLoading(false);
                }
              }}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 font-semibold disabled:opacity-50 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt=""
                aria-hidden="true"
                className="h-5 w-5"
                loading="lazy"
                decoding="async"
              />
              {oauthLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <div className="mt-6 text-sm text-gray-600">
              Already have an account? {" "}
              <Link href="/login" className="text-pink-700 hover:text-pink-800 underline-offset-2 hover:underline">Log in</Link>
            </div>
        </div>
      </div>

      {/* Right: full-height image */}
      <div className="relative hidden md:block">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url(${BG_URL})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-black/0 to-black/10" aria-hidden />
        <span className="sr-only">Background</span>
        <div className="h-full w-full opacity-0" />
      </div>
    </div>
  );
}
