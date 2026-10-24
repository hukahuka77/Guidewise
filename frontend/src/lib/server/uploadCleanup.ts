import { getSupabaseAdmin } from "./supabaseAdmin";

/** Buckets that hold files hosts upload for one guidebook. my_images holds shared placeholders, so it's never touched. */
const GUIDEBOOK_BUCKETS = ["food-and-activities", "User_videos"];

/**
 * Storage objects (bucket and path) that a guidebook's data points at: every public URL of ours found
 * anywhere in the value, such as the cover, place photos and house manual media.
 */
export function uploadedFilesIn(value: unknown, supabaseUrl: string): { bucket: string; path: string }[] {
  if (!supabaseUrl) return [];
  const base = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/`;
  const text = JSON.stringify(value ?? null);
  const found = new Map<string, { bucket: string; path: string }>();
  let at = text.indexOf(base);
  while (at !== -1) {
    const rest = text.slice(at + base.length);
    const url = rest.slice(0, rest.search(/["\\\s?#]|$/));
    const slash = url.indexOf("/");
    if (slash > 0) {
      const bucket = decodeURIComponent(url.slice(0, slash));
      const path = decodeURIComponent(url.slice(slash + 1));
      if (GUIDEBOOK_BUCKETS.includes(bucket) && path) found.set(`${bucket}/${path}`, { bucket, path });
    }
    at = text.indexOf(base, at + base.length);
  }
  return [...found.values()];
}

type Remover = (bucket: string, paths: string[]) => Promise<unknown>;

const removeWithAdmin: Remover = async (bucket, paths) => {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.storage.from(bucket).remove(paths);
  if (error) throw error;
};

/**
 * Remove a deleted guidebook's uploads, except files the owner's other guidebooks still use (a photo can be
 * reused). Best effort: a storage failure is logged and never fails the delete.
 */
export async function removeGuidebookUploads(deleted: unknown, othersOfOwner: unknown[], remove: Remover = removeWithAdmin) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const stillUsed = new Set(uploadedFilesIn(othersOfOwner, supabaseUrl).map((f) => `${f.bucket}/${f.path}`));
  const byBucket = new Map<string, string[]>();
  for (const f of uploadedFilesIn(deleted, supabaseUrl)) {
    if (stillUsed.has(`${f.bucket}/${f.path}`)) continue;
    byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path]);
  }
  for (const [bucket, paths] of byBucket) {
    try {
      await remove(bucket, paths);
    } catch (error) {
      console.warn(`could not remove ${paths.length} uploads from ${bucket}`, error);
    }
  }
}
