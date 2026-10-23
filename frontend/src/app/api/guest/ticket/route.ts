import { withUser } from "@/lib/server/apiRoute";
import { createClaimTicket } from "@/lib/server/guestAccounts";

export const dynamic = "force-dynamic";

/** A guest asks for a claim ticket, kept in the browser until they sign up or log in. */
export function POST(request: Request) {
  return withUser(request, async ({ user }) => {
    if (!user.isGuest) return Response.json({ error: "Only guests need a claim ticket." }, { status: 400 });
    const ticket = createClaimTicket(user.id);
    return ticket ? Response.json({ ticket }) : Response.json({ error: "This feature is not configured on the server." }, { status: 503 });
  }, { allowGuest: true });
}
