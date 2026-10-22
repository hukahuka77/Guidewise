import { withAuth, readJson } from "@/lib/server/apiRoute";
import { aiConfigured, getAiRecommendations } from "@/lib/server/aiRecommendations";
import { clampItems } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "iad1";

/** Legacy endpoint; kept so older clients keep working. */
export function POST(request: Request) {
  return withAuth(
    request,
    async () => {
      const data = await readJson(request);
      const address = data.location || data.address;
      if (!address || !String(address).trim()) {
        return Response.json({ error: "Please provide a valid location to generate recommendations." }, { status: 400 });
      }
      const activities = await getAiRecommendations("activities", String(address), clampItems(data.num_things_to_do ?? 5));
      // Flask returned {"activities": [...]} even when empty (an empty dict is falsy only when the list is missing)
      return Response.json({ activities });
    },
    { needs: aiConfigured, rateLimit: { name: "api_ai-activities", limit: 10 } },
  );
}
