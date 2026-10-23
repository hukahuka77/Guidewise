import { withUser } from "@/lib/server/apiRoute";
import { listGuidebooks } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

export function GET(request: Request) {
  return withUser(
    request,
    async ({ sql, user }) => Response.json({ ok: true, items: await listGuidebooks(sql, user.id) }),
  );
}
