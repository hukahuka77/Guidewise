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
import { buildPdfContext, buildPrintContext } from "./context";
import type { PhotoResolver } from "./recommendations";
import { PDF_TEMPLATE_REGISTRY, renderPdfHtml, renderPrintHtml, resolvePdfTemplate, resolvePrintTemplate } from "./render";

export const defaultResolver: PhotoResolver = {
  photoReference: googlePlacesPhotoReference,
  async findPlaceId(query) {
    const results = (await googlePlacesTextSearch(query)).results;
    const first = Array.isArray(results) ? (results[0] as { place_id?: unknown } | undefined) : undefined;
    return typeof first?.place_id === "string" && first.place_id ? first.place_id : null;
  },
  photoUrl: (ref) => googlePlacesPhotoUrl(ref),
};

export interface PdfRequest {
  template: string | null;
  qrUrl: string | null;
}

/** Stable per-content identifier used for ETags: changes when the guidebook, template choice or templates change. */
export function pdfEtag(gb: GuidebookRow, templateKey: string, extra = ""): string {
  const modified = gb.last_modified_time ?? "";
  return createHash("sha256")
    .update(`${gb.id}:${templateKey}:${modified}:${getTemplatesHash()}${extra}`)
    .digest("hex");
}

export function qrExtra(qrUrl: string | null): string {
  return qrUrl ? `:qr:${createHash("sha256").update(qrUrl).digest("hex").slice(0, 12)}` : "";
}

export function pdfTemplateFor(request: PdfRequest): string {
  return resolvePdfTemplate(request.template);
}

export async function generateGuidebookPdf(gb: GuidebookRow, request: PdfRequest, resolver = defaultResolver) {
  const templateKey = pdfTemplateFor(request);
  const ctx = await buildPdfContext(gb, resolver, { qrUrl: request.qrUrl });
  return htmlToPdf(renderPdfHtml(templateKey, ctx));
}

export async function generatePrintPdf(gb: GuidebookRow, resolver = defaultResolver) {
  const key = resolvePrintTemplate(gb.template_key);
  const ctx = await buildPrintContext(gb, resolver, { rawRules: key === "template_welcomebook" });
  return htmlToPdf(renderPrintHtml(key, ctx));
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
  const effective = kind.template in PDF_TEMPLATE_REGISTRY ? kind.template : "template_pdf_original";
  if (plan.pdfTemplates !== null && !plan.pdfTemplates.includes(effective)) {
    throw new ServiceError(403, `This PDF layout is included with the ${PLAN_CONFIGS[PDF_UPGRADE_PLAN].name} plan and above.`, {
      upgrade: true,
      feature: "pdf_template",
    });
  }
}
