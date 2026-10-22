import { readJson, withUser } from "@/lib/server/apiRoute";
import { createGuidebook } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Create a guidebook (and its host/property). It is live at /g/<slug> straight away. */
export function POST(request: Request) {
  return withUser(request, async ({ sql, user }) => {
    const result = await createGuidebook(sql, user.id, await readJson(request));
    const headers = new Headers({
      "X-Guidebook-Url": `/g/${result.publicSlug}`,
      "Access-Control-Expose-Headers": "X-Guidebook-Url",
    });
    return Response.json(
      { ok: true, guidebook_id: result.guidebookId, template_key: result.templateKey, public_slug: result.publicSlug },
      { status: 201, headers },
    );
  });
}
