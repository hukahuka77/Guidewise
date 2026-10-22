import { withUser, readJson } from "@/lib/server/apiRoute";
import { createImportedGuidebook } from "@/lib/server/importService";
import { importListing, ListingImportError } from "@/lib/server/listingImport";
import { rateLimited } from "@/lib/server/rateLimit";

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
      return Response.json(await createImportedGuidebook(sql, user.id, fields), { status: 201 });
    },
    { needs: () => Boolean(process.env.OPENAI_API_KEY) },
  );
}
