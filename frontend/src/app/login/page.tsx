"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { claimGuestGuidebooks, hasPendingBuild } from "@/lib/guest";
import { safeNextPath } from "@/lib/nextPath";
import AuthShell, { AuthAlert, OrDivider, authInput, authLabel, authLink, authPrimary, authSecondary } from "@/components/custom/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  // Arrived from a password reset email: ask for the new password instead of the login form
  const [recovering, setRecovering] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  // Came from "Save your guidebook": the guidebook they built as a guest joins this account
  const [saving, setSaving] = useState(false);
  const [pendingBuild, setPendingBuild] = useState(false);
  // Sent here from a page that needs an account: go back to it afterwards instead of the dashboard
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("reset") === "1") setRecovering(true);
    if (query.get("save") === "1") setSaving(true);
    setNext(safeNextPath(query.get("next")));
    setPendingBuild(hasPendingBuild());
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const onSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!supabase) return;
    try {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("This reset link has expired. Enter your email below and request a new one.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not update your password";
      setError(msg);
      if (msg.startsWith("This reset link has expired")) setRecovering(false);
    } finally {
      setLoading(false);
    }
  };

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
      const claimed = await claimGuestGuidebooks();
      // A guidebook they started before logging in opens (or gets built) on /onboarding
      router.push(claimed[0] ? `/edit/${claimed[0]}?new=true` : hasPendingBuild() ? "/onboarding" : next || "/dashboard");
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
        redirectTo = `${baseUrl}/login?reset=1`;
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

  const title = recovering ? "Choose a new password" : saving ? "Save your guidebook" : "Welcome back";
  const subtitle = recovering
    ? "Pick a password you'll remember. You'll go straight to your guidebooks."
    : saving
      ? "Log in and the guidebook you just built joins your account."
      : "Log in to keep building your guidebooks.";

  return (
    <AuthShell title={title} subtitle={subtitle}>
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      {message && !error && <AuthAlert tone="success">{message}</AuthAlert>}

      {recovering ? (
        <form onSubmit={onSetNewPassword} className="mt-8 space-y-5">
          <label className="block">
            <span className={authLabel}>New password</span>
            <input
              id="new-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={authInput}
              placeholder="••••••••"
            />
          </label>
          <button type="submit" disabled={loading} className={authPrimary}>
            {loading ? "Saving…" : "Save new password"}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className={authLabel}>Email</span>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInput}
              placeholder="you@example.com"
            />
          </label>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={authLabel}>Password</label>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="text-xs font-medium text-[#be185d] underline-offset-2 hover:underline disabled:opacity-50"
              >
                {resetLoading ? "Sending reset link…" : "Forgot password?"}
              </button>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInput}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className={authPrimary}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
      )}

      {!recovering && (<>
      <OrDivider />

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
                    // /onboarding claims a guest's guidebook and opens it in the editor
                    redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin)}${saving || pendingBuild ? "/onboarding" : next || "/dashboard"}`,
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
        className={authSecondary}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" aria-hidden="true" className="h-5 w-5" loading="lazy" decoding="async" />
        {oauthLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <p className="mt-6 text-center text-sm text-[#5b524c]">
        New to Guidewise?{" "}
        <Link href={saving ? "/signup?save=1" : pendingBuild ? "/signup?build=1" : next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className={authLink}>
          Create a free account
        </Link>
      </p>
      </>)}
    </AuthShell>
  );
}
