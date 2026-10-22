import { createHash, timingSafeEqual } from "node:crypto";
import { PLACE_PHOTO_SNAPSHOT_MARKER, getTemplatesHash, renderGuidebookHtml } from "@/lib/guidebook/render";
import type { GuidebookRow } from "@/lib/guidebook/types";
import { SITE_ORIGIN } from "./env";

const PUBLIC_CACHE = "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function htmlResponse(html: string, headers: Record<string, string>): Response {
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
}

export function notModified(etag: string): Response {
  return new Response(null, { status: 304, headers: { ETag: etag } });
}

export function notFoundResponse(message = "Not Found"): Response {
  return new Response(message, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/** Constant-time string comparison (for share tokens). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Is the published snapshot present and newer than the last edit? */
function snapshotIsFresh(gb: GuidebookRow): boolean {
  if (!gb.published_html || !gb.published_html.includes(PLACE_PHOTO_SNAPSHOT_MARKER) || !gb.published_at) return false;
  if (!gb.last_modified_time) return false;
  return Date.parse(gb.published_at) >= Date.parse(gb.last_modified_time);
}

export interface LiveOptions {
  /** False for guidebooks whose views are metered per request (free plan): never stored by shared caches. */
  cacheable?: boolean;
  /** Add the small script that records the view for pages served from the CDN cache. */
  beacon?: boolean;
}

/** Records a view once per half hour per browser; only used for cacheable (paid-plan) pages. */
const beaconScript = (slug: string) =>
  `<script>(function(){try{var k="gwv:"+${JSON.stringify(slug)},t=Date.now(),l=+localStorage.getItem(k)||0;if(t-l<1800000)return;localStorage.setItem(k,String(t));navigator.sendBeacon("/api/view/"+encodeURIComponent(${JSON.stringify(slug)}))}catch(e){}})()</script>`;

function withBeacon(html: string, gb: GuidebookRow, enabled: boolean | undefined): string {
  if (!enabled || !gb.public_slug) return html;
  const tag = beaconScript(gb.public_slug);
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${tag}</body>`) : html + tag;
}

/** Shown to guests when a free host has used this month's views. */
export function limitReachedResponse(): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Guidebook unavailable</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F8F5F1;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937}main{max-width:28rem;margin:1.5rem;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(0,0,0,.1);text-align:center}h1{font-size:1.25rem;margin:0 0 .75rem}p{margin:.5rem 0;color:#4b5563;line-height:1.5}</style></head><body><main><h1>This guidebook is temporarily unavailable</h1><p>It has reached its view limit for this month.</p><p>Please contact your host, or check back next month.</p></main></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "X-Guidewise-Limit": "views",
    },
  });
}

/** Serve a live (active) guidebook: the stored snapshot when fresh, otherwise render on demand. */
export function liveGuidebookResponse(request: Request, gb: GuidebookRow, options: LiveOptions = {}): Response {
  const incoming = request.headers.get("if-none-match");
  const cache = options.cacheable === false ? "private, no-store" : PUBLIC_CACHE;

  if (snapshotIsFresh(gb)) {
    const etag = gb.published_etag || sha256(`${gb.id}${gb.template_key || ""}${gb.last_modified_time}`);
    if (incoming === etag) return notModified(etag);
    return htmlResponse(withBeacon(gb.published_html as string, gb, options.beacon), { ETag: etag, "Cache-Control": cache });
  }

  const etag = sha256(`${gb.id}:${gb.template_key}:${gb.last_modified_time}:${getTemplatesHash()}:wm=false`);
  if (incoming === etag) return notModified(etag);
  const { html, templateKey } = renderGuidebookHtml(gb, { showWatermark: false, upgradeUrl: `${SITE_ORIGIN}/pricing` });
  return htmlResponse(withBeacon(html, gb, options.beacon), { ETag: etag, "Cache-Control": cache, "X-Template-Key": templateKey });
}

/** Render a guidebook for its owner / share-link holders: watermarked while a draft, never cached. */
export function previewGuidebookResponse(gb: GuidebookRow): Response {
  const { html, templateKey } = renderGuidebookHtml(gb, {
    showWatermark: !gb.active,
    upgradeUrl: `${SITE_ORIGIN}/pricing`,
  });
  return htmlResponse(html, {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "X-Template-Key": templateKey,
  });
}
