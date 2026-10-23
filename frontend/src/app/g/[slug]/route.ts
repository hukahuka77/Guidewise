import { notFoundResponse, unavailableResponse } from "@/lib/server/guidebookResponse";
import { serveGuidebook } from "@/lib/server/liveGuidebook";
import { fetchGuidebookBySlug } from "@/lib/server/guidebooks";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
// Same region as the Supabase database (us-east-1) to keep round trips short.
export const preferredRegion = "iad1";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!getSupabaseAdmin()) return unavailableResponse();
  try {
    const { slug } = await params;
    const gb = await fetchGuidebookBySlug(slug);
    return gb ? await serveGuidebook(request, gb) : notFoundResponse();
  } catch (error) {
    console.error("/g render failed", error);
    return unavailableResponse(500);
  }
}
