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
      const recs = await getAiRecommendations("food", String(address), clampItems(data.num_places_to_eat ?? 5));
      return Response.json(recs.length ? recs : { error: "Could not get recommendations" });
    },
    { needs: aiConfigured, rateLimit: { name: "api_ai-food", limit: 10 } },
  );
}
