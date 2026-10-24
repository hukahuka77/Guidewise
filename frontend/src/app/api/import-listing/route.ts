import { withUser, readJson } from "@/lib/server/apiRoute";
import { createImportedGuidebook } from "@/lib/server/importService";
import { recommendationsForListing } from "@/lib/server/importPopulate";
import { importListing, ListingImportError } from "@/lib/server/listingImport";
import { rateLimited } from "@/lib/server/rateLimit";
import { ServiceError } from "@/lib/server/guidebookService";
import { assertCanCreateGuidebook, consumeAiQuota, refundAiQuota } from "@/lib/server/usage";
import { assertGuestCanCreate } from "@/lib/server/guestAccounts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "iad1";

export function POST(request: Request) {
  return withUser(
    request,
    async ({ sql, user }) => {
      if (rateLimited(`api_import_listing:${user.id}`, 5)) {
        return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
      }
      // Check the guidebook cap and creation rate before spending a fetch, OpenAI and Places calls
      // (a guest hears they need an account, rather than an upgrade they can't buy yet)
      if (user.isGuest) await assertGuestCanCreate(sql, user.id);
      await assertCanCreateGuidebook(sql, user.id);
      const data = await readJson(request);
      // An import costs one AI run, charged when the listing goes to OpenAI; it also covers the places
      let charged = false;
      const charge = async () => {
        try {
          await consumeAiQuota(sql, user.id);
          charged = true;
        } catch (error) {
          if (error instanceof ServiceError && error.status === 403) {
            throw new ServiceError(403, "You've used this month's AI runs on your plan. Start with manual setup instead, or upgrade for more.", error.extra);
          }
          throw error;
        }
      };
      let fields;
      try {
        fields = await importListing(data.url, { beforeAi: charge });
      } catch (error) {
        // OpenAI failing is on us, so the run comes back; a page it read but found nothing on stays spent
        if (charged && !(error instanceof ListingImportError && error.code === "no_content")) await refundAiQuota(sql, user.id);
        if (error instanceof ListingImportError) {
          return Response.json({ error: error.userMessage, code: error.code }, { status: error.status });
        }
        throw error;
      }
      // Fill in things to do and places to eat for the listing's city (best effort)
      const recommendations = await recommendationsForListing(sql, user.id, fields.address_city_state, { alreadyCharged: charged });
      return Response.json(await createImportedGuidebook(sql, user.id, fields, recommendations), { status: 201 });
    },
    { needs: () => Boolean(process.env.OPENAI_API_KEY), allowGuest: true },
  );
}
