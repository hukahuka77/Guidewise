"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { readFirstTouch, readHeardAbout, recordFirstTouch } from "@/lib/attribution";

/**
 * Records where a visitor first came from, and saves it (with their "How did you hear about us?"
 * answer) on their account the first time they are signed in with a real account. Renders nothing.
 */
export default function Attribution() {
  useEffect(() => {
    recordFirstTouch();
    if (!supabase) return;
    const client = supabase;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (!user || user.is_anonymous || user.user_metadata?.signup_source) return;
      // Only new accounts: an older account's first visit is long gone
      if (Date.now() - Date.parse(user.created_at) > 7 * 24 * 3600_000) return;
      const touch = readFirstTouch();
      const heard = readHeardAbout();
      // Deferred: auth callbacks must not await other Supabase calls
      setTimeout(() => {
        client.auth
          .updateUser({ data: { signup_source: touch || { landing: "unknown" }, ...(heard ? { heard_about: heard } : {}) } })
          .catch(() => undefined);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
