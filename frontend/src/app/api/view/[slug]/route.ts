import { getSql } from "@/lib/server/db";
import { rateLimited } from "@/lib/server/rateLimit";
import { getUserPlan, isNonViewRequest, recordView, visitorKey } from "@/lib/server/usage";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * View beacon for pages that are served from the CDN cache (paid plans). Free-plan views are metered when
 * the page itself is served, so those are ignored here.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sql = getSql();
  if (!sql || isNonViewRequest(request)) return noContent();
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (rateLimited(`view:${ip}`, 30)) return noContent();
  try {
    const { slug } = await params;
    const [gb] = await sql`select id, user_id from guidebook where public_slug = ${slug} limit 1`;
    if (!gb?.user_id) return noContent();
    const plan = await getUserPlan(sql, gb.user_id);
    if (plan.viewsPerMonth !== null) return noContent();
    await recordView(sql, gb.id, gb.user_id, visitorKey(request, gb.id));
  } catch (error) {
    console.error("view beacon failed", error);
  }
  return noContent();
}
