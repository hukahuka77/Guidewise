import { randomUUID } from "node:crypto";
import type { Sql } from "./db";
import type { ImportedFields } from "./listingImport";
import { assertCanCreateGuidebook } from "./usage";

// DB half of `/api/import-listing` (backend/app.py): always a draft, never auto-activated.

const LABELS: [keyof ImportedFields | "cover_image_url", string][] = [
  ["property_name", "property name"],
  ["host_name", "host name"],
  ["welcome_message", "welcome message"],
  ["address_city_state", "city"],
  ["check_in_time", "check-in time"],
  ["check_out_time", "check-out time"],
  ["parking_info", "parking info"],
  ["house_rules", "house rules"],
  ["house_manual", "house manual"],
  ["checkout_info", "checkout instructions"],
  ["cover_image_url", "cover image"],
];

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

export async function createImportedGuidebook(
  sql: Sql,
  userId: string,
  fields: ImportedFields & { cover_image_url: string | null },
) {
  await assertCanCreateGuidebook(sql, userId);
  const propertyName = fields.property_name || "My Property";

  const guidebookId = await sql.begin(async (tx) => {
    let hostId: number | null = null;
    if (fields.host_name) {
      const found = await tx`select id from host where name = ${fields.host_name} and user_id = ${userId} order by id limit 1`;
      hostId = found[0]?.id ?? (await tx`insert into host (name, user_id) values (${fields.host_name}, ${userId}) returning id`)[0].id;
    }

    let propertyId: number;
    const existing = await tx`select id, address_city_state from property where name = ${propertyName} and user_id = ${userId} order by id limit 1`;
    if (existing.length === 0) {
      const [row] = await tx`
        insert into property (name, address_city_state, user_id)
        values (${propertyName}, ${fields.address_city_state || null}, ${userId}) returning id`;
      propertyId = row.id;
    } else {
      propertyId = existing[0].id;
      if (fields.address_city_state && !existing[0].address_city_state) {
        await tx`update property set address_city_state = ${fields.address_city_state} where id = ${propertyId}`;
      }
    }

    const id = randomUUID();
    const json = (v: unknown[]) => (v.length ? tx.json(v as never) : null);
    await tx`
      insert into guidebook (
        id, check_in_time, check_out_time, welcome_info, parking_info, cover_image_url, house_manual,
        checkout_info, rules_json, included_tabs, template_key, host_id, property_id, user_id, active, public_slug
      ) values (
        ${id}, ${fields.check_in_time || "15:00"}, ${fields.check_out_time || "11:00"},
        ${fields.welcome_message || null}, ${fields.parking_info || null}, ${fields.cover_image_url || null},
        ${json(fields.house_manual)}, ${json(fields.checkout_info)}, ${json(fields.house_rules)},
        ${tx.json(["welcome", "checkin", "property", "food", "activities", "rules", "checkout"] as never)},
        'template_original', ${hostId}, ${propertyId}, ${userId}, false, null
      )`;
    return id;
  });

  return {
    ok: true,
    guidebook_id: guidebookId,
    imported: LABELS.filter(([k]) => filled(fields[k])).map(([, label]) => label),
    missing: LABELS.filter(([k]) => !filled(fields[k])).map(([, label]) => label),
  };
}
