import { readJson, withUser } from "@/lib/server/apiRoute";
import { deleteGuidebook, getGuidebookPayload, updateGuidebook } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

type Params = { params: Promise<{ id: string }> };

export function GET(request: Request, { params }: Params) {
  return withUser(
    request,
    async ({ sql, user }) => Response.json(await getGuidebookPayload(sql, user.id, (await params).id)),
  );
}

function update(request: Request, { params }: Params) {
  return withUser(request, async ({ sql, user }) => {
    const { guidebookId } = await updateGuidebook(sql, user.id, (await params).id, await readJson(request));
    return Response.json({ ok: true, guidebook_id: guidebookId });
  });
}
export const PUT = update;
export const PATCH = update;

export function DELETE(request: Request, { params }: Params) {
  return withUser(request, async ({ sql, user }) => {
    await deleteGuidebook(sql, user.id, (await params).id);
    return Response.json({ ok: true });
  });
}
