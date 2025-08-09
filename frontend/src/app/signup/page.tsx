"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
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
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // Depending on Supabase email confirmation settings, user may need to confirm via email
      setMessage("Check your email to confirm your account. Once confirmed, you can log in.");
      // Optionally redirect to login immediately
      // router.push("/login");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Create Account</h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
            <strong className="font-bold">Error: </strong>
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded" role="alert">
            <span>{message}</span>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <button type="submit" disabled={loading} className="w-full px-4 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold disabled:opacity-50">
            {loading ? "Creating…" : "Create Account"}
          </button>
        </form>

        <div className="flex items-center gap-3 py-2">
          <div className="h-px bg-gray-200 flex-1" />
          <span className="text-xs text-gray-500">or</span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>

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
                  redirectTo: `${window.location.origin}/dashboard`,
                  queryParams: { prompt: 'select_account' },
                },
              });
            } catch (e: any) {
              setError(e.message || 'Google sign-in failed');
            } finally {
              setOauthLoading(false);
            }
          }}
          className="w-full px-4 py-2 rounded border font-semibold disabled:opacity-50"
        >
          {oauthLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>
        <div className="text-sm">
          Already have an account? <Link href="/login" className="text-blue-600 underline">Log in</Link>
        </div>
      </div>
    </div>
  );
}
