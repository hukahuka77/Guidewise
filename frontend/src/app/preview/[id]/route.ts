import { getAuthedUser } from "@/lib/server/auth";
import { notFoundResponse, previewGuidebookResponse, safeEqual } from "@/lib/server/guidebookResponse";
import { fetchGuidebookById } from "@/lib/server/guidebooks";
import { proxyToBackend } from "@/lib/server/proxy";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/**
 * Preview a guidebook. Published guidebooks are public; drafts need the share token (?t=...)
 * or the owner's access token. Anyone else gets a 404 so drafts are not discoverable.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getSupabaseAdmin()) return proxyToBackend(request);
  try {
    const { id } = await params;
    const gb = await fetchGuidebookById(id);
    if (!gb) return notFoundResponse();

    if (!gb.active) {
      const supplied = new URL(request.url).searchParams.get("t") || "";
      const tokenOk = Boolean(gb.preview_token) && safeEqual(supplied, gb.preview_token as string);
      if (!tokenOk) {
        const user = await getAuthedUser(request);
        if (!user || user.id !== gb.user_id) {
          return Response.json({ error: "Guidebook not found" }, { status: 404 });
        }
      }
    }
    return previewGuidebookResponse(gb);
  } catch (error) {
    console.error("native /preview render failed; falling back to Flask", error);
    return proxyToBackend(request);
  }
}
