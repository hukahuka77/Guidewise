import { pyTruthy, stripSurrogates } from "./pyCompat";
import { normalizeRules } from "./rules";
import type { GuidebookRow } from "./types";

export const BASE_TABS = ["welcome", "checkin", "property", "food", "activities", "rules", "checkout"];

export const PLACEHOLDER_COVER_URL =
  "https://hojncqasasvvrhdmwwhv.supabase.co/storage/v1/object/public/my_images/home_placeholder.jpg";

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const orDefault = <T>(value: unknown, fallback: T): T => (pyTruthy(value) ? (value as T) : fallback);

/** `included_tabs`: default to all base tabs, keep only known tabs and `custom_*` keys. */
export function resolveIncludedTabs(raw: unknown): string[] {
  const tabs = Array.isArray(raw) && raw.length > 0 ? raw : BASE_TABS;
  return tabs.filter(
    (t): t is string => typeof t === "string" && (BASE_TABS.includes(t) || t.startsWith("custom_")),
  );
}

/** Custom tab labels/icons with unpaired surrogates stripped (broken emoji halves break rendering). */
export function sanitizeCustomTabsMeta(meta: unknown): Record<string, { label: string; icon: string }> | null {
  if (!isDict(meta)) return null;
  const out: Record<string, { label: string; icon: string }> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!isDict(value)) continue;
    out[key] = {
      label: value.label != null ? stripSurrogates(String(value.label)) : "",
      icon: value.icon != null ? stripSurrogates(String(value.icon)) : "",
    };
  }
  return out;
}

/** Port of `_build_ctx` from backend/app.py: the data every guidebook template renders. */
export function buildGuidebookContext(gb: GuidebookRow): Record<string, unknown> {
  const safeMeta = sanitizeCustomTabsMeta(gb.custom_tabs_meta);
  return {
    schema_version: 1,
    id: gb.id,
    property_name: gb.property?.name || "My Guidebook",
    host: {
      name: gb.host?.name ?? null,
      bio: gb.host?.bio ?? null,
      contact: gb.host?.contact ?? null,
      photo_url: gb.host?.host_image_url ?? null,
    },
    welcome_message: gb.welcome_info ?? null,
    safety_info: orDefault(gb.safety_info, {}),
    address: {
      street: gb.property?.address_street ?? null,
      city_state: gb.property?.address_city_state ?? null,
      zip: gb.property?.address_zip ?? null,
    },
    wifi_json: orDefault(gb.wifi_json, {}),
    check_in_time: gb.check_in_time ?? null,
    check_out_time: gb.check_out_time ?? null,
    access_info: gb.access_info ?? null,
    parking_info: gb.parking_info ?? null,
    rules: normalizeRules(gb.rules_json),
    things_to_do: orDefault(gb.things_to_do, []),
    places_to_eat: orDefault(gb.places_to_eat, []),
    checkout_info: orDefault(gb.checkout_info, []),
    house_manual: orDefault(gb.house_manual, []),
    included_tabs: resolveIncludedTabs(gb.included_tabs),
    custom_sections: orDefault(gb.custom_sections, {}),
    custom_tabs_meta: pyTruthy(safeMeta) ? safeMeta : orDefault(gb.custom_tabs_meta, {}),
    cover_image_url: gb.cover_image_url || PLACEHOLDER_COVER_URL,
  };
}
