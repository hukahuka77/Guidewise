import { readJson, withAuth } from "@/lib/server/apiRoute";
import { googleDriveMinutes, isGoogleConfigured } from "@/lib/server/googlePlaces";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

const MAX_DESTINATIONS = 30;

/** Driving minutes from the guidebook's address to each place, for the editor after the address changes. */
export function POST(request: Request) {
  return withAuth(
    request,
    async () => {
      const data = await readJson(request);
      const origin = typeof data.origin === "string" ? data.origin.trim().slice(0, 300) : "";
      const destinations = Array.isArray(data.destinations)
        ? data.destinations.slice(0, MAX_DESTINATIONS).map((d: unknown) => (typeof d === "string" ? d.slice(0, 300) : ""))
        : null;
      if (!origin || !destinations) return Response.json({ error: "origin and destinations are required" }, { status: 400 });
      return Response.json({ minutes: await googleDriveMinutes(origin, destinations) });
    },
    { needs: isGoogleConfigured, rateLimit: { name: "api_places_drive_times", limit: 20 } },
  );
}
