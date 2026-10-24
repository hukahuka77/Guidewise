import { randomUUID } from "node:crypto";
import { DEFAULT_TEMPLATE_KEY } from "@/lib/guidebook/render";
import type { Sql } from "./db";
import { MAX_PROPERTY_NAME, uniqueSlug } from "./guidebookService";
import type { Recommendations } from "./importPopulate";
import type { ImportedFields } from "./listingImport";
import { assertCanCreateGuidebook, lockGuidebookCreation } from "./usage";

// DB half of `/api/import-listing`: the imported guidebook is live at its slug straight away.

const LABELS: [keyof ImportedFields | "cover_image_url" | "things_to_do" | "places_to_eat", string][] = [
  ["property_name", "property name"],
  ["host_name", "host name"],
  ["host_bio", "host bio"],
  ["welcome_message", "welcome message"],
  ["address_city_state", "city"],
  ["address_street", "street address"],
  ["check_in_time", "check-in time"],
  ["check_out_time", "check-out time"],
  ["access_info", "access instructions"],
  ["parking_info", "parking info"],
  ["wifi_network", "Wi-Fi network"],
  ["house_rules", "house rules"],
  ["house_manual", "house manual"],
  ["checkout_info", "checkout instructions"],
  ["cover_image_url", "cover image"],
  ["things_to_do", "things to do"],
  ["places_to_eat", "places to eat"],
];

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

export async function createImportedGuidebook(
  sql: Sql,
  userId: string,
  fields: ImportedFields & { cover_image_url: string | null },
  recommendations: Recommendations = { things_to_do: [], places_to_eat: [] },
) {
  await assertCanCreateGuidebook(sql, userId);
  const propertyName = (fields.property_name || "My Property").slice(0, MAX_PROPERTY_NAME);

  const guidebookId = await sql.begin(async (tx) => {
    await lockGuidebookCreation(tx as unknown as Sql, userId);
    let hostId: number | null = null;
    if (fields.host_name) {
      const found = await tx`select id, bio from host where name = ${fields.host_name} and user_id = ${userId} order by id limit 1`;
      hostId = found[0]?.id ?? (await tx`insert into host (name, bio, user_id) values (${fields.host_name}, ${fields.host_bio || null}, ${userId}) returning id`)[0].id;
      if (found[0] && !found[0].bio && fields.host_bio) await tx`update host set bio = ${fields.host_bio} where id = ${hostId}`;
    }

    let propertyId: number;
    const existing = await tx`select id, address_city_state, address_street, address_zip from property where name = ${propertyName} and user_id = ${userId} order by id limit 1`;
    if (existing.length === 0) {
      const [row] = await tx`
        insert into property (name, address_street, address_city_state, address_zip, user_id)
        values (${propertyName}, ${fields.address_street || null}, ${fields.address_city_state || null}, ${fields.address_zip || null}, ${userId}) returning id`;
      propertyId = row.id;
    } else {
      propertyId = existing[0].id;
      // Only fill what the host has not already entered for this property
      if (fields.address_city_state && !existing[0].address_city_state) {
        await tx`update property set address_city_state = ${fields.address_city_state} where id = ${propertyId}`;
      }
      if (fields.address_street && !existing[0].address_street) {
        await tx`update property set address_street = ${fields.address_street} where id = ${propertyId}`;
      }
      if (fields.address_zip && !existing[0].address_zip) {
        await tx`update property set address_zip = ${fields.address_zip} where id = ${propertyId}`;
      }
    }

    const id = randomUUID();
    const publicSlug = await uniqueSlug(tx as unknown as Sql, propertyName, id);
    const json = (v: unknown[]) => (v.length ? tx.json(v as never) : null);
    const tabs = ["welcome", "checkin", "property", "food", "activities", "rules", "checkout"];
    const wifi = fields.wifi_network ? { network: fields.wifi_network } : null;
    await tx`
      insert into guidebook (
        id, check_in_time, check_out_time, access_info, welcome_info, parking_info, cover_image_url, house_manual,
        checkout_info, rules_json, things_to_do, places_to_eat, wifi_json, custom_sections, custom_tabs_meta,
        included_tabs, template_key, host_id, property_id, user_id, public_slug
      ) values (
        ${id}, ${fields.check_in_time || "15:00"}, ${fields.check_out_time || "11:00"}, ${fields.access_info || null},
        ${fields.welcome_message || null}, ${fields.parking_info || null}, ${fields.cover_image_url || null},
        ${json(fields.house_manual)}, ${json(fields.checkout_info)}, ${json(fields.house_rules)},
        ${tx.json(recommendations.things_to_do as never)}, ${tx.json(recommendations.places_to_eat as never)},
        ${wifi ? tx.json(wifi as never) : null}, ${tx.json({} as never)}, ${null},
        ${tx.json(tabs as never)},
        ${DEFAULT_TEMPLATE_KEY}, ${hostId}, ${propertyId}, ${userId}, ${publicSlug}
      )`;
    return id;
  });

  const all = { ...fields, things_to_do: recommendations.things_to_do, places_to_eat: recommendations.places_to_eat };
  return {
    ok: true,
    guidebook_id: guidebookId,
    imported: LABELS.filter(([k]) => filled(all[k as keyof typeof all])).map(([, label]) => label),
    missing: LABELS.filter(([k]) => !filled(all[k as keyof typeof all])).map(([, label]) => label),
    recommendations: {
      things_to_do: recommendations.things_to_do.length,
      places_to_eat: recommendations.places_to_eat.length,
      ...(recommendations.skipped ? { skipped: recommendations.skipped } : {}),
    },
  };
}
