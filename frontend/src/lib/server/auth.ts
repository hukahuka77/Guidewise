import { getSupabaseAdmin } from "./supabaseAdmin";

export interface AuthedUser {
  id: string;
  email: string | null;
}

/** Verify the `Authorization: Bearer <supabase access token>` header; null when missing or invalid. */
export async function getAuthedUser(request: Request): Promise<AuthedUser | null> {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  const admin = getSupabaseAdmin();
  if (!token || !admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
