import { getSql } from "@/lib/server/db";
import { findGift } from "@/lib/server/gifts";
import { loadOwnedGuidebookRow } from "@/lib/server/guidebookService";
import { renderGuidebookHtml } from "@/lib/guidebook/render";
import { notConfigured } from "@/lib/server/apiRoute";
import { clientIp, rateLimited } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** The gifted guidebook, rendered for the gift page's phone preview. */
export async function GET(request: Request, { params }: { params: Promise<{ ticket: string }> }) {
  const sql = getSql();
  if (!sql) return notConfigured();
  if (rateLimited(`gift:${clientIp(request)}`, 30)) return new Response("Too many requests", { status: 429 });
  const gift = await findGift(sql, decodeURIComponent((await params).ticket)).catch(() => null);
  const row = gift ? await loadOwnedGuidebookRow(sql, gift.guestId, gift.guidebookId) : null;
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(renderGuidebookHtml(row).html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}
