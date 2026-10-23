import { randomBytes, randomUUID } from "node:crypto";
import { BASE_TABS } from "@/lib/guidebook/context";
import { stripSurrogates } from "@/lib/guidebook/pyCompat";
import { TEMPLATE_REGISTRY } from "@/lib/guidebook/render";
import type { GuidebookRow } from "@/lib/guidebook/types";
import type { Sql } from "./db";
import { assertCanCreateGuidebook } from "./usage";

// Guidebook CRUD. Everything that touches several tables runs in one transaction.

type Dict = Record<string, unknown>;
type Row = Record<string, unknown>;

export const ALLOWED_TEMPLATE_KEYS = Object.keys(TEMPLATE_REGISTRY);

/** A non-2xx outcome the route should return as `{ error }`. */
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Dict = {},
  ) {
    super(message);
  }
}

const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const isoOrNull = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const isDataUrl = (v: unknown) => typeof v === "string" && v.trim().startsWith("data:");
const trimmedString = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const truthy = (v: unknown) => v !== undefined && v !== null && v !== false && v !== 0 && v !== "";

/** Slug used for public URLs. */
export const MAX_PROPERTY_NAME = 120;

/** A property name that would make an unusable page title and URL is refused rather than silently cut. */
export function assertNameLength(name: unknown): void {
  if (typeof name === "string" && name.trim().length > MAX_PROPERTY_NAME) {
    throw new ServiceError(400, `The property name is too long (${MAX_PROPERTY_NAME} characters at most).`);
  }
}

export function slugify(text: string | null | undefined): string {
  const s = (text || "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return s || "guidebook";
}

const tokenHex = (bytes: number) => randomBytes(bytes).toString("hex");

// ---------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// Public URL
// ---------------------------------------------------------------------------------------------

/** A slug for `/g/<slug>` that no other guidebook uses. */
export async function uniqueSlug(tx: Sql, propertyName: string | null | undefined, guidebookId: string): Promise<string> {
  const base = slugify(propertyName).slice(0, 40).replace(/-+$/, "") || "guidebook";
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = `${base}-${tokenHex(3)}`;
    const taken = await tx`select 1 from guidebook where public_slug = ${slug} and id != ${guidebookId} limit 1`;
    if (taken.length === 0) return slug;
  }
  return `${base}-${tokenHex(4)}-${Math.floor(Date.now() / 1000)}`;
}

/** Every guidebook is live at its slug; guidebooks created before that was true get theirs on first use. */
async function ensurePublicSlug(sql: Sql, guidebookId: string, propertyName: string | null | undefined): Promise<string> {
  const slug = await uniqueSlug(sql, propertyName, guidebookId);
  const updated = await sql`update guidebook set public_slug = ${slug} where id = ${guidebookId} and public_slug is null returning public_slug`;
  if (updated.length > 0) return updated[0].public_slug;
  const [row] = await sql`select public_slug from guidebook where id = ${guidebookId}`;
  return row?.public_slug ?? slug;
}

// ---------------------------------------------------------------------------------------------
// Input normalisation (shared by create and update)
// ---------------------------------------------------------------------------------------------

/** `[{name, description}]` from the rules the editor sends (dicts or "Name: details" strings). */
export function compileRulesInput(rules: unknown): { name: string; description: string }[] {
  const out: { name: string; description: string }[] = [];
  for (const r of Array.isArray(rules) ? rules : []) {
    if (!truthy(r)) continue;
    let name: string;
    let description: string;
    if (isDict(r)) {
      name = truthy(r.name) ? String(r.name).trim() : "";
      description = truthy(r.description) ? String(r.description).trim() : "";
    } else {
      const s = String(r).trim();
      const idx = s.indexOf(":");
      if (idx !== -1) {
        name = s.slice(0, idx).trim();
        description = s.slice(idx + 1).trim();
      } else {
        name = s;
        description = "";
      }
    }
    if (name || description) out.push({ name, description });
  }
  return out;
}

function sanitizeIncludedTabs(value: unknown): string[] {
  const incoming = Array.isArray(value) ? value : [...BASE_TABS];
  return incoming.filter(
    (t): t is string => typeof t === "string" && (BASE_TABS.includes(t) || t.startsWith("custom_")),
  );
}

