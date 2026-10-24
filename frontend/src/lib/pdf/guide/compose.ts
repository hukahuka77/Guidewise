import { createHash } from "node:crypto";
import OpenAI from "openai";
import { jsonCompletion } from "@/lib/server/aiModel";
import type { GuideModel } from "./model";
import type { ThemeKey } from "./themes";

// The "composer": an AI pass that decides how a guide is presented (theme, order of sections, headings, short
// intros, a "good to know" box, the cover tagline) without ever changing the facts in it.
//
//  - It only chooses among components the renderer already has, so every page still passes the layout checks.
//  - It never sees secrets: Wi-Fi password, door/access details, parking notes, emergency numbers, host contact
//    and the street address are replaced by "present / not present" flags before anything is sent.
//  - Whatever it returns is validated: unknown fields are dropped, text is length-limited, and any text that
//    adds digits, links, emails or secrets that were not in what we sent is rejected.

export const PLAN_VERSION = 1;
export const THEME_KEYS: ThemeKey[] = ["welcomebook", "classic", "minimal"];

/** Section ids the renderer knows, in the default order. */
export const SECTION_IDS = ["welcome", "arrival", "manual", "rules", "eat", "do", "checkout"] as const;
export type SectionId = (typeof SECTION_IDS)[number] | `custom_${string}`;

export interface GuidePlan {
  theme: ThemeKey;
  /** Short line under the title on the cover. */
  tagline?: string;
  /** Rewritten welcome message (same facts, friendlier tone). */
  welcome?: string;
  /** Up to four "good to know" bullets shown under the welcome. */
  highlights: string[];
  /** Section order; ids not listed keep their default position after the listed ones. */
  order: string[];
  /** Per-section heading and one-line intro. */
  sections: Record<string, { title?: string; blurb?: string }>;
}

const MAX = { tagline: 80, welcome: 600, highlight: 100, title: 36, blurb: 140 };

// ---------------------------------------------------------------------------------------------
// What the model is allowed to see
// ---------------------------------------------------------------------------------------------

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Strings that must never reach the model even when a host typed them into free text (e.g. the welcome message). */
export function secretsOf(model: GuideModel): string[] {
  const codes = [model.access, model.parking, model.emergencyContact, model.host.contact]
    .flatMap((t) => t.split(/[\s,;:()]+/))
    .filter((t) => /\d/.test(t) && t.length >= 3);
  return [...new Set([model.wifi?.password ?? "", model.wifi?.network ?? "", ...codes].filter((t) => t.length >= 3))];
}

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) out = out.split(secret).join("[hidden]");
  return out;
}

export interface ComposerInput {
  property: string;
  city: string;
  hostFirstName: string;
  welcome: string;
  has: { wifi: boolean; access: boolean; parking: boolean; emergencyContact: boolean; hostContact: boolean };
  times: { checkIn: string; checkOut: string };
  sections: { id: string; title: string; items: string[] }[];
}

/** Masked, size-limited facts about the guide. Nothing here is a secret. */
export function composerInput(model: GuideModel): ComposerInput {
  const names = (items: { name: string; description: string }[]) =>
    items.map((i) => clip(i.name || i.description, 70)).slice(0, 12);
  const sections: ComposerInput["sections"] = [];
  const has = (tab: string) => model.tabs.includes(tab);
  if (has("welcome") && (model.welcome || model.host.name)) sections.push({ id: "welcome", title: "Welcome", items: [] });
  if (has("checkin")) sections.push({ id: "arrival", title: "Arriving & Getting Settled", items: [] });
  if (has("property") && model.manual.length) sections.push({ id: "manual", title: "House Guide", items: names(model.manual) });
  if (has("rules") && model.rules.length) sections.push({ id: "rules", title: "House Rules", items: names(model.rules) });
  if (has("food") && model.eat.length) sections.push({ id: "eat", title: "Places to Eat", items: model.eat.slice(0, 12).map((p) => clip(p.name, 70)) });
  if (has("activities") && model.todo.length) sections.push({ id: "do", title: "Things to Do", items: model.todo.slice(0, 12).map((p) => clip(p.name, 70)) });
  for (const c of model.custom) sections.push({ id: c.key, title: c.title, items: [] });
  if (has("checkout")) sections.push({ id: "checkout", title: "Checkout", items: names(model.checkout) });
  return {
    property: model.title,
    city: model.city,
    hostFirstName: model.host.name.split(/\s+/)[0] ?? "",
    welcome: clip(redact(model.welcome, secretsOf(model)), 700),
    has: {
      wifi: Boolean(model.wifi),
      access: Boolean(model.access),
      parking: Boolean(model.parking),
      emergencyContact: Boolean(model.emergencyContact),
      hostContact: Boolean(model.host.contact),
    },
    times: { checkIn: model.checkIn, checkOut: model.checkOut },
    sections,
  };
}

