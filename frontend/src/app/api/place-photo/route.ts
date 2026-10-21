import { isGoogleConfigured } from "@/lib/server/googlePlaces";
import { proxyToBackend } from "@/lib/server/proxy";
import { resolvePlacePhoto } from "@/lib/server/placesService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

// Public (no auth), like Flask: guidebook pages embed these URLs. The CDN caches the bytes for a week.
const CACHE_CONTROL = "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";

export async function GET(request: Request) {
  if (!isGoogleConfigured()) return proxyToBackend(request);

  const params = new URL(request.url).searchParams;
  const photoReference = (params.get("photo_reference") || "").trim();
  const placeId = (params.get("place_id") || "").trim();
  const query = (params.get("query") || "").trim().slice(0, 300);
  const rawWidth = params.get("maxwidth") ?? "800";
  if (!/^[+-]?\d+$/.test(rawWidth.trim())) {
    return Response.json({ error: "maxwidth must be an integer" }, { status: 400 });
  }
  const maxwidth = Math.max(1, Math.min(Number.parseInt(rawWidth, 10), 1600));

  if (!photoReference && !placeId) {
    return Response.json({ error: "place_id or photo_reference required" }, { status: 400 });
  }

  const photo = await resolvePlacePhoto({ photoReference, placeId, query, maxwidth });
  if (!photo) return Response.json({ error: "Place photo is unavailable" }, { status: 404 });
  return new Response(photo.body, {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": CACHE_CONTROL,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
