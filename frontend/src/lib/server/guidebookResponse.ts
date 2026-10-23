import { createHash } from "node:crypto";
import { getTemplatesHash, renderGuidebookHtml } from "@/lib/guidebook/render";
import type { GuidebookRow } from "@/lib/guidebook/types";

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

/** The guidebook could not be loaded (server not configured, or the database failed). Never cached. */
export function unavailableResponse(status = 503): Response {
  return new Response("This guidebook is temporarily unavailable. Please try again in a moment.", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
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

/** A guidebook made by someone who hasn't created an account yet: not shared until they save it. */
export function notSavedResponse(): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Guidebook not saved yet</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F8F5F1;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937}main{max-width:28rem;margin:1.5rem;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(0,0,0,.1);text-align:center}h1{font-size:1.25rem;margin:0 0 .75rem}p{margin:.5rem 0;color:#4b5563;line-height:1.5}a{color:#e11d48}</style></head><body><main><h1>This guidebook isn&#39;t shared yet</h1><p>Its host hasn&#39;t saved it. Once they create their free Guidewise account, it will appear here.</p><p><a href="/">Make your own guidebook</a></p></main></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}

/** Render a guidebook on demand (ETag changes with the content and the templates). */
export function guidebookResponse(request: Request, gb: GuidebookRow, options: LiveOptions = {}): Response {
  const incoming = request.headers.get("if-none-match");
  const cache = options.cacheable === false ? "private, no-store" : PUBLIC_CACHE;

  const etag = sha256(`${gb.id}:${gb.template_key}:${gb.last_modified_time}:${getTemplatesHash()}`);
  if (incoming === etag) return notModified(etag);
  const { html, templateKey } = renderGuidebookHtml(gb);
  // Guidebooks hold door codes and Wi-Fi passwords: guests get the link, search engines must not index it
  return htmlResponse(withBeacon(html, gb, options.beacon), {
    ETag: etag,
    "Cache-Control": cache,
    "X-Robots-Tag": "noindex, nofollow",
    "X-Template-Key": templateKey,
  });
}