/** Stable key for the cached plan: changes when anything the model sees changes. */
export function composerHash(input: ComposerInput, options: { creative?: string } = {}): string {
  return createHash("sha256").update(`v${PLAN_VERSION}:${options.creative ?? ""}:${JSON.stringify(input)}`).digest("hex");
}

// ---------------------------------------------------------------------------------------------
// Validation: keep only what is safe to print
// ---------------------------------------------------------------------------------------------

const digitsIn = (s: string) => s.match(/\d+/g) ?? [];

/** Corpus of everything that was sent; AI text may only reuse numbers found here. */
function corpus(input: ComposerInput): string {
  return JSON.stringify(input);
}

const tooRisky = /https?:\/\/|www\.|@|\[hidden\]|\b\d{3}[-.\s]\d{3,4}\b/i;

function cleanText(value: unknown, max: number, allowedDigits: Set<string>, secrets: string[]): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > max * 1.5) return undefined;
  if (tooRisky.test(text)) return undefined;
  if (digitsIn(text).some((d) => !allowedDigits.has(d))) return undefined;
  const lower = text.toLowerCase();
  if (secrets.some((s) => s.length >= 3 && lower.includes(s.toLowerCase()))) return undefined;
  return clip(text, max);
}

/** Turns whatever the model returned into a safe plan, or null when nothing usable came back. */
export function validatePlan(raw: unknown, input: ComposerInput, secrets: string[] = []): GuidePlan | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const allowed = new Set(digitsIn(corpus(input)));
  const text = (v: unknown, max: number) => cleanText(v, max, allowed, secrets);

  const theme = THEME_KEYS.includes(r.theme as ThemeKey) ? (r.theme as ThemeKey) : "welcomebook";
  const known = new Set(input.sections.map((s) => s.id));

  const order: string[] = [];
  if (Array.isArray(r.order)) {
    for (const id of r.order) if (typeof id === "string" && known.has(id) && !order.includes(id)) order.push(id);
  }

  const sections: GuidePlan["sections"] = {};
  if (typeof r.sections === "object" && r.sections !== null && !Array.isArray(r.sections)) {
    for (const [id, value] of Object.entries(r.sections as Record<string, unknown>)) {
      if (!known.has(id) || typeof value !== "object" || value === null) continue;
      const v = value as Record<string, unknown>;
      const title = text(v.title, MAX.title);
      const blurb = text(v.blurb, MAX.blurb);
      if (title || blurb) sections[id] = { ...(title ? { title } : {}), ...(blurb ? { blurb } : {}) };
    }
  }

  const highlights = (Array.isArray(r.highlights) ? r.highlights : [])
    .map((h) => text(h, MAX.highlight))
    .filter((h): h is string => Boolean(h))
    .slice(0, 4);

  const plan: GuidePlan = {
    theme,
    tagline: text(r.tagline, MAX.tagline),
    welcome: input.welcome ? text(r.welcome, MAX.welcome) : undefined,
    highlights,
    order,
    sections,
  };
  return plan;
}

// ---------------------------------------------------------------------------------------------
// The model call
// ---------------------------------------------------------------------------------------------

const SYSTEM_PROMPT = `You art-direct a printed guest guide for a short-term rental. You decide presentation only.
Return a JSON object with these keys, and nothing else:
- "theme": one of "welcomebook" (warm, editorial, serif headings), "classic" (traditional, balanced), "minimal" (clean, modern, light).
- "tagline": one short, warm line for the cover (max 80 characters).
- "welcome": the host's welcome message rewritten to be warm and concise (max 600 characters). Keep every fact; do not add new ones.
- "highlights": up to 4 short "good to know" bullets drawn only from the facts provided (max 100 characters each).
- "order": section ids in the best reading order for a guest arriving at the property.
- "sections": an object keyed by section id with an optional "title" (max 36 characters) and "blurb" (one friendly sentence, max 140 characters).
Rules: use only facts provided. Never invent numbers, times, prices, names, addresses, phone numbers, links or codes. Do not mention passwords or codes. No emoji. If something is marked as present but hidden, you may say it is included in the guide without describing it.`;

export interface ComposeOptions {
  client?: Pick<OpenAI, "chat">;
}

/** Asks the model for a plan; returns null on any failure so the caller falls back to the standard design. */
export async function composeGuidePlan(model: GuideModel, options: ComposeOptions = {}): Promise<GuidePlan | null> {
  const input = composerInput(model);
  const secrets = secretsOf(model);
  try {
    const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Some variety in wording on non-reasoning models; reasoning models ignore temperature
    const content = await jsonCompletion(
      client,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
      { temperature: 0.7 },
    );
    const parsed = JSON.parse(content ?? "null");
    return validatePlan(parsed, input, secrets);
  } catch (error) {
    console.error("composeGuidePlan failed", error);
    return null;
  }
}
