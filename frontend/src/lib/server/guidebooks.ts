import type { GuidebookRow } from "@/lib/guidebook/types";
import { getSupabaseAdmin } from "./supabaseAdmin";

const SELECT = "*, property(*), host(*)";

async function fetchOne(column: "public_slug" | "id", value: string): Promise<GuidebookRow | null> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin.from("guidebook").select(SELECT).eq(column, value).limit(1).maybeSingle();
  if (error) throw new Error(`guidebook lookup failed: ${error.message}`);
  return (data as GuidebookRow | null) ?? null;
}

export const fetchGuidebookBySlug = (slug: string) => fetchOne("public_slug", slug);
export const fetchGuidebookById = (id: string) => fetchOne("id", id);
