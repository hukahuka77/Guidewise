import { withAuth, readJson } from "@/lib/server/apiRoute";
import { aiConfigured, getAiRecommendations } from "@/lib/server/aiRecommendations";
import { getSql } from "@/lib/server/db";
import { clampItems } from "@/lib/server/rateLimit";
import { consumeAiQuota, refundAiQuota } from "@/lib/server/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "iad1";

/** Legacy endpoint; kept so older clients keep working. */
export function POST(request: Request) {
  return withAuth(
    request,
    async (user) => {
      const data = await readJson(request);
      const address = data.location || data.address;
      if (!address || !String(address).trim()) {
        return Response.json({ error: "Please provide a valid location to generate recommendations." }, { status: 400 });
      }
      const sql = getSql();
      if (sql) await consumeAiQuota(sql, user.id);
      const recs = await getAiRecommendations("food", String(address), clampItems(data.num_places_to_eat ?? 5));
      if (sql && recs.length === 0) await refundAiQuota(sql, user.id);
      return Response.json(recs.length ? recs : { error: "Could not get recommendations" });
    },
    { needs: aiConfigured, rateLimit: { name: "api_ai-food", limit: 10 } },
  );
}
