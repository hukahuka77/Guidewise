import { withUser } from "@/lib/server/apiRoute";
import { listHosts } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

export function GET(request: Request) {
  return withUser(request, async ({ sql, user }) => Response.json({ hosts: await listHosts(sql, user.id) }), {
    fallbackOnError: true,
  });
}
