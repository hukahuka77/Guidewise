import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER, OWNER, setPlan, startTestDb, type TestDb } from "./helpers/testDb";

// Authentication is mocked: "Bearer owner" / "Bearer other" resolve to the two test users.
vi.mock("@/lib/server/auth", () => ({
  isAuthConfigured: () => true,
  getAuthedUser: async (request: Request) => {
    const header = request.headers.get("authorization");
    if (header === "Bearer owner") return { id: "11111111-1111-4111-8111-aaaaaaaaaaaa", email: "owner@example.com" };
    if (header === "Bearer other") return { id: "22222222-2222-4222-8222-bbbbbbbbbbbb", email: "other@example.com" };
    return null;
  },
}));
vi.mock("@/lib/server/proxy", () => ({
  backendFallbackDisabled: () => false,
  proxyToBackend: vi.fn(async (request: Request) => new Response(`PROXIED ${request.method} ${new URL(request.url).pathname}`, { status: 200 })),
}));

import { POST as generate } from "../src/app/api/generate/route";
import { GET as listRoute } from "../src/app/api/guidebooks/route";
import { DELETE, GET as getOne, PATCH, PUT } from "../src/app/api/guidebooks/[id]/route";
import { POST as template } from "../src/app/api/guidebook/[id]/template/route";
import { GET as hosts } from "../src/app/api/hosts/route";
import { setSqlForTests } from "../src/lib/server/db";
import { guidebookResponse } from "../src/lib/server/guidebookResponse";
import { proxyToBackend } from "../src/lib/server/proxy";
import type { GuidebookRow } from "../src/lib/guidebook/types";

let db: TestDb;
beforeAll(async () => {
  db = await startTestDb();
}, 60000);
afterAll(async () => {
  setSqlForTests(undefined);
  await db?.close();
});
beforeEach(async () => {
  setSqlForTests(db.sql);
  vi.mocked(proxyToBackend).mockClear();
  await db.reset();
});
afterEach(() => setSqlForTests(db.sql));

