import { driveOrigin } from "@/lib/driveOrigin";
// Small presentation helpers for the guidebook templates (registered as Nunjucks filters in render.ts).

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** "15:00" or "15:00:00" -> "3:00 PM"; anything else (e.g. "3pm", "after 4") is shown as written. */
export function formatTime12(value: unknown): string {
  const raw = text(value);
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!m) return raw;
  const h = Number(m[1]);
  if (h > 23) return raw;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${suffix}`;
}

export interface ContactLink {
  kind: "call" | "text" | "email";
  label: string;
  href: string;
}

/** Buttons for a free-text contact line: the first phone number (call + text) and the first email. */
export function contactLinks(value: unknown): ContactLink[] {
  const raw = text(value);
  if (!raw) return [];
  const links: ContactLink[] = [];
  const phone = /(\+?\d[\d\s().-]{6,}\d)/.exec(raw)?.[1];
  if (phone) {
    const digits = phone.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length >= 7) {
      links.push({ kind: "call", label: "Call", href: `tel:${digits}` });
      links.push({ kind: "text", label: "Text", href: `sms:${digits}` });
    }
  }
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(raw)?.[0];
  if (email) links.push({ kind: "email", label: "Email", href: `mailto:${email}` });
  return links;
}

/** One line for the property address, or "" when there is none. */
export function addressLine(address: unknown): string {
  if (!isDict(address)) return "";
  const street = text(address.street);
  const cityState = text(address.city_state);
  const zip = text(address.zip);
  return [street, [cityState, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/**
 * Google Maps link for a place: driving directions from the guidebook's address when it has a street
 * address, otherwise the place itself (there's no exact starting point to route from).
 */
export function directionsUrl(destination: unknown, address: unknown): string {
  const dest = text(destination);
  const from = isDict(address) && text(address.street) ? driveOrigin(address.street, address.city_state, address.zip) : null;
  const params = from
    ? new URLSearchParams({ api: "1", origin: from, destination: dest, travelmode: "driving" })
    : new URLSearchParams({ api: "1", query: dest });
  return `https://www.google.com/maps/${from ? "dir" : "search"}/?${params}`;
}

export interface GuideSection {
  key: string;
  label: string;
  short: string;
  /** Icon name; custom sections all share the generic "section" icon. */
  icon: string | null;
  emoji: string | null;
  num: string;
}

const BUILT_IN: Record<string, { label: string; short: string; icon: string }> = {
  welcome: { label: "Welcome", short: "Welcome", icon: "sun" },
  checkin: { label: "Arrival", short: "Arrival", icon: "key" },
  property: { label: "House guide", short: "House", icon: "book" },
  food: { label: "Where to eat", short: "Eat", icon: "utensils" },
  activities: { label: "Things to do", short: "Explore", icon: "compass" },
  rules: { label: "House rules", short: "Rules", icon: "rules" },
  checkout: { label: "Departure", short: "Departure", icon: "bag" },
};

const hasItems = (v: unknown) => Array.isArray(v) && v.length > 0;

function customHasContent(items: unknown): boolean {
  if (!Array.isArray(items)) return false;
  return items.some((item) => {
    if (typeof item === "string") return item.trim() !== "";
    if (!isDict(item)) return false;
    return item.type === "manual" ? text(item.name) !== "" || text(item.description) !== "" : text(item.content) !== "";
  });
}

function welcomeHasContent(ctx: Dict): boolean {
  const host = isDict(ctx.host) ? ctx.host : {};
  const safety = isDict(ctx.safety_info) ? ctx.safety_info : {};
  return Boolean(
    text(ctx.welcome_message) || text(host.name) || text(host.bio) || text(host.contact) ||
      text(safety.emergency_contact) || text(safety.fire_extinguisher_location),
  );
}

/**
 * The sections a guidebook actually shows, in the host's order (`included_tabs`), numbered.
 * Sections without content are left out so guests never land on an empty heading.
 */
export function guideSections(ctx: unknown): GuideSection[] {
  if (!isDict(ctx)) return [];
  const tabs = Array.isArray(ctx.included_tabs) ? ctx.included_tabs : [];
  const meta = isDict(ctx.custom_tabs_meta) ? ctx.custom_tabs_meta : {};
  const custom = isDict(ctx.custom_sections) ? ctx.custom_sections : {};
  const shown: Omit<GuideSection, "num">[] = [];
  for (const key of tabs) {
    if (typeof key !== "string") continue;
    if (key.startsWith("custom_")) {
      if (!customHasContent(custom[key])) continue;
      const m = isDict(meta[key]) ? meta[key] : {};
      const label = text(m.label) || key.replace(/^custom_/, "").replace(/_/g, " ");
      shown.push({ key, label, short: label, icon: "section", emoji: null });
      continue;
    }
    const base = BUILT_IN[key];
    if (!base) continue;
    const ok =
      key === "welcome" ? welcomeHasContent(ctx)
      : key === "checkin" ? Boolean(text(ctx.check_in_time) || text(ctx.access_info) || text(ctx.parking_info))
      : key === "property" ? hasItems(ctx.house_manual)
      : key === "food" ? hasItems(ctx.places_to_eat)
      : key === "activities" ? hasItems(ctx.things_to_do)
      : key === "rules" ? hasItems(ctx.rules)
      : key === "checkout" ? Boolean(text(ctx.check_out_time) || hasItems(ctx.checkout_info))
      : false;
    if (ok) shown.push({ key, ...base, emoji: null });
  }
  return shown.map((s, i) => ({ ...s, num: String(i + 1).padStart(2, "0") }));
}
