import { notFoundResponse, unavailableResponse } from "@/lib/server/guidebookResponse";
import { serveGuidebook } from "@/lib/server/liveGuidebook";
import { fetchGuidebookById } from "@/lib/server/guidebooks";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Direct-by-id URL (printed QR codes point here); same page as /g/<slug>. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getSupabaseAdmin()) return unavailableResponse();
  try {
    const { id } = await params;
    const gb = await fetchGuidebookById(id);
    return gb ? await serveGuidebook(request, gb) : notFoundResponse();
  } catch (error) {
    console.error("/guidebook render failed", error);
    return unavailableResponse(500);
  }
}
