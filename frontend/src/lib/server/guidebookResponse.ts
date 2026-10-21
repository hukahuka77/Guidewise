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

/** Serve a live (active) guidebook: the stored snapshot when fresh, otherwise render on demand. */
export function liveGuidebookResponse(request: Request, gb: GuidebookRow): Response {
  const incoming = request.headers.get("if-none-match");

  if (snapshotIsFresh(gb)) {
    const etag = gb.published_etag || sha256(`${gb.id}${gb.template_key || ""}${gb.last_modified_time}`);
    if (incoming === etag) return notModified(etag);
    return htmlResponse(gb.published_html as string, { ETag: etag, "Cache-Control": PUBLIC_CACHE });
  }

  const etag = sha256(`${gb.id}:${gb.template_key}:${gb.last_modified_time}:${getTemplatesHash()}:wm=false`);
  if (incoming === etag) return notModified(etag);
  const { html, templateKey } = renderGuidebookHtml(gb, { showWatermark: false, upgradeUrl: `${SITE_ORIGIN}/pricing` });
  return htmlResponse(html, { ETag: etag, "Cache-Control": PUBLIC_CACHE, "X-Template-Key": templateKey });
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
