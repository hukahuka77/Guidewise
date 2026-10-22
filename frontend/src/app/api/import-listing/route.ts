import { withUser, readJson } from "@/lib/server/apiRoute";
import { createImportedGuidebook } from "@/lib/server/importService";
import { recommendationsForListing } from "@/lib/server/importPopulate";
import { importListing, ListingImportError } from "@/lib/server/listingImport";
import { rateLimited } from "@/lib/server/rateLimit";
import { assertCanCreateGuidebook } from "@/lib/server/usage";

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
      await assertCanCreateGuidebook(sql, user.id);
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
      // Fill in things to do and places to eat for the listing's city (best effort)
      const recommendations = await recommendationsForListing(sql, user.id, fields.address_city_state);
      return Response.json(await createImportedGuidebook(sql, user.id, fields, recommendations), { status: 201 });
    },
    { needs: () => Boolean(process.env.OPENAI_API_KEY) },
  );
}
