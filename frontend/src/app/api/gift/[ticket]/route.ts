import { getSql } from "@/lib/server/db";
import { findGift } from "@/lib/server/gifts";
import { notConfigured } from "@/lib/server/apiRoute";
import { clientIp, rateLimited } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** What a gift link holds, for the gift page (public: the ticket is the secret). */
export async function GET(request: Request, { params }: { params: Promise<{ ticket: string }> }) {
  const sql = getSql();
  if (!sql) return notConfigured();
  if (rateLimited(`gift:${clientIp(request)}`, 30)) return Response.json({ error: "Too many requests" }, { status: 429 });
  const gift = await findGift(sql, decodeURIComponent((await params).ticket)).catch(() => null);
  if (!gift) return Response.json({ error: "This gift link has expired or was already claimed." }, { status: 404 });
  return Response.json(
    { property_name: gift.propertyName, host_name: gift.hostName },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
