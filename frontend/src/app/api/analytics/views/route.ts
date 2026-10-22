import { withUser } from "@/lib/server/apiRoute";
import { getUserPlan, viewStats } from "@/lib/server/usage";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** Guest views this month (all plans) and, on plans with analytics, a 30-day daily series per guidebook. */
export function GET(request: Request) {
  return withUser(request, async ({ sql, user }) => {
    const plan = await getUserPlan(sql, user.id);
    return Response.json(await viewStats(sql, user.id, plan));
  });
}