function sanitizeCustomSections(value: unknown): Dict {
  const out: Dict = {};
  if (!isDict(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith("custom_") && Array.isArray(v)) out[k] = v;
  }
  return out;
}

function sanitizeCustomTabsMeta(value: unknown): Record<string, { label: string; icon: string }> {
  const out: Record<string, { label: string; icon: string }> = {};
  if (!isDict(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith("custom_") && isDict(v)) {
      out[k] = {
        label: v.label != null ? stripSurrogates(String(v.label)) : "",
        icon: v.icon != null ? stripSurrogates(String(v.icon)) : "",
      };
    }
  }
  return out;
}

const jsonOrNull = (client: { json: Sql["json"] }, value: unknown) =>
  value === undefined || value === null ? null : client.json(value as Parameters<Sql["json"]>[0]);

// ---------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------

export interface CreateResult {
  guidebookId: string;
  templateKey: string;
  publicSlug: string;
}

/** POST /api/generate: create host/property/guidebook together; the guidebook is live at its slug straight away. */
export async function createGuidebook(sql: Sql, userId: string, data: Dict): Promise<CreateResult> {
  const propertyName = typeof data.property_name === "string" ? data.property_name : "";
  if (!propertyName.trim()) throw new ServiceError(400, "property_name is required");
  assertNameLength(propertyName);

  const templateKey =
    typeof data.template_key === "string" && ALLOWED_TEMPLATE_KEYS.includes(data.template_key)
      ? data.template_key
      : "template_original";

  const thingsToDo = Array.isArray(data.things_to_do) ? data.things_to_do : [];
  const placesToEat = Array.isArray(data.places_to_eat) ? data.places_to_eat : [];
  const includedTabs = sanitizeIncludedTabs(data.included_tabs);
  const customSections = sanitizeCustomSections(data.custom_sections);
  const customTabsMeta = sanitizeCustomTabsMeta(data.custom_tabs_meta);
  const coverImageUrl = isDataUrl(data.cover_image_url) ? null : (data.cover_image_url ?? null);

  const wifi: Dict = {};
  if (truthy(data.wifi_network)) wifi.network = data.wifi_network;
  if (truthy(data.wifi_password)) wifi.password = data.wifi_password;

  const rules = Array.isArray(data.rules) ? compileRulesInput(data.rules) : null;

  await assertCanCreateGuidebook(sql, userId);

  return sql.begin(async (tx) => {
    // Host (optional)
    let hostId: number | null = null;
    const hostName = trimmedString(data.host_name);
    const hostBio = data.host_bio;
    const hostContact = data.host_contact;
    const hostPhoto = data.host_photo_url;
    if (hostName || truthy(hostBio) || truthy(hostContact) || truthy(hostPhoto)) {
      if (hostName) {
        const found = await tx`select id from host where name = ${hostName} and user_id = ${userId} order by id limit 1`;
        if (found.length > 0) hostId = found[0].id;
      }
      if (hostId === null) {
        const [row] = await tx`insert into host (name, user_id) values (${hostName || null}, ${userId}) returning id`;
        hostId = row.id;
      }
      if (truthy(hostBio)) await tx`update host set bio = ${String(hostBio)} where id = ${hostId}`;
      if (truthy(hostContact)) await tx`update host set contact = ${String(hostContact)} where id = ${hostId}`;
      if (truthy(hostPhoto) && !isDataUrl(hostPhoto)) {
        await tx`update host set host_image_url = ${String(hostPhoto)} where id = ${hostId}`;
      }
    }

    // Property: reuse by name, updating addresses that were sent
    let propertyId: number;
    const existing = await tx`select id from property where name = ${propertyName} and user_id = ${userId} order by id limit 1`;
    const str = (v: unknown) => (v === undefined || v === null ? null : String(v));
    if (existing.length === 0) {
      const [row] = await tx`
        insert into property (name, address_street, address_city_state, address_zip, user_id)
        values (${propertyName}, ${str(data.address_street)}, ${str(data.address_city_state)}, ${str(data.address_zip)}, ${userId})
        returning id`;
      propertyId = row.id;
    } else {
      propertyId = existing[0].id;
      if ("address_street" in data) await tx`update property set address_street = ${str(data.address_street)} where id = ${propertyId}`;
      if ("address_city_state" in data) await tx`update property set address_city_state = ${str(data.address_city_state)} where id = ${propertyId}`;
      if ("address_zip" in data) await tx`update property set address_zip = ${str(data.address_zip)} where id = ${propertyId}`;
    }

    const guidebookId = randomUUID();
    const publicSlug = await uniqueSlug(tx as unknown as Sql, propertyName, guidebookId);
    await tx`
      insert into guidebook (
        id, check_in_time, check_out_time, access_info, welcome_info, parking_info, cover_image_url,
        safety_info, things_to_do, places_to_eat, checkout_info, house_manual, wifi_json, included_tabs,
        custom_sections, custom_tabs_meta, rules_json, template_key, host_id, property_id, user_id, public_slug
      ) values (
        ${guidebookId}, ${str(data.check_in_time)}, ${str(data.check_out_time)}, ${str(data.access_info)},
        ${str(data.welcome_message)}, ${str(data.parking_info)}, ${coverImageUrl === null ? null : String(coverImageUrl)},
        ${jsonOrNull(tx, data.safety_info)}, ${tx.json(thingsToDo as never)}, ${tx.json(placesToEat as never)},
        ${jsonOrNull(tx, data.checkout_info)}, ${jsonOrNull(tx, data.house_manual)},
        ${Object.keys(wifi).length ? tx.json(wifi as never) : null}, ${tx.json(includedTabs as never)},
        ${tx.json(customSections as never)}, ${Object.keys(customTabsMeta).length ? tx.json(customTabsMeta as never) : null},
        ${rules && rules.length ? tx.json(rules as never) : null}, ${templateKey}, ${hostId}, ${propertyId}, ${userId}, ${publicSlug}
      )`;

    return { guidebookId, templateKey, publicSlug };
  }) as Promise<CreateResult>;
}

