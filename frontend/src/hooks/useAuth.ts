import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export interface UseAuthOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

/**
 * Hook for managing authentication state
 * Consolidates auth checking and session management
 */
export function useAuth(options: UseAuthOptions = {}) {
  const { redirectTo, requireAuth = false } = options;
  const router = useRouter();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load initial session and set up listener
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!supabase) {
        if (mounted) {
          setAccessToken(null);
          setAuthChecked(true);
          setIsAuthenticated(false);

          // Redirect if auth is required
          if (requireAuth && redirectTo) {
            router.replace(redirectTo);
          }
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (mounted) {
        const token = data.session?.access_token || null;
        setAccessToken(token);
        setAuthChecked(true);
        setIsAuthenticated(!!token);
      }
    })();

    // Set up auth state change listener
    const subscription = supabase
      ? supabase.auth.onAuthStateChange(
          (_event: AuthChangeEvent, session: Session | null) => {
            const token = session?.access_token || null;
            setAccessToken(token);
            setAuthChecked(true);
            setIsAuthenticated(!!token);
          }
        ).data.subscription
      : { unsubscribe: () => {} };

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, requireAuth, redirectTo]);

  // Redirect if auth is required and user is not authenticated
  useEffect(() => {
    if (!authChecked) return;
    if (requireAuth && !isAuthenticated && redirectTo) {
      router.replace(redirectTo);
    }
  }, [authChecked, isAuthenticated, requireAuth, redirectTo, router]);

  return {
    accessToken,
    authChecked,
    isAuthenticated,
  };
}
