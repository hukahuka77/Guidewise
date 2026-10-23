import { unquotePlus, urlencodeParams } from "./pyCompat";

type Dict = Record<string, unknown>;

const pyStr = (v: unknown): string => (v ? String(v) : "");

/** The Google photo reference stored in an item's image URL, if any. */
export function googlePhotoReference(imageUrl: string): string {
  const value = (imageUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    const m = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/.exec(value);
    if (!m) return "";
    const [, netloc, path, query = ""] = m;
    if (netloc.endsWith("googleapis.com") && path.includes("/place/photo")) {
      for (const pair of query.split("&")) {
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        if (unquotePlus(pair.slice(0, eq)) !== "photo_reference") continue;
        const val = unquotePlus(pair.slice(eq + 1));
        if (val) return val; // parse_qs drops blank values
      }
    }
    return "";
  }
  return value;
}

/** Port of `place_photo_url`: hosted images pass through, Google photos go via our proxy. */
export function placePhotoUrl(item: unknown, maxwidth = 800): string {
  if (typeof item !== "object" || item === null || Array.isArray(item)) return "";
  const rec = item as Dict;

  const imageUrl = pyStr(rec.image_url).trim();
  const placeId = pyStr(rec.place_id).trim();

  let googleReference: string;
  if (/^(https?:\/\/|data:)/.test(imageUrl)) {
    googleReference = googlePhotoReference(imageUrl);
    if (!googleReference) return imageUrl;
  } else {
    googleReference = imageUrl;
  }

  if (!placeId && !googleReference) return "";

  const params: Record<string, string | number> = {
    maxwidth: Math.max(1, Math.min(Math.trunc(Number(maxwidth)), 1600)),
  };
  if (placeId) params.place_id = placeId;
  if (googleReference) params.photo_reference = googleReference;

  const name = pyStr(rec.name).trim();
  const address = pyStr(rec.address).trim();
  const query = [name, address].filter(Boolean).join(", ");
  if (query) params.query = query.slice(0, 300);

  return `/api/place-photo?${urlencodeParams(params)}`;
}
