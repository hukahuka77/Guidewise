import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import nunjucks from "nunjucks";
import { buildGuidebookContext, sanitizeCustomTabsMeta } from "./context";
import { placePhotoUrl } from "./placePhotos";
import { jinjaEscape, jinjaTitle, jinjaUrlencode, withPythonTruthiness } from "./pyCompat";
import type { GuidebookRow } from "./types";

/** Template keys accepted by the app, mapped to template files (same as Flask's TEMPLATE_REGISTRY). */
export const TEMPLATE_REGISTRY: Record<string, string> = {
  template_original: "templates_url/template_original.html",
  template_generic: "templates_url/template_generic.html",
  template_lifestyle: "templates_url/template_generic.html",
  template_welcomebook: "templates_url/template_welcomebook.html",
};

export const DEFAULT_TEMPLATE_KEY = "template_original";

/** Snapshots stored by publish carry this marker once they use durable place-photo URLs. */
export const PLACE_PHOTO_SNAPSHOT_MARKER = "<!-- place-photo-v2 -->";

const TEMPLATE_DIR = path.join(process.cwd(), "src", "templates", "guidebook");

// Nunjucks escapes backslashes and writes &quot; where Jinja writes &#34;; match Jinja so the
// migrated pages stay identical to the ones Flask rendered.
(nunjucks as unknown as { lib: { escape: (s: string) => string } }).lib.escape = jinjaEscape;

let env: nunjucks.Environment | null = null;

function getEnv(): nunjucks.Environment {
  if (!env) {
    env = new nunjucks.Environment(new nunjucks.FileSystemLoader(TEMPLATE_DIR), { autoescape: true });
    env.addFilter("place_photo_url", (item: unknown) => placePhotoUrl(item));
    env.addFilter("urlencode", (value: unknown) => jinjaUrlencode(value));
    env.addFilter("title", (value: unknown) => jinjaTitle(value));
  }
  return env;
}

export function resolveTemplateKey(key: string | null | undefined): string {
  return key && key in TEMPLATE_REGISTRY ? key : DEFAULT_TEMPLATE_KEY;
}

/** Hash of the template sources, so edits to templates invalidate cached pages and ETags. */
let templatesHash: string | null = null;
export function getTemplatesHash(): string {
  if (!templatesHash) {
    const hash = createHash("sha256");
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else hash.update(entry.name).update(fs.readFileSync(full));
      }
    };
    walk(TEMPLATE_DIR);
    templatesHash = hash.digest("hex").slice(0, 16);
  }
  return templatesHash;
}

export interface RenderOptions {
  showWatermark?: boolean;
  upgradeUrl?: string;
}

/** Render a guidebook with its selected template. */
export function renderGuidebookHtml(gb: GuidebookRow, options: RenderOptions = {}): { html: string; templateKey: string } {
  const templateKey = resolveTemplateKey(gb.template_key);
  const html = getEnv().render(TEMPLATE_REGISTRY[templateKey], {
    ctx: withPythonTruthiness(buildGuidebookContext(gb)),
    show_watermark: Boolean(options.showWatermark),
    upgrade_url: options.upgradeUrl ?? "/pricing",
  });
  return { html, templateKey };
}

/**
 * Render the HTML snapshot stored by "publish". Flask passed the guidebook fields to the template
 * both inside `ctx` and as top-level variables, and one template (welcomebook) reads the top-level
 * `property_name`, so the same variables are passed here to produce identical snapshots.
 */
export function renderPublishSnapshot(gb: GuidebookRow): { html: string; templateKey: string } {
  const templateKey = resolveTemplateKey(gb.template_key);
  const ctx = buildGuidebookContext(gb);
  const legacy = {
    id: gb.id,
    host_name: gb.host?.name ?? null,
    host_bio: gb.host?.bio ?? null,
    host_contact: gb.host?.contact ?? null,
    host_photo_url: gb.host?.host_image_url ?? null,
    property_name: gb.property?.name ?? null,
    check_in_time: gb.check_in_time,
    check_out_time: gb.check_out_time,
    address_street: gb.property?.address_street ?? null,
    address_city_state: gb.property?.address_city_state ?? null,
    address_zip: gb.property?.address_zip ?? null,
    access_info: gb.access_info,
    welcome_message: gb.welcome_info,
    parking_info: gb.parking_info,
    rules: gb.rules_json || [],
    things_to_do: gb.things_to_do,
    places_to_eat: gb.places_to_eat,
    checkout_info: gb.checkout_info,
    house_manual: gb.house_manual,
    included_tabs: ctx.included_tabs,
    custom_sections: gb.custom_sections,
    custom_tabs_meta: sanitizeCustomTabsMeta(gb.custom_tabs_meta),
    cover_image_url: gb.cover_image_url,
  };
  const html =
    PLACE_PHOTO_SNAPSHOT_MARKER +
    getEnv().render(TEMPLATE_REGISTRY[templateKey], { ctx: withPythonTruthiness(ctx), ...withPythonTruthiness(legacy) });
  return { html, templateKey };
}
