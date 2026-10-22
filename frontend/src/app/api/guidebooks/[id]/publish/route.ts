import { withUser } from "@/lib/server/apiRoute";
import { publishGuidebook } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Render the guidebook and store the static HTML snapshot served at /g/<slug>. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async ({ sql, user }) => {
    const { etag, publishedAt } = await publishGuidebook(sql, user.id, (await params).id);
    return Response.json({ ok: true, etag, published_at: publishedAt });
  });
}
