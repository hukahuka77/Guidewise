import { liveGuidebookResponse, notFoundResponse } from "@/lib/server/guidebookResponse";
import { fetchActiveGuidebookBySlug } from "@/lib/server/guidebooks";
import { proxyToBackend } from "@/lib/server/proxy";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
// Same region as the Supabase database (us-east-1) to keep round trips short.
export const preferredRegion = "iad1";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  // Not configured yet: keep serving from Flask.
  if (!getSupabaseAdmin()) return proxyToBackend(request);
  try {
    const { slug } = await params;
    const gb = await fetchActiveGuidebookBySlug(slug);
    return gb ? liveGuidebookResponse(request, gb) : notFoundResponse();
  } catch (error) {
    console.error("native /g render failed; falling back to Flask", error);
    return proxyToBackend(request);
  }
}
