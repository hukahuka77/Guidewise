import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";

export interface AuthedUser {
  id: string;
  email: string | null;
  /** A Supabase anonymous user: someone trying Guidewise before creating an account. */
  isGuest: boolean;
}

let anonClient: SupabaseClient | null | undefined;

/** Any Supabase client can verify an access token; prefer the admin one, else the public anon key. */
function getAuthClient(): SupabaseClient | null {
  const admin = getSupabaseAdmin();
  if (admin) return admin;
  if (anonClient !== undefined) return anonClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  anonClient = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return anonClient;
}

export function isAuthConfigured(): boolean {
  return getAuthClient() !== null;
}

/** Verify the `Authorization: Bearer <supabase access token>` header; null when missing or invalid. */
export async function getAuthedUser(request: Request): Promise<AuthedUser | null> {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  const client = getAuthClient();
  if (!token || !client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, isGuest: data.user.is_anonymous === true };
}
