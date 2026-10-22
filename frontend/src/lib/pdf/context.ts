import { resolveIncludedTabs } from "@/lib/guidebook/context";
import { pyTruthy } from "@/lib/guidebook/pyCompat";
import { rulesAsText } from "@/lib/guidebook/rules";
import type { GuidebookRow } from "@/lib/guidebook/types";
import { normalizeRecommendations, type PhotoResolver } from "./recommendations";

// Ports of the two context builders in backend/main.py (`create_guidebook_pdf` and
// `create_print_pdf_from_web_template`). Two deliberate differences, both bug fixes: the PDF templates
// read `ctx.wifi` and (for the PDF path) `ctx.house_manual`, which Flask never put in the context.

type Dict = Record<string, unknown>;
const orDefault = <T>(value: unknown, fallback: T): T => (pyTruthy(value) ? (value as T) : fallback);

/** Python's `urllib.parse.quote(value, safe="")`. */
function quoteAll(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function qrImageSrc(qrUrl: string | null | undefined): string | null {
  if (!qrUrl) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${quoteAll(qrUrl)}`;
}

export async function buildPdfContext(
  gb: GuidebookRow,
  resolver: PhotoResolver,
  options: { qrUrl?: string | null } = {},
): Promise<Dict> {
  const [thingsToDo, placesToEat] = await Promise.all([
    normalizeRecommendations(gb.things_to_do, resolver),
    normalizeRecommendations(gb.places_to_eat, resolver),
  ]);
  const wifi = orDefault<Dict>(gb.wifi_json, {});
  return {
    schema_version: 1,
    id: gb.id,
    property_name: gb.property ? gb.property.name : null,
    host: {
      name: gb.host ? gb.host.name : null,
      bio: gb.host?.bio ?? null,
      contact: gb.host?.contact ?? null,
      photo_url: gb.host?.host_image_url ?? null,
    },
    welcome_message: gb.welcome_info,
    safety_info: orDefault(gb.safety_info, {}),
    address: {
      street: gb.property ? gb.property.address_street : "",
      city_state: gb.property ? gb.property.address_city_state : "",
      zip: gb.property ? gb.property.address_zip : "",
    },
    wifi_json: wifi,
    wifi,
    check_in_time: gb.check_in_time,
    check_out_time: gb.check_out_time,
    access_info: gb.access_info,
    parking_info: gb.parking_info,
    rules: rulesAsText(gb.rules_json),
    things_to_do: thingsToDo,
    places_to_eat: placesToEat,
    checkout_info: orDefault(gb.checkout_info, []),
    house_manual: orDefault(gb.house_manual, []),
    included_tabs: resolveIncludedTabs(gb.included_tabs),
    custom_sections: orDefault(gb.custom_sections, {}),
    custom_tabs_meta: orDefault(gb.custom_tabs_meta, {}),
    cover_image_url: gb.cover_image_url,
    qr_img_src: qrImageSrc(options.qrUrl),
  };
}
