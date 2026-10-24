import { readJson, withUser } from "@/lib/server/apiRoute";
import type { Sql } from "@/lib/server/db";
import { refreshGuidebookDriveTimes } from "@/lib/server/driveTimes";
import { deleteGuidebook, getGuidebookPayload, updateGuidebook } from "@/lib/server/guidebookService";

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";

type Params = { params: Promise<{ id: string }> };

export function GET(request: Request, { params }: Params) {
  return withUser(
    request,
    async ({ sql, user }) => Response.json(await getGuidebookPayload(sql, user.id, (await params).id)),
    { allowGuest: true },
  );
}

async function addressOf(sql: Sql, id: string): Promise<string> {
  const [row] = await sql`select p.address_street from guidebook g left join property p on p.id = g.property_id where g.id = ${id}`;
  return row?.address_street ?? "";
}

function update(request: Request, { params }: Params) {
  return withUser(request, async ({ sql, user }) => {
    const id = (await params).id;
    const data = await readJson(request);
    // A new address re-measures the stored places' drive times, unless the save carries its own lists
    // (the editor measures those itself, so it can show them)
    const remeasure = "address_street" in data && !("things_to_do" in data) && !("places_to_eat" in data);
    const before = remeasure ? await addressOf(sql, id) : null;
    const { guidebookId } = await updateGuidebook(sql, user.id, id, data);
    if (remeasure && (await addressOf(sql, id)) !== before) await refreshGuidebookDriveTimes(sql, guidebookId);
    return Response.json({ ok: true, guidebook_id: guidebookId });
  }, { allowGuest: true });
}
export const PUT = update;
export const PATCH = update;

export function DELETE(request: Request, { params }: Params) {
  return withUser(request, async ({ sql, user }) => {
    await deleteGuidebook(sql, user.id, (await params).id);
    return Response.json({ ok: true });
  }, { allowGuest: true });
}
