import { withUser } from "@/lib/server/apiRoute";
import { loadOwnedGuidebookRow } from "@/lib/server/guidebookService";
import { rateLimited } from "@/lib/server/rateLimit";
import { assertPdfAllowed, generatePrintPdf, pdfEtag } from "@/lib/pdf/service";
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

      assertPdfAllowed(await getUserPlan(sql, user.id), { print: true });
      const download = ["1", "true", "yes"].includes((new URL(request.url).searchParams.get("download") ?? "1").toLowerCase());
      const safeName = (gb.property?.name || "guidebook").replace(/ /g, "_").replace(/\//g, "_");
      // Header values must be latin-1; keep a safe ASCII fallback plus the real name as filename*
      const ascii = safeName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
      const headers = {
        ETag: `"${pdfEtag(gb, `${gb.template_key ?? "template_welcomebook"}_print`)}"`,
        "Cache-Control": "private, max-age=3600",
        "X-PDF-Type": "print",
      };
      if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });

      if (rateLimited(`pdf:${user.id}`, 10)) {
        return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
      }
      let pdf: Buffer;
      try {
        pdf = await generatePrintPdf(gb);
      } catch (error) {
        console.error("Failed to generate print PDF", error);
        return Response.json({ error: "Failed to generate print PDF" }, { status: 500 });
      }
      return new Response(new Uint8Array(pdf), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}_print.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}_print.pdf`,
        },
      });
    },
    { fallbackOnError: true },
  );
}
