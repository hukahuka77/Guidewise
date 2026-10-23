import { withUser } from "@/lib/server/apiRoute";
import { loadOwnedGuidebookRow } from "@/lib/server/guidebookService";
import { rateLimited } from "@/lib/server/rateLimit";
import { resolveAiPlan, type AiPlanStatus } from "@/lib/pdf/aiPlan";
import { assertAiPdfAllowed, assertPdfAllowed, generateGuidebookPdf, pdfEtag, pdfTemplateFor, qrExtra } from "@/lib/pdf/service";
import { getUserPlan } from "@/lib/server/usage";
import { SITE_ORIGIN } from "@/lib/server/env";
import { absoluteQrUrl } from "@/lib/publicUrl";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "iad1";

const truthy = (v: string | null, fallback: string) => ["1", "true", "yes"].includes((v ?? fallback).toLowerCase());

/** Port of `get_pdf_on_demand`: the guidebook as a PDF with the chosen PDF template. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(
    request,
    async ({ sql, user }) => {
      const { id } = await params;
      const gb = await loadOwnedGuidebookRow(sql, user.id, id);
      if (!gb) return Response.json({ error: "Guidebook not found" }, { status: 404 });

      const search = new URL(request.url).searchParams;
      const download = truthy(search.get("download"), "0");
      const includeQr = truthy(search.get("include_qr"), "0");
      const qrUrl = includeQr ? absoluteQrUrl(search.get("qr_url"), SITE_ORIGIN || request.url) : null;
      const templateKey = pdfTemplateFor({ template: search.get("template"), qrUrl });
      const plan = await getUserPlan(sql, user.id);
      assertPdfAllowed(plan, { template: templateKey });
      const ai = truthy(search.get("ai"), "0");
      const refresh = ai && truthy(search.get("refresh"), "0");
      if (ai) assertAiPdfAllowed(plan);
      const headers = {
        ETag: `"${pdfEtag(gb, templateKey, qrExtra(qrUrl) + (ai ? ":ai" : ""))}"`,
        // Private: this is an authenticated response and must not be stored by shared caches
        "Cache-Control": "private, max-age=3600",
        "X-PDF-Template-Key": templateKey,
      };
      if (!refresh && request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });

      if (rateLimited(`pdf:${user.id}`, 10)) {
        return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
      }
      let aiStatus = null as AiPlanStatus | null;
      const pdf = await generateGuidebookPdf(gb, { template: templateKey, qrUrl }, undefined, ai
        ? async (model) => {
            const result = await resolveAiPlan(sql, user.id, gb.id, model, { refresh });
            aiStatus = result.status;
            return result.plan;
          }
        : undefined);
      return new Response(new Uint8Array(pdf), {
        headers: {
          ...headers,
          // A fresh design or a fallback must not be pinned in the browser cache
          ...(aiStatus ? { "X-PDF-AI": aiStatus } : {}),
          ...(refresh || aiStatus === "fallback" ? { "Cache-Control": "private, no-store" } : {}),
          "Content-Type": "application/pdf",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="guidebook.pdf"`,
        },
      });
    },
  );
}
