const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * The address drive times start from: the street address, with the city and zip added when the street
 * doesn't already include them. Without a street address there is no exact starting point, so none.
 */
export function driveOrigin(street: unknown, cityState?: unknown, zip?: unknown): string | null {
  const s = str(street);
  if (!s) return null;
  if (s.includes(",")) return s; // a full address, e.g. picked from the address suggestions
  return [s, str(cityState), str(zip)].filter(Boolean).join(", ");
}
