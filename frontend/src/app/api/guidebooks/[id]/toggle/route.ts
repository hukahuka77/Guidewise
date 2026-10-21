import { withUser } from "@/lib/server/apiRoute";
import { toggleGuidebook } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Publish/unpublish. Publishing is limited by the user's plan. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async ({ sql, user }) => {
    const result = await toggleGuidebook(sql, user.id, (await params).id);
    return Response.json({
      ok: true,
      active: result.active,
      public_slug: result.publicSlug,
      preview_url: result.previewUrl,
    });
  });
}
