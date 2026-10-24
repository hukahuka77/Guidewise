import { readJson, withUser } from "@/lib/server/apiRoute";
import { SITE_ORIGIN } from "@/lib/server/env";
import { createGiftOwner, isAdmin, recordGiftCreated } from "@/lib/server/gifts";
import { createClaimTicket } from "@/lib/server/guestAccounts";
import { createImportedGuidebook } from "@/lib/server/importService";
import { recommendationsForListing } from "@/lib/server/importPopulate";
import { importListing, ListingImportError } from "@/lib/server/listingImport";
import { rateLimited } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "iad1";

/** Admin outreach: build a guidebook from a host's listing and return a gift link for them. */
export function POST(request: Request) {
  return withUser(
    request,
    async ({ sql, user }) => {
      if (!isAdmin(user.email)) return Response.json({ error: "Not found" }, { status: 404 });
      if (rateLimited(`admin_gift:${user.id}`, 10)) {
        return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
      }
      const data = await readJson(request);
      let fields;
      try {
        fields = await importListing(data.url);
      } catch (error) {
        if (error instanceof ListingImportError) {
          return Response.json({ error: error.userMessage, code: error.code }, { status: error.status });
        }
        throw error;
      }
      // Only make the owner once the listing has imported, so failed imports leave nothing behind
      const guestId = await createGiftOwner();
      const ticket = guestId ? createClaimTicket(guestId) : null;
      if (!guestId || !ticket) return Response.json({ error: "Could not create the gift. Try again." }, { status: 503 });
      const recommendations = await recommendationsForListing(sql, guestId, fields.address_city_state);
      const created = await createImportedGuidebook(sql, guestId, fields, recommendations);
      await recordGiftCreated(sql, { guestId, guidebookId: created.guidebook_id, propertyName: fields.property_name || null, prospectEmail: data.email });
      const origin = SITE_ORIGIN || new URL(request.url).origin;
      return Response.json(
        {
          gift_url: `${origin}/gift/${ticket}?utm_source=outreach`,
          guidebook_id: created.guidebook_id,
          property_name: fields.property_name || null,
          host_name: fields.host_name || null,
          imported: created.imported,
          missing: created.missing,
        },
        { status: 201 },
      );
    },
    { needs: () => Boolean(process.env.OPENAI_API_KEY) },
  );
}

/** Whether the signed-in user can make gifts (the outreach page asks before showing its form). */
export function GET(request: Request) {
  return withUser(request, async ({ user }) =>
    isAdmin(user.email) ? Response.json({ admin: true }) : Response.json({ error: "Not found" }, { status: 404 }),
  );
}
