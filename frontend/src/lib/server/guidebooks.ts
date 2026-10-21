import type { GuidebookRow } from "@/lib/guidebook/types";
import { getSupabaseAdmin } from "./supabaseAdmin";

const SELECT = "*, property(*), host(*)";

async function fetchOne(column: "public_slug" | "id", value: string, activeOnly: boolean): Promise<GuidebookRow | null> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase service role is not configured");
  let query = admin.from("guidebook").select(SELECT).eq(column, value);
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`guidebook lookup failed: ${error.message}`);
  return (data as GuidebookRow | null) ?? null;
}

export const fetchActiveGuidebookBySlug = (slug: string) => fetchOne("public_slug", slug, true);
export const fetchGuidebookById = (id: string) => fetchOne("id", id, false);
