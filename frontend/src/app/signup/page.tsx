"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { rememberHeardAbout } from "@/lib/attribution";
import { parsePaidPlan, type PaidPlan } from "@/lib/billing";
import AuthShell, { AuthAlert, OrDivider, authInput, authLabel, authLink, authPrimary, authSecondary } from "@/components/custom/AuthShell";

const HEARD_OPTIONS = ["A message from Guidewise", "Facebook group", "Reddit", "Google search", "TikTok, Instagram or YouTube", "A guest guidebook I saw", "A friend or co-host", "Other"];

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [heard, setHeard] = useState("");
  // Came from "Save your guidebook": /onboarding moves the guest's guidebook into the new account
  const [saving, setSaving] = useState(false);
  // Came from "Build my guidebook" when guests aren't available: /onboarding builds it once they're in
  const [building, setBuilding] = useState(false);
  // Came from a paid plan on /pricing: checkout starts on /onboarding once they're signed in
  const [plan, setPlan] = useState<PaidPlan | null>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setSaving(query.get("save") === "1");
    setBuilding(query.get("build") === "1");
    setPlan(parsePaidPlan(query.get("plan")));
  }, []);
  const afterSignup = plan ? `/onboarding?plan=${plan}` : "/onboarding";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!supabase) {
      setError("Authentication is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    // Same rule as the Supabase password policy, said up front instead of as a server error
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError("Your password needs an uppercase letter, a lowercase letter and a number.");
      return;
    }
    try {
      setLoading(true);
      let emailRedirectTo: string | undefined = undefined;
      if (typeof window !== 'undefined') {
        // Prefer runtime origin in the browser to avoid using a prod URL during local dev
        const baseUrl = window.location.origin || process.env.NEXT_PUBLIC_SITE_URL;
        emailRedirectTo = `${baseUrl}${afterSignup}`;
      }
      const { error, data } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
      if (error) {
        const msg = (error?.message || '').toLowerCase();
        const isDuplicate = /already|registered|exists/.test(msg);
        setError(isDuplicate ? 'Email already in use. Please log in' : error.message);
        return;
      }
      
      // If no error but no user was created, it's likely a duplicate email (unique constraint)
      if (!data?.user?.id) {
        setError('Email already in use. Please log in');
        return;
      }
      
      // Depending on Supabase email confirmation settings, user may need to confirm via email
      if (data.session) {
        router.push(afterSignup);
        return;
      }
      setMessage(saving
        ? "Check your email to confirm your account. Open the link in this browser and your guidebook will be saved to it."
        : "Check your email to confirm your account. Once confirmed, you can log in.");
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

  const title = saving ? "Save your guidebook" : building ? "Create your free account" : "Start your guidebook";
  const subtitle = saving
    ? "Create your free account and the guidebook you built comes with you."
    : building
      ? "Then we'll build your guidebook straight away."
      : "Free forever. No credit card, no trial that runs out.";

  return (
    <AuthShell title={title} subtitle={subtitle}>
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      {message && <AuthAlert tone="success">{message}</AuthAlert>}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className={authLabel}>Email</span>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(null); if (message) setMessage(null); }}
            className={authInput}
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className={authLabel}>Password</span>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
            className={authInput}
            placeholder="••••••••"
            aria-describedby="password-hint"
          />
          <span id="password-hint" className="mt-1.5 block text-xs text-[#8a7f77]">Upper and lower case letters and at least one number.</span>
        </label>
        <label className="block">
          <span className={authLabel}>How did you hear about us? <span className="font-normal text-[#8a7f77]">(optional)</span></span>
          <select value={heard} onChange={(e) => { setHeard(e.target.value); rememberHeardAbout(e.target.value); }} className={authInput}>
            <option value="">Choose one</option>
            {HEARD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <button type="submit" disabled={loading} className={authPrimary}>
          {loading ? "Creating your account…" : "Create free account"}
        </button>
      </form>

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
                redirectTo: `${(typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL)}${afterSignup}`,
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
        Already have an account?{" "}
        <Link href={saving ? "/login?save=1" : building ? "/login?build=1" : "/login"} className={authLink}>
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
