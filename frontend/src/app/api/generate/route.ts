import { readJson, withUser } from "@/lib/server/apiRoute";
import { createGuidebook, ensurePreviewToken, previewPath } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Create a guidebook (and its host/property). Auto-activates when the plan has a free slot. */
export function POST(request: Request) {
  return withUser(request, async ({ sql, user }) => {
    const result = await createGuidebook(sql, user.id, await readJson(request));
    const headers = new Headers();
    if (result.active && result.publicSlug) {
      headers.set("X-Guidebook-Url", `/g/${result.publicSlug}`);
      headers.set("Access-Control-Expose-Headers", "X-Guidebook-Url");
    } else {
      headers.set("X-Guidebook-Url", `/edit/${result.guidebookId}`);
      headers.set("X-Guidebook-Preview", previewPath(result.guidebookId, await ensurePreviewToken(sql, result.guidebookId)));
      headers.set("Access-Control-Expose-Headers", "X-Guidebook-Url, X-Guidebook-Preview");
    }
    return Response.json(
      { ok: true, guidebook_id: result.guidebookId, template_key: result.templateKey },
      { status: 201, headers },
    );
  });
}
