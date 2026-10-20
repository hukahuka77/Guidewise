import { supabase } from '@/lib/supabaseClient';

/** Returns an Authorization header for the current Supabase session, if any. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const sess = await supabase?.auth.getSession();
  const token = sess?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
