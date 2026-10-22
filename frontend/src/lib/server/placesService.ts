import {
  googleDistanceMatrix,
  googlePlacesDetails,
  googlePlacesPhotoReference,
  googlePlacesPhotoUrl,
  googlePlacesTextSearch,
} from "./googlePlaces";

type Dict = Record<string, unknown>;
const asDict = (v: unknown): Dict => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Dict) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Port of `places_search`: minimal normalized items, at most 8. */
export async function searchPlaces(query: string, near: string | null) {
  const resp = await googlePlacesTextSearch(query, near || null);
  return asList(resp.results)
    .slice(0, 8)
    .map((r) => {
      const d = asDict(r);
      return { name: str(d.name), address: str(d.formatted_address), place_id: str(d.place_id) };
    });
}

// Python's str.title(): uppercase the first letter of each alphabetic run, lowercase the rest.
const pyTitle = (s: string) => s.toLowerCase().replace(/[a-z]+/g, (w) => w[0].toUpperCase() + w.slice(1));

/** Port of `places_enrich`. */
export async function enrichPlace(placeId: string, origin: string) {
  const det = await googlePlacesDetails(placeId);
  const result = asDict(det.result);
  const name = str(result.name);
  const address = str(result.formatted_address);
  const website = str(result.website);
  const rating = result.rating;
  const types = asList(result.types);
  const parts: string[] = [];
  if (rating !== undefined && rating !== null) parts.push(`Rating ${rating}`);
  if (types.length > 0) parts.push(pyTitle(str(types[0]).replace(/_/g, " ")));
  if (website) parts.push(website);
  const description = parts.filter(Boolean).join(" • ");
  const ref = str(asDict(asList(result.photos)[0]).photo_reference);

  let drivingMinutes: number | null = null;
  if (origin && address) drivingMinutes = (await googleDistanceMatrix(origin, address)).durationMinutes;

  return { name, address, description, place_id: placeId, image_url: ref, driving_minutes: drivingMinutes };
}

export interface PhotoBytes {
  body: ArrayBuffer;
  contentType: string;
}

async function fetchPhoto(reference: string, maxwidth: number): Promise<PhotoBytes | null> {
  try {
    const res = await fetch(googlePlacesPhotoUrl(reference, maxwidth), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) return null;
    return { body: await res.arrayBuffer(), contentType };
  } catch {
    return null;
  }
}

/**
 * Port of `get_place_photo`: prefer a fresh reference resolved from the durable place id, then the
 * stored reference, then (legacy guidebooks only) recover via a text search of `query`.
 */
export async function resolvePlacePhoto(args: {
  photoReference: string;
  placeId: string;
  query: string;
  maxwidth: number;
}): Promise<PhotoBytes | null> {
  const { photoReference, placeId, query, maxwidth } = args;
  const references: string[] = [];
  if (placeId) {
    try {
      const current = await googlePlacesPhotoReference(placeId);
      if (current) references.push(current);
    } catch (error) {
      console.warn(`Could not refresh photo for place_id ${placeId}`, error);
    }
  }
  if (photoReference && !references.includes(photoReference)) references.push(photoReference);

  for (const reference of references) {
    const photo = await fetchPhoto(reference, maxwidth);
    if (photo) return photo;
  }

  if (query && !placeId) {
    try {
      const results = asList((await googlePlacesTextSearch(query)).results);
      const recoveredId = str(asDict(results[0]).place_id);
      const recovered = recoveredId ? await googlePlacesPhotoReference(recoveredId) : null;
      if (recovered) {
        const photo = await fetchPhoto(recovered, maxwidth);
        if (photo) return photo;
      }
    } catch (error) {
      console.warn(`Could not recover legacy place photo for ${JSON.stringify(query)}`, error);
    }
  }
  return null;
}
