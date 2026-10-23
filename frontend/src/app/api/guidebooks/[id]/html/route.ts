import { withUser } from "@/lib/server/apiRoute";
import { loadOwnedGuidebookRow } from "@/lib/server/guidebookService";
import { renderGuidebookHtml } from "@/lib/guidebook/render";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/**
 * The guidebook page exactly as guests see it, for the owner's live preview in the editor. Never cached and
 * never counted as a view (unlike /g/<slug>), so editing does not use up a free plan's monthly views.
 */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async ({ sql, user }) => {
    const gb = await loadOwnedGuidebookRow(sql, user.id, (await params).id);
    if (!gb) return Response.json({ error: "Guidebook not found" }, { status: 404 });
    const { html, templateKey } = renderGuidebookHtml(gb);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Template-Key": templateKey,
      },
    });
  });
}