// ---------------------------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------------------------

const GUIDEBOOK_WITH_RELATIONS = (sql: Sql, where: ReturnType<Sql>) => sql`
  select g.*,
         p.name as p_name, p.address_street as p_street, p.address_city_state as p_city, p.address_zip as p_zip,
         h.name as h_name, h.bio as h_bio, h.contact as h_contact, h.host_image_url as h_photo
    from guidebook g
    left join property p on p.id = g.property_id
    left join host h on h.id = g.host_id
   where ${where}`;

/** GET /api/guidebooks */
export async function listGuidebooks(sql: Sql, userId: string): Promise<Row[]> {
  const rows = await sql`
    select g.id, g.template_key, g.created_time, g.last_modified_time, g.cover_image_url,
           g.public_slug, p.name as property_name
      from guidebook g left join property p on p.id = g.property_id
     where g.user_id = ${userId}
     order by g.last_modified_time desc`;
  const items: Row[] = [];
  for (const r of rows) {
    items.push({
      id: r.id,
      property_name: r.property_name,
      template_key: r.template_key,
      created_time: isoOrNull(r.created_time),
      last_modified_time: isoOrNull(r.last_modified_time),
      cover_image_url: r.cover_image_url,
      public_slug: r.public_slug ?? (await ensurePublicSlug(sql, r.id, r.property_name)),
    });
  }
  return items;
}

/** GET /api/guidebooks/:id (owner only) */
export async function getGuidebookPayload(sql: Sql, userId: string, id: string): Promise<Row> {
  const [g] = await GUIDEBOOK_WITH_RELATIONS(sql, sql`g.id = ${id}`);
  if (!g || g.user_id !== userId) throw new ServiceError(404, "Not found");
  return {
    id: g.id,
    public_slug: g.public_slug ?? (await ensurePublicSlug(sql, g.id, g.p_name)),
    template_key: g.template_key,
    property: {
      id: g.property_id,
      name: g.p_name ?? null,
      address_street: g.p_street ?? null,
      address_city_state: g.p_city ?? null,
      address_zip: g.p_zip ?? null,
    },
    host: {
      id: g.host_id,
      name: g.h_name ?? null,
      bio: g.h_bio ?? null,
      contact: g.h_contact ?? null,
      photo_url: g.h_photo ?? null,
    },
    wifi_json: truthy(g.wifi_json) ? g.wifi_json : {},
    included_tabs: g.included_tabs,
    custom_sections: g.custom_sections,
    custom_tabs_meta: g.custom_tabs_meta,
    things_to_do: g.things_to_do,
    places_to_eat: g.places_to_eat,
    rules: Array.isArray(g.rules_json) && g.rules_json.length ? g.rules_json : [],
    house_manual: g.house_manual,
    safety_info: g.safety_info,
    welcome_message: g.welcome_info,
    access_info: g.access_info,
    parking_info: g.parking_info,
    check_in_time: g.check_in_time,
    check_out_time: g.check_out_time,
    cover_image_url: g.cover_image_url,
    checkout_info: g.checkout_info,
    created_time: isoOrNull(g.created_time),
    last_modified_time: isoOrNull(g.last_modified_time),
  };
}

