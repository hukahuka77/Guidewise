import { notConfigured } from "@/lib/server/apiRoute";
import { isGoogleConfigured } from "@/lib/server/googlePlaces";
import { photoQuerySignatureValid } from "@/lib/guidebook/placePhotos";
import { resolvePlacePhoto } from "@/lib/server/placesService";
import { clientIp, rateLimited } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

// Public (no auth): guidebook pages embed these URLs. The CDN caches the bytes for a week, so only
// cache misses get here; the per-visitor limit stops scripts from spending the Google quota.
const PHOTOS_PER_MINUTE = 120;
const CACHE_CONTROL = "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";

export async function GET(request: Request) {
  if (!isGoogleConfigured()) return notConfigured();
  if (rateLimited(`place-photo:${clientIp(request)}`, PHOTOS_PER_MINUTE)) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const params = new URL(request.url).searchParams;
  const photoReference = (params.get("photo_reference") || "").trim();
  const placeId = (params.get("place_id") || "").trim();
  // The name search costs a Google Text Search per request, so it only runs for links our pages signed
  const rawQuery = (params.get("query") || "").trim().slice(0, 300);
  const query = rawQuery && photoQuerySignatureValid(rawQuery, params.get("sig") || "") ? rawQuery : "";
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
