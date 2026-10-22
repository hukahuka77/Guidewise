import { withUser } from "@/lib/server/apiRoute";
import { loadOwnedGuidebookRow, ServiceError } from "@/lib/server/guidebookService";
import { rateLimited } from "@/lib/server/rateLimit";
import { resolveAiPlan, type AiPlanStatus } from "@/lib/pdf/aiPlan";
import { assertAiPdfAllowed, assertPdfAllowed, generatePrintPdf, pdfEtag } from "@/lib/pdf/service";
import { getUserPlan } from "@/lib/server/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "iad1";

/** Port of `get_print_pdf`: a print-ready PDF laid out for the guidebook's web template. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(
    request,
    async ({ sql, user }) => {
      const { id } = await params;
      const gb = await loadOwnedGuidebookRow(sql, user.id, id);
      if (!gb) return Response.json({ error: "Guidebook not found" }, { status: 404 });

      const plan = await getUserPlan(sql, user.id);
      assertPdfAllowed(plan, { print: true });
      const search = new URL(request.url).searchParams;
      const truthy = (name: string, fallback: string) => ["1", "true", "yes"].includes((search.get(name) ?? fallback).toLowerCase());
      const download = truthy("download", "1");
      const ai = truthy("ai", "0");
      const refresh = ai && truthy("refresh", "0");
      if (ai) assertAiPdfAllowed(plan);
      const safeName = (gb.property?.name || "guidebook").replace(/ /g, "_").replace(/\//g, "_");
      // Header values must be latin-1; keep a safe ASCII fallback plus the real name as filename*
      const ascii = safeName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
      const headers = {
        ETag: `"${pdfEtag(gb, `${gb.template_key ?? "template_welcomebook"}_print`, ai ? ":ai" : "")}"`,
        "Cache-Control": "private, max-age=3600",
        "X-PDF-Type": "print",
      };
      if (!refresh && request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });

      if (rateLimited(`pdf:${user.id}`, 10)) {
        return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
      }
      let pdf: Buffer;
      let aiStatus = null as AiPlanStatus | null;
      try {
        pdf = await generatePrintPdf(gb, undefined, ai
          ? async (model) => {
              const result = await resolveAiPlan(sql, user.id, gb.id, model, { refresh });
              aiStatus = result.status;
              return result.plan;
            }
          : undefined);
      } catch (error) {
        if (error instanceof ServiceError) throw error; // e.g. AI allowance used up (403 with an upgrade hint)
        console.error("Failed to generate print PDF", error);
        return Response.json({ error: "Failed to generate print PDF" }, { status: 500 });
      }
      return new Response(new Uint8Array(pdf), {
        headers: {
          ...headers,
          ...(aiStatus ? { "X-PDF-AI": aiStatus } : {}),
          ...(refresh || aiStatus === "fallback" ? { "Cache-Control": "private, no-store" } : {}),
          "Content-Type": "application/pdf",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}_print.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}_print.pdf`,
        },
      });
    },
    { fallbackOnError: true },
  );
}