/** GET /api/hosts */
export async function listHosts(sql: Sql, userId: string): Promise<Row[]> {
  const rows = await sql`select id, name, bio, contact, host_image_url from host where user_id = ${userId} order by id`;
  return rows.map((h) => ({ id: h.id, name: h.name, bio: h.bio, contact: h.contact, photo_url: h.host_image_url }));
}

// ---------------------------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------------------------

/** PUT/PATCH /api/guidebooks/:id */
export async function updateGuidebook(sql: Sql, userId: string, id: string, input: Dict): Promise<{ guidebookId: string }> {
  const data: Dict = { ...input };
  if (isDataUrl(data.cover_image_url)) data.cover_image_url = null;

  return sql.begin(async (tx) => {
    const [gb] = await tx`select * from guidebook where id = ${id} for update`;
    if (!gb || gb.user_id !== userId) throw new ServiceError(404, "Not found");

    const set: Row = {};
    const plain: Record<string, string> = {
      check_in_time: "check_in_time",
      check_out_time: "check_out_time",
      access_info: "access_info",
      welcome_message: "welcome_info",
      parking_info: "parking_info",
      cover_image_url: "cover_image_url",
    };
    for (const [incoming, column] of Object.entries(plain)) {
      if (incoming in data) set[column] = data[incoming] === null || data[incoming] === undefined ? null : String(data[incoming]);
    }
    const jsonColumns: Record<string, string> = {
      things_to_do: "things_to_do",
      places_to_eat: "places_to_eat",
      checkout_info: "checkout_info",
      house_manual: "house_manual",
      included_tabs: "included_tabs",
      custom_sections: "custom_sections",
      custom_tabs_meta: "custom_tabs_meta",
    };
    for (const [incoming, column] of Object.entries(jsonColumns)) {
      if (incoming in data) set[column] = jsonOrNull(tx, data[incoming]);
    }
    // template_key is NOT NULL; ignore anything that is not a string rather than failing the whole save
    if (typeof data.template_key === "string" && data.template_key) set.template_key = data.template_key;

    if ("safety_info" in data) {
      const si = truthy(data.safety_info) ? data.safety_info : {};
      if (isDict(si)) {
        const norm = (v: unknown) => (v !== undefined && v !== null && String(v).trim() !== "" ? String(v).trim() : null);
        set.safety_info = tx.json({
          emergency_contact: norm(si.emergency_contact),
          fire_extinguisher_location: norm(si.fire_extinguisher_location),
        } as never);
      }
    }

    // Host: update the linked one, else reuse one by name, else create
    const hostName = trimmedString(data.host_name);
    const hostBio = data.host_bio;
    const hostContact = data.host_contact;
    const hostPhoto = data.host_photo_url;
    if (hostName || truthy(hostBio) || truthy(hostPhoto)) {
      let hostId: number | null = gb.host_id ?? null;
      if (hostId !== null) {
        const present = await tx`select id from host where id = ${hostId}`;
        if (present.length === 0) hostId = null;
      }
      if (hostId === null && hostName) {
        const found = await tx`select id from host where name = ${hostName} and user_id = ${userId} order by id limit 1`;
        if (found.length > 0) hostId = found[0].id;
      }
      if (hostId === null) {
        const [row] = await tx`insert into host (name, user_id) values (${hostName || null}, ${userId}) returning id`;
        hostId = row.id;
      }
      set.host_id = hostId;
      if (hostName) await tx`update host set name = ${hostName} where id = ${hostId}`;
      if (hostBio !== undefined && hostBio !== null) await tx`update host set bio = ${String(hostBio)} where id = ${hostId}`;
      if (hostContact !== undefined && hostContact !== null) await tx`update host set contact = ${String(hostContact)} where id = ${hostId}`;
      if (hostPhoto !== undefined && hostPhoto !== null && !isDataUrl(hostPhoto)) {
        await tx`update host set host_image_url = ${String(hostPhoto)} where id = ${hostId}`;
      }
    }

    // Property
    const sent = (v: unknown) => v !== undefined && v !== null;
    if (sent(data.property_name)) assertNameLength(data.property_name);
    if ([data.property_name, data.address_street, data.address_city_state, data.address_zip].some(sent)) {
      let propertyId: number | null = gb.property_id ?? null;
      if (propertyId !== null) {
        const present = await tx`select id from property where id = ${propertyId}`;
        if (present.length === 0) propertyId = null;
      }
      if (propertyId === null) {
        const [row] = await tx`insert into property (name, user_id) values (${sent(data.property_name) ? String(data.property_name) : "My Property"}, ${userId}) returning id`;
        propertyId = row.id;
        set.property_id = propertyId;
      }
      if (sent(data.property_name)) await tx`update property set name = ${String(data.property_name)} where id = ${propertyId}`;
      if (sent(data.address_street)) await tx`update property set address_street = ${String(data.address_street)} where id = ${propertyId}`;
      if (sent(data.address_city_state)) await tx`update property set address_city_state = ${String(data.address_city_state)} where id = ${propertyId}`;
      if (sent(data.address_zip)) await tx`update property set address_zip = ${String(data.address_zip)} where id = ${propertyId}`;
    }

    // WiFi
    if (sent(data.wifi_network) || sent(data.wifi_password)) {
      const wifi: Dict = isDict(gb.wifi_json) ? { ...gb.wifi_json } : {};
      if (sent(data.wifi_network)) wifi.network = data.wifi_network;
      if (sent(data.wifi_password)) wifi.password = data.wifi_password;
      set.wifi_json = Object.keys(wifi).length ? tx.json(wifi as never) : null;
    }

    // Rules replace the stored list when provided
    if (Array.isArray(data.rules)) {
      const rules = compileRulesInput(data.rules);
      set.rules_json = rules.length ? tx.json(rules as never) : null;
    }

    const columns = Object.keys(set);
    if (columns.length > 0) {
      await tx`update guidebook set ${tx(set as never, ...columns)}, last_modified_time = now() where id = ${id}`;
    } else {
      await tx`update guidebook set last_modified_time = now() where id = ${id}`;
    }
    return { guidebookId: id };
  }) as Promise<{ guidebookId: string }>;
}

