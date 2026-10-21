import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import nunjucks from "nunjucks";
import { buildGuidebookContext } from "./context";
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
