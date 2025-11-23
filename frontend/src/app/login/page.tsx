"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // If there's a pending preview, go to success to auto-claim; else proceed
      const hasPendingPreview = (() => {
        try {
          const url = sessionStorage.getItem('liveGuidebookUrl') || localStorage.getItem('liveGuidebookUrl');
          const id = sessionStorage.getItem('guidebookId') || localStorage.getItem('guidebookId');
          return !!(url && url.includes('/preview/') && id);
        } catch { return false; }
      })();
      router.push(hasPendingPreview ? "/success" : "/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setMessage(null);
    if (!supabase) {
      setError("Authentication is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    if (!email) {
      setError("Enter your email above so we can send a reset link.");
      return;
    }
    try {
      setResetLoading(true);
      let redirectTo: string | undefined = undefined;
      if (typeof window !== "undefined") {
        const baseUrl = window.location.origin || process.env.NEXT_PUBLIC_SITE_URL;
        redirectTo = `${baseUrl}/login`;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
      setMessage("Check your email for a password reset link.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      setError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const BG_URL = "/images/login_form_picture.avif";

  return (
    <div className="min-h-[calc(100vh-56px)] w-full grid grid-cols-1 md:grid-cols-2">
      {/* Left: full-height image */}
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

      {/* Right: form */}
      <div className="w-full h-full flex items-center justify-center px-6 md:px-10 lg:px-16 py-10 md:py-0 bg-white">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-600">Log in to continue creating guidebooks.</p>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-center" role="alert">
              <strong className="font-semibold">Error: </strong>
              <span>{error}</span>
            </div>
          )}

          {message && !error && (
            <div className="mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-center" role="status">
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-center">Email</label>
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
              <label htmlFor="password" className="block text-sm font-medium text-center">Password</label>
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
              className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#db2777] to-[#f97316] text-white font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
            >
              {loading ? "Logging in…" : "Login"}
            </button>
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="text-xs text-pink-700 hover:text-pink-800 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {resetLoading ? "Sending reset link…" : "Forgot your password?"}
              </button>
            </div>
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
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin)}/onboarding`,
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

          <div className="mt-6 text-sm text-gray-600 text-center">
            Don&#39;t have an account? <Link href="/signup" className="text-pink-700 hover:text-pink-800 underline-offset-2 hover:underline">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
