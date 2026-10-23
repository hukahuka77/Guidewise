// Google Places / Distance Matrix client (full API responses are never logged).

const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo";
const DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";
const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const TIMEOUT_MS = 10_000;

type Dict = Record<string, unknown>;
const asDict = (v: unknown): Dict => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Dict) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const googleApiKey = () => process.env.GOOGLE_API_KEY || "";
export const isGoogleConfigured = () => googleApiKey() !== "";

async function fetchJson(url: string, init: RequestInit = {}): Promise<Dict> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Google API ${res.status} for ${new URL(url).pathname}`);
  return asDict(await res.json());
}

export function googlePlacesTextSearch(query: string, location?: string | null): Promise<Dict> {
  const params = new URLSearchParams({ query, key: googleApiKey() });
  if (location) params.set("location", location);
  return fetchJson(`${TEXT_SEARCH_URL}?${params}`);
}

export function googlePlacesDetails(placeId: string): Promise<Dict> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "name,formatted_address,photos,website,rating,geometry,types",
    key: googleApiKey(),
  });
  return fetchJson(`${DETAILS_URL}?${params}`);
}

export function googlePlacesPhotoUrl(photoReference: string, maxwidth = 800): string {
  const params = new URLSearchParams({ maxwidth: String(maxwidth), photo_reference: photoReference, key: googleApiKey() });
  return `${PHOTO_URL}?${params}`;
}

/** Current photo reference for a durable place id (references expire; place ids do not). */
export async function googlePlacesPhotoReference(placeId: string): Promise<string | null> {
  const details = await googlePlacesDetails(placeId);
  const photos = asList(asDict(details.result).photos);
  const ref = asDict(photos[0]).photo_reference;
  return typeof ref === "string" && ref ? ref : null;
}

export interface Drive {
  durationMinutes: number | null;
  distanceMeters: number | null;
}

/** Driving time/distance: Routes API first, legacy Distance Matrix as a fallback. */
export async function googleDistanceMatrix(origin: string, destination: string): Promise<Drive> {
  try {
    const data = await fetchJson(ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey(),
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });
    const route = asDict(asList(data.routes)[0]);
    if (Object.keys(route).length > 0) {
      const durationStr = typeof route.duration === "string" ? route.duration : "";
      let seconds: number | null = null;
      if (durationStr.endsWith("s")) {
        const parsed = Number.parseInt(durationStr.slice(0, -1), 10);
        if (Number.isFinite(parsed)) seconds = parsed;
      }
      return {
        durationMinutes: seconds ? Math.round(seconds / 60) : null,
        distanceMeters: typeof route.distanceMeters === "number" ? route.distanceMeters : null,
      };
    }
  } catch {
    // fall through to the legacy API
  }

  try {
    const params = new URLSearchParams({ origins: origin, destinations: destination, mode: "driving", key: googleApiKey() });
    const data = await fetchJson(`${DISTANCE_MATRIX_URL}?${params}`);
    if (data.status !== "OK") return { durationMinutes: null, distanceMeters: null };
    const element = asDict(asList(asDict(asList(data.rows)[0]).elements)[0]);
    if (element.status !== "OK") return { durationMinutes: null, distanceMeters: null };
    const seconds = asDict(element.duration).value;
    const meters = asDict(element.distance).value;
    return {
      durationMinutes: typeof seconds === "number" && seconds ? Math.round(seconds / 60) : null,
      distanceMeters: typeof meters === "number" ? meters : null,
    };
  } catch {
    return { durationMinutes: null, distanceMeters: null };
  }
}
