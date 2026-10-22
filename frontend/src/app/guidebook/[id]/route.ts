import { liveGuidebookResponse, notFoundResponse } from "@/lib/server/guidebookResponse";
import { fetchGuidebookById } from "@/lib/server/guidebooks";
import { proxyToBackend } from "@/lib/server/proxy";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Legacy direct-by-id URL. Active guidebooks are served; inactive ones go to the upgrade page. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getSupabaseAdmin()) return proxyToBackend(request);
  try {
    const { id } = await params;
    const gb = await fetchGuidebookById(id);
    if (!gb) return notFoundResponse();
    if (!gb.active) {
      return new Response(null, { status: 302, headers: { Location: `/upgrade?gb=${encodeURIComponent(gb.id)}` } });
    }
    return liveGuidebookResponse(request, gb);
  } catch (error) {
    console.error("native /guidebook render failed; falling back to Flask", error);
    return proxyToBackend(request);
  }
}
