import { readJson, withUser } from "@/lib/server/apiRoute";
import { setTemplateKey } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async ({ sql, user }) => {
    const body = await readJson(request);
    const templateKey = await setTemplateKey(sql, user.id, (await params).id, body.template_key);
    return Response.json({ ok: true, template_key: templateKey });
  }, { allowGuest: true });
}
