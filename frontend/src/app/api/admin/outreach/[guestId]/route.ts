import { readJson, withUser } from "@/lib/server/apiRoute";
import { isAdmin, REPLY_STATUSES, setOutreachReply, type ReplyStatus } from "@/lib/server/gifts";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark how a prospect answered a gift email: { reply_status: "declined" | "interested" | "replied" | null, reply_note? }. Admins only. */
export function PATCH(request: Request, { params }: { params: Promise<{ guestId: string }> }) {
  return withUser(request, async ({ sql, user }) => {
    if (!isAdmin(user.email)) return Response.json({ error: "Not found" }, { status: 404 });
    const { guestId } = await params;
    if (!UUID.test(guestId)) return Response.json({ error: "Not found" }, { status: 404 });
    const data = await readJson(request);
    const status = data.reply_status;
    if (status !== null && !REPLY_STATUSES.includes(status as ReplyStatus)) {
      return Response.json({ error: `reply_status must be one of ${REPLY_STATUSES.join(", ")} or null` }, { status: 400 });
    }
    const found = await setOutreachReply(sql, guestId, {
      status: status as ReplyStatus | null,
      note: typeof data.reply_note === "string" ? data.reply_note : null,
      repliedAt: typeof data.replied_at === "string" ? data.replied_at : null,
    });
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  });
}
