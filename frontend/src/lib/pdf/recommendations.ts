import { googlePhotoReference, placePhotoUrl } from "@/lib/guidebook/placePhotos";
import { parsePythonLiteral, pyTruthy } from "@/lib/guidebook/pyCompat";

// PDFs are rendered by a headless browser that
// cannot call our photo proxy with the user's session, so Google photos are resolved to direct URLs.

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);

export interface PhotoResolver {
  /** Current photo reference for a place id (may throw). */
  photoReference(placeId: string): Promise<string | null>;
  /** First place id matching a text query (may throw). */
  findPlaceId(query: string): Promise<string | null>;
  photoUrl(reference: string): string;
}

export interface NormalizedItem {
  name: string;
  description: string;
  address: string;
  image_url: string;
  place_id: string;
  driving_minutes?: number;
}

const pyStr = (v: unknown) => (pyTruthy(v) ? String(v) : "");

function parseItem(raw: unknown): Dict | null {
  if (isDict(raw)) return raw;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  try {
    const parsed = JSON.parse(s);
    if (isDict(parsed)) return parsed;
  } catch {
    // not JSON; try a Python literal below
  }
  try {
    const val = parsePythonLiteral(s);
    if (isDict(val)) return val;
  } catch {
    // plain text
  }
  return null;
}

export async function normalizeRecommendations(items: unknown, resolver: PhotoResolver): Promise<NormalizedItem[]> {
  if (!Array.isArray(items) || items.length === 0) return [];
  return Promise.all(
    items.map(async (raw): Promise<NormalizedItem> => {
      const obj = parseItem(raw) ?? { name: String(raw) };
      const item: NormalizedItem = {
        name: pyStr(obj.name) || pyStr(obj.title) || JSON.stringify(obj),
        description: pyStr(obj.description),
        address: pyStr(obj.address),
        image_url: pyStr(obj.image_url) || pyStr(obj.photo),
        place_id: pyStr(obj.place_id),
      };
      // Templates show the drive time when present
      if (pyTruthy(obj.driving_minutes)) item.driving_minutes = obj.driving_minutes as number;

      if (placePhotoUrl(item).startsWith("/api/place-photo")) {
        let reference: string | null = null;
        if (item.place_id) {
          try {
            reference = await resolver.photoReference(item.place_id);
          } catch (error) {
            console.warn("Failed to refresh PDF place photo", error);
          }
        } else if (item.name || item.address) {
          try {
            const placeId = await resolver.findPlaceId([item.name, item.address].filter(Boolean).join(", "));
            reference = placeId ? await resolver.photoReference(placeId) : null;
          } catch (error) {
            console.warn("Failed to recover legacy PDF place photo", error);
          }
        }
        reference = reference || googlePhotoReference(item.image_url);
        item.image_url = reference ? resolver.photoUrl(reference) : "";
      }
      return item;
    }),
  );
}