// ---------------------------------------------------------------------------------------------
// Delete, template
// ---------------------------------------------------------------------------------------------

export async function deleteGuidebook(sql: Sql, userId: string, id: string): Promise<void> {
  const deleted = await sql`delete from guidebook where id = ${id} and user_id = ${userId} returning id`;
  if (deleted.length === 0) throw new ServiceError(404, "Not found");
}

export async function setTemplateKey(sql: Sql, userId: string, id: string, templateKey: unknown): Promise<string> {
  const [gb] = await sql`select id from guidebook where id = ${id} and user_id = ${userId}`;
  if (!gb) throw new ServiceError(404, "Guidebook not found");
  if (typeof templateKey !== "string" || !ALLOWED_TEMPLATE_KEYS.includes(templateKey)) {
    throw new ServiceError(400, "Invalid template_key", { allowed: ALLOWED_TEMPLATE_KEYS });
  }
  await sql`update guidebook set template_key = ${templateKey}, last_modified_time = now() where id = ${id}`;
  return templateKey;
}

/** A guidebook with its property and host in the shape the renderers expect; null if it is not the user's. */
export async function loadOwnedGuidebookRow(sql: Sql, userId: string, id: string): Promise<GuidebookRow | null> {
  const [row] = await GUIDEBOOK_WITH_RELATIONS(sql, sql`g.id = ${id}`);
  if (!row || row.user_id !== userId) return null;
  return {
    ...row,
    property: row.property_id
      ? { id: row.property_id, name: row.p_name, address_street: row.p_street, address_city_state: row.p_city, address_zip: row.p_zip }
      : null,
    host: row.host_id ? { id: row.host_id, name: row.h_name, bio: row.h_bio, contact: row.h_contact, host_image_url: row.h_photo } : null,
  } as unknown as GuidebookRow;
}
