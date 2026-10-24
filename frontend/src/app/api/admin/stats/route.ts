import { withUser } from "@/lib/server/apiRoute";
import { adminStats } from "@/lib/server/adminStats";
import { isAdmin } from "@/lib/server/gifts";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Signups, sources, guidebooks, plans and views for the admin dashboard tab. Admins only. */
export function GET(request: Request) {
  return withUser(request, async ({ sql, user }) => {
    if (!isAdmin(user.email)) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(await adminStats(sql), { headers: { "Cache-Control": "private, no-store" } });
  });
}
