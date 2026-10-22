import { withAuth, readJson } from "@/lib/server/apiRoute";
import { aiConfigured, getAiRecommendations, isKnownType } from "@/lib/server/aiRecommendations";
import { getSql } from "@/lib/server/db";
import { clampItems } from "@/lib/server/rateLimit";
import { consumeAiQuota, refundAiQuota } from "@/lib/server/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "iad1";

export function POST(request: Request) {
  return withAuth(
    request,
    async (user) => {
      const data = await readJson(request);
      const type = data.type;
      const address = data.location || data.address;
      const numItems = clampItems(data.num_items ?? 5);
      if (!type) {
        return Response.json(
          { error: "Please provide a recommendation type (food, activities, nightlife, etc.)" },
          { status: 400 },
        );
      }
      if (!address || !String(address).trim()) {
        return Response.json({ error: "Please provide a valid location to generate recommendations." }, { status: 400 });
      }
      if (!isKnownType(type)) {
        return Response.json({ error: `Unknown recommendation type: ${String(type)}. Available types: food, activities, nightlife` }, { status: 400 });
      }
      const sql = getSql();
      if (sql) await consumeAiQuota(sql, user.id);
      try {
        const recs = await getAiRecommendations(type, String(address), numItems);
        if (sql && recs.length === 0) await refundAiQuota(sql, user.id);
        return Response.json(recs);
      } catch {
        if (sql) await refundAiQuota(sql, user.id);
        return Response.json({ error: "Could not get recommendations" }, { status: 500 });
      }
    },
    { needs: aiConfigured, rateLimit: { name: "api_ai-recommendations", limit: 10 } },
  );
}
