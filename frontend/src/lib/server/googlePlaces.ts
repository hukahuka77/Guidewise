// Google Places (New) / Routes client (full API responses are never logged).
//
// Callers get the same shapes the legacy Places API returned ({ results: [...] } for a search,
// { result: {...} } for details, photos as { photo_reference }), so only this file knows about the
// new API. Every call names the fields it needs: Google bills each call at the tier of the costliest
// field requested, so asking for less is cheaper.

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_URL = "https://places.googleapis.com/v1/places/";
const PHOTO_MEDIA_URL = "https://places.googleapis.com/v1/";
const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const TIMEOUT_MS = 10_000;
// A coordinate search prefers results within this distance (Google's maximum)
const BIAS_RADIUS_METERS = 50_000;

type Dict = Record<string, unknown>;
const asDict = (v: unknown): Dict => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Dict) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export const googleApiKey = () => process.env.GOOGLE_API_KEY || "";
export const isGoogleConfigured = () => googleApiKey() !== "";

async function fetchJson(url: string, init: RequestInit = {}): Promise<Dict> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    // Google's reason ("API not enabled", "referer blocked", ...) makes a key setup problem obvious in the logs
    const reason = str(asDict(asDict(await res.json().catch(() => null)).error).message).slice(0, 200);
    throw new Error(`Google API ${res.status} for ${new URL(url).pathname}${reason ? `: ${reason}` : ""}`);
  }
  return asDict(await res.json());
}

const headers = (fieldMask: string) => ({
  "Content-Type": "application/json",
  "X-Goog-Api-Key": googleApiKey(),
  "X-Goog-FieldMask": fieldMask,
});

const LAT_LNG = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * What a search returns: place ids only (free), or ids with name and address (billed as Text Search
 * Pro). Recommendations and photo recovery only need the id; the place search box shows names.
 */
export type SearchFields = "ids" | "summary";
const SEARCH_MASKS: Record<SearchFields, string> = {
  ids: "places.id",
  summary: "places.id,places.displayName,places.formattedAddress",
};

/**
 * Text Search. `location` may be "lat,lng" (results near it are preferred) or an address, which goes
 * into the query text instead ("coffee near 12 Main St").
 */
export async function googlePlacesTextSearch(query: string, location?: string | null, fields: SearchFields = "ids"): Promise<Dict> {
  const coords = location ? LAT_LNG.exec(location) : null;
  const body: Dict = { textQuery: location && !coords ? `${query} near ${location}` : query };
  if (coords) {
    body.locationBias = {
      circle: { center: { latitude: Number(coords[1]), longitude: Number(coords[2]) }, radius: BIAS_RADIUS_METERS },
    };
  }
  const data = await fetchJson(SEARCH_TEXT_URL, { method: "POST", headers: headers(SEARCH_MASKS[fields]), body: JSON.stringify(body) });
  return {
    results: asList(data.places).map((p) => {
      const place = asDict(p);
      return { place_id: str(place.id), name: str(asDict(place.displayName).text), formatted_address: str(place.formattedAddress) };
    }),
  };
}

/**
 * What a details lookup returns, cheapest first: photos only and address with photos are billed as
 * Place Details Essentials; "full" adds name, website and rating (Enterprise) for the place picker.
 */
export type DetailFields = "photos" | "address" | "full";
const DETAIL_MASKS: Record<DetailFields, string> = {
  photos: "photos",
  address: "formattedAddress,photos",
  full: "displayName,formattedAddress,photos,websiteUri,rating,types,location",
};

export async function googlePlacesDetails(placeId: string, fields: DetailFields = "full"): Promise<Dict> {
  const place = await fetchJson(`${PLACE_URL}${encodeURIComponent(placeId)}`, { headers: headers(DETAIL_MASKS[fields]) });
  const location = asDict(place.location);
  return {
    result: {
      name: str(asDict(place.displayName).text),
      formatted_address: str(place.formattedAddress),
      photos: asList(place.photos).map((p) => ({ photo_reference: str(asDict(p).name) })),
      website: str(place.websiteUri),
      rating: typeof place.rating === "number" ? place.rating : undefined,
      types: asList(place.types),
      ...(typeof location.latitude === "number" ? { geometry: { location: { lat: location.latitude, lng: location.longitude } } } : {}),
    },
  };
}

/**
 * Image URL for a photo reference ("places/<id>/photos/<id>"). References saved by the legacy API
 * can't be fetched any more; the photo proxy then gets a fresh one from the item's place id.
 */
const PHOTO_REFERENCE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export function googlePlacesPhotoUrl(photoReference: string, maxwidth = 800): string {
  // References reach the photo proxy from public URLs: anything else (legacy references, "..") is refused
  if (!PHOTO_REFERENCE.test(photoReference)) return "";
  const params = new URLSearchParams({ maxWidthPx: String(maxwidth), key: googleApiKey() });
  return `${PHOTO_MEDIA_URL}${photoReference}/media?${params}`;
}

/** Current photo reference for a durable place id (references expire; place ids do not). */
export async function googlePlacesPhotoReference(placeId: string): Promise<string | null> {
  const details = await googlePlacesDetails(placeId, "photos");
  const ref = asDict(asList(asDict(details.result).photos)[0]).photo_reference;
  return typeof ref === "string" && ref ? ref : null;
}

export interface Drive {
  durationMinutes: number | null;
  distanceMeters: number | null;
}

/** Typical driving time and distance (Routes API, without live traffic: billed as Essentials). */
export async function googleDistanceMatrix(origin: string, destination: string): Promise<Drive> {
  try {
    const data = await fetchJson(ROUTES_API_URL, {
      method: "POST",
      headers: headers("routes.duration,routes.distanceMeters"),
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    });
    const route = asDict(asList(data.routes)[0]);
    const durationStr = str(route.duration);
    const seconds = durationStr.endsWith("s") ? Number.parseInt(durationStr.slice(0, -1), 10) : NaN;
    return {
      durationMinutes: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds / 60) : null,
      distanceMeters: typeof route.distanceMeters === "number" ? route.distanceMeters : null,
    };
  } catch {
    return { durationMinutes: null, distanceMeters: null };
  }
}
