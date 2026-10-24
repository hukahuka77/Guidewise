import { resolveIncludedTabs, sanitizeCustomTabsMeta } from "@/lib/guidebook/context";
import { jinjaTitle, pyTruthy } from "@/lib/guidebook/pyCompat";
import { normalizeRules } from "@/lib/guidebook/rules";
import type { GuidebookRow } from "@/lib/guidebook/types";
import { qrImageSrc } from "../context";
import { normalizeRecommendations, type NormalizedItem, type PhotoResolver } from "../recommendations";

// Everything the PDF needs, cleaned up once so the renderer stays simple and every theme shows the same content.

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export interface TextItem {
  name: string;
  description: string;
}

export interface GuideModel {
  title: string;
  city: string;
  coverUrl: string | null;
  host: { name: string; bio: string; contact: string };
  welcome: string;
  addressLines: string[];
  checkIn: string;
  checkOut: string;
  access: string;
  parking: string;
  wifi: { network: string; password: string } | null;
  emergencyContact: string;
  fireExtinguisher: string;
  qrSrc: string | null;
  tabs: string[];
  manual: TextItem[];
  rules: TextItem[];
  eat: NormalizedItem[];
  todo: NormalizedItem[];
  checkout: TextItem[];
  custom: { key: string; title: string; paragraphs: string[] }[];
}

/**
 * Emoji are dropped from PDF text: servers have no emoji font, so they would print as empty boxes.
 * (Also removes the joiners and variation selectors that travel with them.)
 */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .trim();
}

/** Keys that hold URLs or ids and must be left untouched. */
const RAW_KEYS = new Set(["coverUrl", "qrSrc", "image_url", "place_id", "key"]);

function scrub<T>(value: T, key = ""): T {
  if (typeof value === "string") return (RAW_KEYS.has(key) ? value : stripEmoji(value)) as T;
  if (Array.isArray(value)) return value.map((v) => scrub(v, key)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, k)])) as T;
  }
  return value;
}

/** "15:00" -> "3:00 PM"; anything else is shown as typed. */
export function formatTime(value: string): string {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return value.trim();
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

function textItems(raw: unknown): TextItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TextItem[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      if (entry.trim()) out.push({ name: entry.trim(), description: "" });
    } else if (isDict(entry)) {
      const name = str(entry.name) || str(entry.title);
      const description = str(entry.description) || str(entry.text);
      if (name || description) out.push({ name, description });
    }
  }
  return out;
}

function humanize(key: string): string {
  return jinjaTitle(key.replace(/^custom_/, "").replace(/_/g, " "));
}

export async function buildGuideModel(
  gb: GuidebookRow,
  resolver: PhotoResolver,
  options: { qrUrl?: string | null } = {},
): Promise<GuideModel> {
  const [eat, todo] = await Promise.all([
    normalizeRecommendations(gb.places_to_eat, resolver),
    normalizeRecommendations(gb.things_to_do, resolver),
  ]);

  const tabs = resolveIncludedTabs(gb.included_tabs);
  const meta = sanitizeCustomTabsMeta(gb.custom_tabs_meta) ?? {};
  const sections = isDict(gb.custom_sections) ? gb.custom_sections : {};
  const custom = tabs
    .filter((t) => t.startsWith("custom_"))
    .map((key) => {
      const blocks = Array.isArray(sections[key]) ? (sections[key] as unknown[]) : [];
      const paragraphs = blocks
        .map((b) => (typeof b === "string" ? b : isDict(b) ? [str(b.name), str(b.description)].filter(Boolean).join(": ") : ""))
        .map((t) => t.trim())
        .filter(Boolean);
      return { key, title: meta[key]?.label?.trim() || humanize(key), paragraphs };
    })
    .filter((c) => c.paragraphs.length > 0);

  const wifiRaw = isDict(gb.wifi_json) ? gb.wifi_json : {};
  const wifi = str(wifiRaw.network) || str(wifiRaw.password) ? { network: str(wifiRaw.network), password: str(wifiRaw.password) } : null;
  const safety = isDict(gb.safety_info) ? gb.safety_info : {};

  const street = str(gb.property?.address_street);
  const cityState = str(gb.property?.address_city_state);
  const zip = str(gb.property?.address_zip);
  const cityLine = [cityState, zip].filter(Boolean).join(cityState && zip ? ", " : "");

  return scrub({
    title: str(gb.property?.name) || "My Guidebook",
    city: cityState,
    coverUrl: gb.cover_image_url || null,
    host: { name: str(gb.host?.name), bio: str(gb.host?.bio), contact: str(gb.host?.contact) },
    welcome: str(gb.welcome_info),
    addressLines: [street, cityLine].filter(Boolean),
    checkIn: pyTruthy(gb.check_in_time) ? formatTime(String(gb.check_in_time)) : "",
    checkOut: pyTruthy(gb.check_out_time) ? formatTime(String(gb.check_out_time)) : "",
    access: str(gb.access_info),
    parking: str(gb.parking_info),
    wifi,
    emergencyContact: str(safety.emergency_contact),
    fireExtinguisher: str(safety.fire_extinguisher_location),
    qrSrc: await qrImageSrc(options.qrUrl),
    tabs,
    manual: textItems(gb.house_manual),
    rules: normalizeRules(gb.rules_json).map((r) => ({ name: r.name, description: r.description })),
    eat,
    todo,
    checkout: textItems(gb.checkout_info),
    custom,
  });
}
