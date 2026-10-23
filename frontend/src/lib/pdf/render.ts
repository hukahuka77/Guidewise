import path from "node:path";
import nunjucks from "nunjucks";
import { jinjaEscape, jinjaTitle, jinjaUrlencode, withPythonTruthiness } from "@/lib/guidebook/pyCompat";
import { placePhotoUrl } from "@/lib/guidebook/placePhotos";

const TEMPLATE_DIR = path.join(process.cwd(), "src", "templates", "pdf");

/** Keys accepted by `/pdf?template=`; `template_pdf_modern` is accepted for old links and falls back to original. */
export const ALLOWED_PDF_TEMPLATE_KEYS = [
  "template_pdf_original",
  "template_pdf_basic",
  "template_pdf_mobile",
  "template_pdf_qr",
  "template_pdf_modern",
];
/** Layouts still drawn from their own templates (the others use the guide design system, see ./guide). */
export const PDF_TEMPLATE_REGISTRY: Record<string, string> = {
  template_pdf_mobile: "templates_pdf/template_pdf_mobile.html",
  template_pdf_qr: "templates_pdf/template_pdf_qr.html",
};
(nunjucks as unknown as { lib: { escape: (s: string) => string } }).lib.escape = jinjaEscape;

/** A URL made safe for CSS `url('...')` inside a <style> block. */
export function cssUrl(value: unknown): nunjucks.runtime.SafeString {
  const s = typeof value === "string" ? value : value ? String(value) : "";
  if (!/^(https?:|data:image\/)/i.test(s)) return new nunjucks.runtime.SafeString("");
  return new nunjucks.runtime.SafeString(
    s.replace(/[\x00-\x1f\\'"() ]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`),
  );
}

let env: nunjucks.Environment | null = null;
function getEnv() {
  if (!env) {
    env = new nunjucks.Environment(new nunjucks.FileSystemLoader(TEMPLATE_DIR), { autoescape: true });
    env.addFilter("place_photo_url", (item: unknown) => placePhotoUrl(item));
    env.addFilter("urlencode", (value: unknown) => jinjaUrlencode(value));
    env.addFilter("title", (value: unknown) => jinjaTitle(value));
    env.addFilter("css_url", cssUrl);
  }
  return env;
}

export function resolvePdfTemplate(requested: string | null | undefined): string {
  return requested && ALLOWED_PDF_TEMPLATE_KEYS.includes(requested) ? requested : "template_pdf_original";
}

/** Template file for the stored web template key's *PDF* rendering (`create_guidebook_pdf`). */
export function renderPdfHtml(templateKey: string, ctx: Record<string, unknown>): string {
  const file = PDF_TEMPLATE_REGISTRY[templateKey];
  if (!file) throw new Error(`No legacy PDF template for ${templateKey}`);
  return getEnv().render(file, { ctx: withPythonTruthiness(ctx) });
}
