import { createHash } from "node:crypto";
import { getTemplatesHash } from "@/lib/guidebook/render";
import type { GuidebookRow } from "@/lib/guidebook/types";
import {
  googlePlacesPhotoReference,
  googlePlacesPhotoUrl,
  googlePlacesTextSearch,
} from "@/lib/server/googlePlaces";
import { ServiceError } from "@/lib/server/guidebookService";
import { PDF_UPGRADE_PLAN, PLAN_CONFIGS, type PlanConfig } from "@/lib/server/plans";
import { htmlToPdf } from "./browser";
import { buildPdfContext } from "./context";
import type { GuidePlan } from "./guide/compose";
import { buildGuideModel, type GuideModel } from "./guide/model";
import { renderGuide } from "./guide/render";
import type { ThemeKey } from "./guide/themes";
import type { PhotoResolver } from "./recommendations";
import { renderPdfHtml, resolvePdfTemplate } from "./render";

export const defaultResolver: PhotoResolver = {
  photoReference: googlePlacesPhotoReference,
  async findPlaceId(query) {
    const results = (await googlePlacesTextSearch(query)).results;
    const first = Array.isArray(results) ? (results[0] as { place_id?: unknown } | undefined) : undefined;
    return typeof first?.place_id === "string" && first.place_id ? first.place_id : null;
  },
  photoUrl: (ref) => googlePlacesPhotoUrl(ref),
};

/** Bump when the PDF design changes so browsers do not keep serving old downloads. */
export const GUIDE_RENDER_VERSION = 1;

/** PDF layouts drawn by the new design system, and the theme each one uses. The rest (mobile, QR poster) keep their own templates. */
export const GUIDE_THEME_FOR_PDF: Record<string, ThemeKey> = {
  template_pdf_original: "welcomebook",
  template_pdf_modern: "welcomebook",
  template_pdf_basic: "minimal",
};

/** Print PDF theme by the guidebook's web template. */
export const GUIDE_THEME_FOR_PRINT: Record<string, ThemeKey> = {
  template_signature: "welcomebook",
  template_welcomebook: "welcomebook",
  template_original: "classic",
  template_generic: "minimal",
  template_lifestyle: "minimal",
};

export function printThemeFor(webTemplateKey: string | null | undefined): ThemeKey {
  return (webTemplateKey && GUIDE_THEME_FOR_PRINT[webTemplateKey]) || "welcomebook";
}

const ALL_PDF_KEYS = ["template_pdf_original", "template_pdf_basic", "template_pdf_mobile", "template_pdf_qr"];

export interface PdfRequest {
  template: string | null;
  qrUrl: string | null;
}

/** Decides how the guide is presented; `null` keeps the standard design. Only called for layouts drawn by the design system. */
export type Composer = (model: GuideModel) => Promise<GuidePlan | null>;

/** Stable per-content identifier used for ETags: changes when the guidebook, template choice or templates change. */
export function pdfEtag(gb: GuidebookRow, templateKey: string, extra = ""): string {
  const modified = gb.last_modified_time ?? "";
  return createHash("sha256")
    .update(`${gb.id}:${templateKey}:${modified}:${getTemplatesHash()}:r${GUIDE_RENDER_VERSION}${extra}`)
    .digest("hex");
}

export function qrExtra(qrUrl: string | null): string {
  return qrUrl ? `:qr:${createHash("sha256").update(qrUrl).digest("hex").slice(0, 12)}` : "";
}

export function pdfTemplateFor(request: PdfRequest): string {
  return resolvePdfTemplate(request.template);
}

export async function generateGuidebookPdf(gb: GuidebookRow, request: PdfRequest, resolver = defaultResolver, compose?: Composer) {
  const templateKey = pdfTemplateFor(request);
  const theme = GUIDE_THEME_FOR_PDF[templateKey];
  if (theme) {
    const model = await buildGuideModel(gb, resolver, { qrUrl: request.qrUrl });
    const plan = compose ? await compose(model) : null;
    return htmlToPdf(renderGuide(model, { theme: plan?.theme ?? theme, plan }).html);
  }
  const ctx = await buildPdfContext(gb, resolver, { qrUrl: request.qrUrl });
  return htmlToPdf(renderPdfHtml(templateKey, ctx));
}

export async function generatePrintPdf(gb: GuidebookRow, resolver = defaultResolver, compose?: Composer) {
  const model = await buildGuideModel(gb, resolver);
  const plan = compose ? await compose(model) : null;
  return htmlToPdf(renderGuide(model, { theme: plan?.theme ?? printThemeFor(gb.template_key), plan }).html);
}

/** 403 (with an upgrade hint) unless the plan can use AI-designed PDFs: the paid plans that have the print-ready PDF. */
export function assertAiPdfAllowed(plan: PlanConfig): void {
  if (!plan.printPdf) {
    throw new ServiceError(403, `AI-designed PDFs are included with the ${PLAN_CONFIGS[PDF_UPGRADE_PLAN].name} plan and above.`, {
      upgrade: true,
      feature: "ai_pdf",
    });
  }
}

/** 403 (with an upgrade hint) when the plan does not include this PDF; otherwise returns normally. */
export function assertPdfAllowed(plan: PlanConfig, kind: { print: true } | { template: string }): void {
  if ("print" in kind) {
    if (!plan.printPdf) {
      throw new ServiceError(403, `The print-ready PDF is included with the ${PLAN_CONFIGS[PDF_UPGRADE_PLAN].name} plan and above.`, {
        upgrade: true,
        feature: "print_pdf",
      });
    }
    return;
  }
  // Keys without their own layout (template_pdf_modern) print with the original one
  const effective = ALL_PDF_KEYS.includes(kind.template) ? kind.template : "template_pdf_original";
  if (plan.pdfTemplates !== null && !plan.pdfTemplates.includes(effective)) {
    throw new ServiceError(403, `This PDF layout is included with the ${PLAN_CONFIGS[PDF_UPGRADE_PLAN].name} plan and above.`, {
      upgrade: true,
      feature: "pdf_template",
    });
  }
}
