import { withAuth, readJson } from "@/lib/server/apiRoute";
import { isGoogleConfigured } from "@/lib/server/googlePlaces";
import { searchPlaces } from "@/lib/server/placesService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

export function POST(request: Request) {
  return withAuth(
    request,
    async () => {
      const data = await readJson(request);
      const query = typeof data.query === "string" ? data.query.trim() : "";
      const near = typeof data.near === "string" ? data.near.trim() : "";
      if (!query) return Response.json({ error: "query is required" }, { status: 400 });
      try {
        return Response.json({ items: await searchPlaces(query, near || null) });
      } catch (error) {
        console.error("places_search error", error);
        return Response.json({ error: "Failed to search places" }, { status: 502 });
      }
    },
    { needs: isGoogleConfigured, rateLimit: { name: "api_places_search", limit: 60 } },
  );
}
