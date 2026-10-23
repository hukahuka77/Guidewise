import { readJson, withUser } from "@/lib/server/apiRoute";
import { claimGuestGuidebooks, readClaimTicket } from "@/lib/server/guestAccounts";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

/** After signing up or logging in, move the guidebooks made as a guest into the account. */
export function POST(request: Request) {
  return withUser(request, async ({ sql, user }) => {
    const guestId = readClaimTicket((await readJson(request)).ticket);
    if (!guestId) return Response.json({ error: "This claim ticket is invalid or has expired." }, { status: 400 });
    return Response.json({ guidebook_ids: await claimGuestGuidebooks(sql, guestId, user.id) });
  });
}
