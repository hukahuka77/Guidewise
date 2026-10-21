import { withAuth } from "@/lib/server/apiRoute";
import { isGoogleConfigured } from "@/lib/server/googlePlaces";
import { enrichPlace } from "@/lib/server/placesService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

export function GET(request: Request) {
  return withAuth(
    request,
    async () => {
      const params = new URL(request.url).searchParams;
      const placeId = (params.get("place_id") || "").trim();
      const origin = (params.get("origin") || "").trim();
      if (!placeId) return Response.json({ error: "place_id is required" }, { status: 400 });
      try {
        return Response.json(await enrichPlace(placeId, origin));
      } catch (error) {
        console.error("places_enrich error", error);
        return Response.json({ error: "Failed to enrich place" }, { status: 502 });
      }
    },
    { needs: isGoogleConfigured, rateLimit: { name: "api_places_enrich", limit: 60 } },
  );
}
