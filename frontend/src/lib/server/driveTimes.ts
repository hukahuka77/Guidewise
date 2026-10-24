import { driveOrigin } from "@/lib/driveOrigin";
import type { Sql } from "./db";
import { googleDriveMinutes, isGoogleConfigured } from "./googlePlaces";

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The items with driving minutes from `origin` (null for all of them without an origin). */
export async function withDriveTimes<T>(origin: string | null, items: T[]): Promise<T[]> {
  const places = items.map((item) => (isDict(item) ? item : null));
  if (!origin || !isGoogleConfigured()) return items.map((item, i) => (places[i] ? ({ ...places[i], driving_minutes: null } as T) : item));
  const minutes = await googleDriveMinutes(origin, places.map((p) => str(p?.address)));
  return items.map((item, i) => (places[i] ? ({ ...places[i], driving_minutes: minutes[i] } as T) : item));
}

/**
 * Re-measure a guidebook's things to do and places to eat from its current address, after the address
 * changed. Best effort: drive times are a nice-to-have and never fail a save.
 */
export async function refreshGuidebookDriveTimes(sql: Sql, guidebookId: string): Promise<void> {
  try {
    const [row] = await sql`
      select g.things_to_do, g.places_to_eat, p.address_street, p.address_city_state, p.address_zip
        from guidebook g left join property p on p.id = g.property_id
       where g.id = ${guidebookId}`;
    if (!row) return;
    const things = Array.isArray(row.things_to_do) ? row.things_to_do : [];
    const eats = Array.isArray(row.places_to_eat) ? row.places_to_eat : [];
    if (things.length + eats.length === 0) return;
    const origin = driveOrigin(row.address_street, row.address_city_state, row.address_zip);
    const updated = await withDriveTimes(origin, [...things, ...eats]);
    await sql`
      update guidebook
         set things_to_do = ${sql.json(updated.slice(0, things.length) as never)},
             places_to_eat = ${sql.json(updated.slice(things.length) as never)}
       where id = ${guidebookId}`;
  } catch (error) {
    console.warn("Could not refresh drive times", error);
  }
}
