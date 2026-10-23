import { ALLOWED_TEMPLATE_KEYS } from "@/lib/server/guidebookService";
import { DEFAULT_TEMPLATE_KEY, renderGuidebookHtml } from "@/lib/guidebook/render";
import { sampleGuidebook } from "@/lib/guidebook/sample";

export const dynamic = "force-dynamic";

/** A made-up guidebook for the phone on the start screen. Public, never indexed, `?template=` picks the style. */
export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("template") ?? "";
  const key = ALLOWED_TEMPLATE_KEYS.includes(requested) ? requested : DEFAULT_TEMPLATE_KEY;
  const { html } = renderGuidebookHtml(sampleGuidebook(key));
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