const url = (path: string) => `http://localhost${path}`;
const req = (method: string, path: string, who: "owner" | "other" | null = "owner", body?: unknown) =>
  new Request(url(path), {
    method,
    headers: { ...(who ? { Authorization: `Bearer ${who}` } : {}), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (r: Response) => r.json() as Promise<Record<string, any>>;

async function createVia(body: Record<string, unknown>, who: "owner" | "other" = "owner") {
  const res = await generate(req("POST", "/api/generate", who, body));
  return { res, body: await json(res) };
}

describe("authentication and configuration", () => {
  it("returns 401 JSON without a valid token on every protected route", async () => {
    const id = "x";
    const calls: Promise<Response>[] = [
      generate(req("POST", "/api/generate", null, {})),
      listRoute(req("GET", "/api/guidebooks", null)),
      getOne(req("GET", "/api/guidebooks/x", null), ctx(id)),
      PUT(req("PUT", "/api/guidebooks/x", null, {}), ctx(id)),
      PATCH(req("PATCH", "/api/guidebooks/x", null, {}), ctx(id)),
      DELETE(req("DELETE", "/api/guidebooks/x", null), ctx(id)),
      template(req("POST", "/api/guidebook/x/template", null, {}), ctx(id)),
      hosts(req("GET", "/api/hosts", null)),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(401);
      expect(await json(res)).toEqual({ error: "Unauthorized" });
    }
    const bad = await listRoute(new Request(url("/api/guidebooks"), { headers: { Authorization: "Bearer nonsense" } }));
    expect(bad.status).toBe(401);
  });

  it("hands requests to Flask when DATABASE_URL is not configured", async () => {
    setSqlForTests(null);
    const res = await listRoute(req("GET", "/api/guidebooks"));
    expect(await res.text()).toBe("PROXIED GET /api/guidebooks");
    const post = await generate(req("POST", "/api/generate", "owner", { property_name: "x" }));
    expect(await post.text()).toBe("PROXIED POST /api/generate");
    expect(proxyToBackend).toHaveBeenCalledTimes(2);
  });

});

describe("create, read, update, delete over HTTP", () => {
  it("POST /api/generate: 201 with ids and the public url on the free plan", async () => {
    const { res, body } = await createVia({ property_name: "Cozy Cabin", host_name: "Andrew" });
    expect(res.status).toBe(201);
    expect(body).toMatchObject({ ok: true, template_key: "template_original" });
    expect(body.guidebook_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("X-Guidebook-Url")).toMatch(/^\/g\/cozy-cabin-[0-9a-f]{6}$/);
    expect(res.headers.get("X-Guidebook-Preview")).toBeNull();
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("X-Guidebook-Url");
  });

  it("POST /api/generate: 403 with an upgrade hint once the plan's guidebook cap is reached", async () => {
    await setPlan(db.sql, OWNER, "starter");
    for (let i = 0; i < 5; i++) expect((await createVia({ property_name: `House ${i}` })).res.status).toBe(201);
    const { res, body } = await createVia({ property_name: "One too many" });
    expect(res.status).toBe(403);
    expect(body).toMatchObject({ upgrade: true, quota: "guidebooks" });
    expect(body.error).toContain("up to 5 guidebooks");
  });

  it("POST /api/generate: a new guidebook is live at its public URL; bad input is a 400", async () => {
    await setPlan(db.sql, OWNER, "pro");
    const { res, body } = await createVia({ property_name: "Live House" });
    expect(res.status).toBe(201);
    expect(res.headers.get("X-Guidebook-Url")).toMatch(/^\/g\/live-house-[0-9a-f]{6}$/);
    expect(body.ok).toBe(true);
    expect(body.public_slug).toMatch(/^live-house-[0-9a-f]{6}$/);
    const bad = await generate(req("POST", "/api/generate", "owner", { host_name: "x" }));
    expect(bad.status).toBe(400);
    expect(await json(bad)).toEqual({ error: "property_name is required" });
    const garbage = await generate(new Request(url("/api/generate"), { method: "POST", headers: { Authorization: "Bearer owner" }, body: "not json" }));
    expect(garbage.status).toBe(400);
  });

  it("full lifecycle: list, get, patch, put, delete, with ownership enforced", async () => {
    const { body: created } = await createVia({ property_name: "Lifecycle", welcome_message: "hi" });
    const id = created.guidebook_id as string;

    const list = await json(await listRoute(req("GET", "/api/guidebooks")));
    expect(list.ok).toBe(true);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ id, property_name: "Lifecycle", public_slug: expect.stringMatching(/^lifecycle-/) });
    expect(list.items[0]).not.toHaveProperty("active");
    expect(list.items[0]).not.toHaveProperty("preview_url");
    expect((await json(await listRoute(req("GET", "/api/guidebooks", "other")))).items).toEqual([]);

    const one = await json(await getOne(req("GET", `/api/guidebooks/${id}`), ctx(id)));
    expect(one).toMatchObject({ id, welcome_message: "hi", property: { name: "Lifecycle" } });
    const stranger = await getOne(req("GET", `/api/guidebooks/${id}`, "other"), ctx(id));
    expect(stranger.status).toBe(404);
    expect(await json(stranger)).toEqual({ error: "Not found" });

    const patched = await PATCH(req("PATCH", `/api/guidebooks/${id}`, "owner", { welcome_message: "patched" }), ctx(id));
    expect(patched.status).toBe(200);
    expect(await json(patched)).toEqual({ ok: true, guidebook_id: id });
    const putRes = await PUT(req("PUT", `/api/guidebooks/${id}`, "owner", { parking_info: "garage" }), ctx(id));
    expect(putRes.status).toBe(200);
    const after = await json(await getOne(req("GET", `/api/guidebooks/${id}`), ctx(id)));
    expect(after).toMatchObject({ welcome_message: "patched", parking_info: "garage" });
    expect((await PATCH(req("PATCH", `/api/guidebooks/${id}`, "other", { welcome_message: "hax" }), ctx(id))).status).toBe(404);

    expect((await DELETE(req("DELETE", `/api/guidebooks/${id}`, "other"), ctx(id))).status).toBe(404);
    const del = await DELETE(req("DELETE", `/api/guidebooks/${id}`), ctx(id));
    expect(del.status).toBe(200);
    expect(await json(del)).toEqual({ ok: true });
    expect((await getOne(req("GET", `/api/guidebooks/${id}`), ctx(id))).status).toBe(404);
  });

  it("GET /api/hosts", async () => {
    await createVia({ property_name: "P", host_name: "Andrew", host_bio: "bio" });
    const body = await json(await hosts(req("GET", "/api/hosts")));
    expect(body.hosts).toEqual([{ id: expect.any(Number), name: "Andrew", bio: "bio", contact: null, photo_url: null }]);
  });
});

describe("template and public page over HTTP", () => {
  it("template: validates and updates", async () => {
    const { body } = await createVia({ property_name: "T" });
    const id = body.guidebook_id as string;
    const ok = await template(req("POST", `/api/guidebook/${id}/template`, "owner", { template_key: "template_welcomebook" }), ctx(id));
    expect(await json(ok)).toEqual({ ok: true, template_key: "template_welcomebook" });
    const bad = await template(req("POST", `/api/guidebook/${id}/template`, "owner", { template_key: "nope" }), ctx(id));
    expect(bad.status).toBe(400);
    const badBody = await json(bad);
    expect(badBody.error).toBe("Invalid template_key");
    expect(badBody.allowed).toContain("template_generic");
    expect((await template(req("POST", `/api/guidebook/${id}/template`, "other", { template_key: "template_generic" }), ctx(id))).status).toBe(404);
  });

  it("pages are rendered on demand: new edits show up, ETags change with the content, matching ETags get a 304", async () => {
    await setPlan(db.sql, OWNER, "pro");
    const { body } = await createVia({ property_name: "Snap House", welcome_message: "Original welcome", template_key: "template_generic" });
    const id = body.guidebook_id as string;

    // Load the row the way the public route does (Supabase embeds property/host as ISO strings).
    const load = async (): Promise<GuidebookRow> => {
      const [row] = await db.sql`
        select g.*, to_jsonb(p) as property, to_jsonb(h) as host from guidebook g
          left join property p on p.id = g.property_id left join host h on h.id = g.host_id where g.id = ${id}`;
      const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
      return { ...row, created_time: iso(row.created_time), last_modified_time: iso(row.last_modified_time) } as unknown as GuidebookRow;
    };

    const first = guidebookResponse(new Request(url("/g/x")), await load());
    const etag = first.headers.get("ETag") as string;
    expect(await first.text()).toContain("Original welcome");
    expect(guidebookResponse(new Request(url("/g/x"), { headers: { "If-None-Match": etag } }), await load()).status).toBe(304);

    await new Promise((r) => setTimeout(r, 20));
    await PATCH(req("PATCH", `/api/guidebooks/${id}`, "owner", { welcome_message: "Edited welcome" }), ctx(id));
    const edited = guidebookResponse(new Request(url("/g/x"), { headers: { "If-None-Match": etag } }), await load());
    expect(edited.status).toBe(200);
    const html = await edited.text();
    expect(html).toContain("Edited welcome");
    expect(html).not.toMatch(/Preview Mode|preview-watermark/);
    expect(edited.headers.get("ETag")).not.toBe(etag);
  });

  it("a guidebook created before every guidebook was live gets its public URL the first time it is listed", async () => {
    const { body } = await createVia({ property_name: "Old Draft" });
    const id = body.guidebook_id as string;
    await db.sql`update guidebook set public_slug = null where id = ${id}`;
    const list = await json(await listRoute(req("GET", "/api/guidebooks")));
    const slug = list.items[0].public_slug as string;
    expect(slug).toMatch(/^old-draft-[0-9a-f]{6}$/);
    const [row] = await db.sql`select public_slug from guidebook where id = ${id}`;
    expect(row.public_slug).toBe(slug); // saved, so it stays the same
    expect((await json(await listRoute(req("GET", "/api/guidebooks")))).items[0].public_slug).toBe(slug);
    const one = await json(await getOne(req("GET", `/api/guidebooks/${id}`), ctx(id)));
    expect(one.public_slug).toBe(slug);
  });
});

describe("error handling", () => {
  it("returns a 500 JSON error for writes instead of retrying them on Flask", async () => {
    await db.sql.unsafe(`create or replace function boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
                         create trigger guidebook_boom before insert on guidebook for each row execute function boom();`);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await generate(req("POST", "/api/generate", "owner", { property_name: "Fails" }));
      expect(res.status).toBe(500);
      expect((await json(res)).error).toContain("Request failed");
      expect(proxyToBackend).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      await db.sql.unsafe("drop trigger guidebook_boom on guidebook; drop function boom();");
    }
  });

  it("falls back to Flask for reads that throw unexpectedly", async () => {
    const broken = ((strings: TemplateStringsArray) => {
      throw new Error(`db down ${strings[0]}`);
    }) as unknown as typeof db.sql;
    setSqlForTests(broken);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await listRoute(req("GET", "/api/guidebooks"));
      expect(await res.text()).toBe("PROXIED GET /api/guidebooks");
    } finally {
      spy.mockRestore();
    }
  });
});
