import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER, OWNER, setPlan, startTestDb, type TestDb } from "./helpers/testDb";

vi.mock("@/lib/server/auth", () => ({
  isAuthConfigured: () => true,
  getAuthedUser: async (request: Request) => {
    const h = request.headers.get("authorization");
    if (h === "Bearer owner") return { id: "11111111-1111-4111-8111-aaaaaaaaaaaa", email: "o@example.com" };
    if (h === "Bearer other") return { id: "22222222-2222-4222-8222-bbbbbbbbbbbb", email: "x@example.com" };
    return null;
  },
}));

const openaiCreate = vi.fn();
vi.mock("openai", () => ({ default: class { chat = { completions: { create: openaiCreate } }; } }));

import { GET as analyticsRoute } from "../src/app/api/analytics/views/route";
import { POST as aiFood } from "../src/app/api/ai-food/route";
import { POST as aiRecs } from "../src/app/api/ai-recommendations/route";
import { POST as beaconRoute } from "../src/app/api/view/[slug]/route";
import { GET as byIdRoute } from "../src/app/guidebook/[id]/route";
import { GET as slugRoute } from "../src/app/g/[slug]/route";
import { setSqlForTests } from "../src/lib/server/db";
import { resetRateLimitsForTests } from "../src/lib/server/rateLimit";
import { aiUsage, consumeAiQuota, isNonViewRequest, monthStart, monthlyViews, recordView, secondsUntilMonthEnd, visitorKey } from "../src/lib/server/usage";
import { createGuidebook } from "../src/lib/server/guidebookService";

// The page routes read guidebooks through Supabase's REST client; serve them from the test database instead.
vi.mock("@/lib/server/guidebooks", async () => {
  const { getSql } = await import("../src/lib/server/db");
  const load = async (column: "public_slug" | "id", value: string) => {
    const sql = getSql()!;
    const rows = await sql`
      select g.*, to_jsonb(p) as property, to_jsonb(h) as host from guidebook g
        left join property p on p.id = g.property_id left join host h on h.id = g.host_id
       where ${sql(column === "id" ? "g.id" : "g.public_slug")} = ${value} limit 1`.catch(async () => {
      // postgres.js cannot parameterise identifiers inside this fragment shape; fall back to two explicit queries
      return column === "id"
        ? await sql`select g.*, to_jsonb(p) as property, to_jsonb(h) as host from guidebook g left join property p on p.id = g.property_id left join host h on h.id = g.host_id where g.id = ${value} limit 1`
        : await sql`select g.*, to_jsonb(p) as property, to_jsonb(h) as host from guidebook g left join property p on p.id = g.property_id left join host h on h.id = g.host_id where g.public_slug = ${value} limit 1`;
    });
    const r = rows[0];
    return r ? { ...r, created_time: r.created_time?.toISOString?.() ?? null, last_modified_time: r.last_modified_time?.toISOString?.() ?? null } : null;
  };
  return {
    fetchGuidebookBySlug: (slug: string) => load("public_slug", slug),
    fetchGuidebookById: (id: string) => load("id", id),
  };
});
vi.mock("@/lib/server/supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));

let db: TestDb;
let slug: string;
let gbId: string;

beforeAll(async () => {
  db = await startTestDb();
  setSqlForTests(db.sql);
}, 60000);
afterAll(async () => {
  setSqlForTests(undefined);
  await db?.close();
});
beforeEach(async () => {
  await db.reset();
  resetRateLimitsForTests();
  openaiCreate.mockReset();
  const made = await createGuidebook(db.sql, OWNER, { property_name: "Meter House" });
  slug = made.publicSlug as string;
  gbId = made.guidebookId;
});

const BROWSER = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
let visitor = 0;
/** A request from a distinct visitor (own IP), like a different guest. */
const guest = (path: string, extra: Record<string, string> = {}, method = "GET") =>
  new Request(`http://localhost${path}`, { method, headers: { "user-agent": BROWSER, "x-forwarded-for": `203.0.113.${++visitor % 250}`, ...extra } });
const sameGuest = (ip: string, path: string) => new Request(`http://localhost${path}`, { headers: { "user-agent": BROWSER, "x-forwarded-for": ip } });
const slugCtx = () => ({ params: Promise.resolve({ slug }) });
const idCtx = () => ({ params: Promise.resolve({ id: gbId }) });
const views = () => monthlyViews(db.sql, OWNER);

describe("helpers", () => {
  it("month boundaries", () => {
    expect(monthStart(new Date("2026-10-22T05:00:00Z"))).toBe("2026-10-01");
    expect(monthStart(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-01");
    expect(secondsUntilMonthEnd(new Date("2026-10-31T23:59:00Z"))).toBe(60);
  });

  it("recognises crawlers, link previews, prefetches and HEAD as non-views", () => {
    const r = (ua: string, extra: Record<string, string> = {}, method = "GET") => new Request("http://x/", { method, headers: { "user-agent": ua, ...extra } });
    expect(isNonViewRequest(r(BROWSER))).toBe(false);
    for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "WhatsApp/2.23", "Slackbot-LinkExpanding", "curl/8.0", "python-requests/2.31", ""]) expect(isNonViewRequest(r(ua))).toBe(true);
    expect(isNonViewRequest(r(BROWSER, { "sec-purpose": "prefetch" }))).toBe(true);
    expect(isNonViewRequest(r(BROWSER, {}, "HEAD"))).toBe(true);
  });

  it("visitor keys differ per guidebook/visitor and day, and ignore the user agent", () => {
    const a = new Request("http://x/", { headers: { "user-agent": BROWSER, "x-forwarded-for": "1.1.1.1" } });
    const b = new Request("http://x/", { headers: { "user-agent": BROWSER, "x-forwarded-for": "2.2.2.2" } });
    const t = Date.UTC(2026, 9, 22, 12, 0, 0);
    expect(visitorKey(a, "g1", t)).toBe(visitorKey(a, "g1", t + 60_000));
    expect(visitorKey(a, "g1", t)).not.toBe(visitorKey(b, "g1", t));
    expect(visitorKey(a, "g1", t)).not.toBe(visitorKey(a, "g2", t));
    expect(visitorKey(a, "g1", t)).toBe(visitorKey(a, "g1", t + 11 * 3600_000));
    expect(visitorKey(a, "g1", t)).not.toBe(visitorKey(a, "g1", t + 12 * 3600_000));
    const otherAgent = new Request("http://x/", { headers: { "user-agent": BROWSER + " x", "x-forwarded-for": "1.1.1.1" } });
    expect(visitorKey(otherAgent, "g1", t)).toBe(visitorKey(a, "g1", t));
    expect(visitorKey(a, "g1", t)).not.toContain("1.1.1.1");
  });

  it("recordView counts once per key and sums per month for the owner only", async () => {
    expect(await recordView(db.sql, gbId, OWNER, "k1")).toBe(true);
    expect(await recordView(db.sql, gbId, OWNER, "k1")).toBe(false);
    expect(await recordView(db.sql, gbId, OWNER, "k2")).toBe(true);
    expect(await views()).toBe(2);
    expect(await monthlyViews(db.sql, OTHER)).toBe(0);
    // views from earlier months do not count
    await db.sql`insert into guidebook_view_daily (guidebook_id, user_id, day, views) values (${gbId}, ${OWNER}, '2020-01-05', 99)`;
    expect(await views()).toBe(2);
  });
});

describe("free plan: 30 views per month across all guidebooks", () => {
  it("counts a view per visitor, serves the guidebook uncached, and dedupes reloads", async () => {
    const first = await slugRoute(sameGuest("198.51.100.1", `/g/${slug}`), slugCtx());
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    expect(await first.text()).toContain("Meter House");
    await slugRoute(sameGuest("198.51.100.1", `/g/${slug}`), slugCtx()); // same visitor reloads
    expect(await views()).toBe(1);
    await slugRoute(sameGuest("198.51.100.2", `/g/${slug}`), slugCtx());
    expect(await views()).toBe(2);
  });

  it("does not count bots, link previews or prefetches", async () => {
    for (const headers of [{ "user-agent": "Googlebot/2.1" }, { "user-agent": "WhatsApp/2.23" }, { "sec-purpose": "prefetch" }] as Record<string, string>[]) {
      const res = await slugRoute(guest(`/g/${slug}`, headers), slugCtx());
      expect(res.status).toBe(200);
    }
    expect(await views()).toBe(0);
  });

  it("blocks guests with a friendly page after 30 views, on both URLs, until next month", async () => {
    for (let i = 0; i < 30; i++) expect((await slugRoute(guest(`/g/${slug}`), slugCtx())).headers.get("x-guidewise-limit")).toBeNull();
    expect(await views()).toBe(30);

    const blocked = await slugRoute(guest(`/g/${slug}`), slugCtx());
    expect(blocked.headers.get("x-guidewise-limit")).toBe("views");
    expect(blocked.headers.get("cache-control")).toBe("private, no-store");
    expect(await blocked.text()).toContain("temporarily unavailable");
    expect(await views()).toBe(30);

    expect((await byIdRoute(guest(`/guidebook/${gbId}`), idCtx())).headers.get("x-guidewise-limit")).toBe("views");
    // bots are blocked too (the guidebook is unavailable to everyone), and still not counted
    expect((await slugRoute(guest(`/g/${slug}`, { "user-agent": "Googlebot" }), slugCtx())).headers.get("x-guidewise-limit")).toBe("views");

    // a visitor who already counted this half hour can keep browsing
    await db.sql`delete from guidebook_view_daily`;
    const ip = "198.51.100.77";
    await slugRoute(sameGuest(ip, `/g/${slug}`), slugCtx());
    await db.sql`update guidebook_view_daily set views = 30`;
    expect((await slugRoute(sameGuest(ip, `/g/${slug}`), slugCtx())).headers.get("x-guidewise-limit")).toBeNull();

    // next month everything resets
    await db.sql`update guidebook_view_daily set day = '2020-01-01'`;
    expect((await slugRoute(guest(`/g/${slug}`), slugCtx())).headers.get("x-guidewise-limit")).toBeNull();
  }, 60000);

  it("shares one allowance across the owner's guidebooks", async () => {
    const second = await createGuidebook(db.sql, OWNER, { property_name: "Second House" });
    for (let i = 0; i < 20; i++) await slugRoute(guest(`/g/${slug}`), slugCtx());
    for (let i = 0; i < 10; i++) await slugRoute(guest(`/g/${second.publicSlug}`), { params: Promise.resolve({ slug: second.publicSlug as string }) });
    expect((await slugRoute(guest(`/g/${slug}`), slugCtx())).headers.get("x-guidewise-limit")).toBe("views");
    const other = await slugRoute(guest(`/g/${second.publicSlug}`), { params: Promise.resolve({ slug: second.publicSlug as string }) });
    expect(other.headers.get("x-guidewise-limit")).toBe("views");
  }, 60000);

  it("another owner's allowance is unaffected", async () => {
    const theirs = await createGuidebook(db.sql, OTHER, { property_name: "Theirs" });
    for (let i = 0; i < 30; i++) await slugRoute(guest(`/g/${slug}`), slugCtx());
    const res = await slugRoute(guest(`/g/${theirs.publicSlug}`), { params: Promise.resolve({ slug: theirs.publicSlug as string }) });
    expect(res.headers.get("x-guidewise-limit")).toBeNull();
  }, 60000);

  it("serves normally if the counters fail", async () => {
    await db.sql`alter table view_dedupe rename to view_dedupe_x`;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await slugRoute(guest(`/g/${slug}`), slugCtx())).status).toBe(200);
    } finally {
      err.mockRestore();
      await db.sql`alter table view_dedupe_x rename to view_dedupe`;
    }
  });
});

describe("paid plans: unlimited views, CDN-cacheable, counted by a beacon", () => {
  for (const plan of ["starter", "power", "pro"]) {
    it(`${plan}: cacheable page with the beacon, never blocked`, async () => {
      await setPlan(db.sql, OWNER, plan);
      await db.sql`insert into guidebook_view_daily (guidebook_id, user_id, day, views) values (${gbId}, ${OWNER}, (now() at time zone 'utc')::date, 5000)`;
      const res = await slugRoute(guest(`/g/${slug}`), slugCtx());
      expect(res.headers.get("x-guidewise-limit")).toBeNull();
      expect(res.headers.get("cache-control")).toContain("s-maxage");
      const html = await res.text();
      expect(html).toContain(`navigator.sendBeacon("/api/view/"+encodeURIComponent("${slug}"))`);
      expect(html.indexOf("sendBeacon")).toBeLessThan(html.toLowerCase().lastIndexOf("</body>"));
      expect(await views()).toBe(5000); // the page request itself does not count
    });
  }

  it("the beacon records one view per visitor and ignores bots, free owners and unknown slugs", async () => {
    await setPlan(db.sql, OWNER, "power");
    const beacon = (ip: string, ua = BROWSER, s = slug) =>
      beaconRoute(new Request(`http://localhost/api/view/${s}`, { method: "POST", headers: { "user-agent": ua, "x-forwarded-for": ip } }), { params: Promise.resolve({ slug: s }) });
    expect((await beacon("192.0.2.1")).status).toBe(204);
    await beacon("192.0.2.1");
    expect(await views()).toBe(1);
    await beacon("192.0.2.2");
    expect(await views()).toBe(2);
    await beacon("192.0.2.3", "Googlebot/2.1");
    await beacon("192.0.2.4", BROWSER, "no-such-slug");
    expect(await views()).toBe(2);

    await setPlan(db.sql, OWNER, "free"); // free views are metered when the page is served, not here
    await beacon("192.0.2.9");
    expect(await views()).toBe(2);
  });

  it("the beacon is rate limited per IP", async () => {
    await setPlan(db.sql, OWNER, "power");
    for (let i = 0; i < 40; i++) {
      await beaconRoute(new Request("http://localhost/api/view/x", { method: "POST", headers: { "user-agent": BROWSER, "x-forwarded-for": "192.0.2.50" } }), { params: Promise.resolve({ slug }) });
    }
    expect(await views()).toBeLessThanOrEqual(1); // one visitor, one view, however often it fires
  });
});

describe("analytics API", () => {
  const call = (token = "owner") => analyticsRoute(new Request("http://localhost/api/analytics/views", { headers: { authorization: `Bearer ${token}` } }));

  it("requires auth", async () => {
    expect((await call("nope")).status).toBe(401);
  });

  it("free/starter: usage and per-guidebook month totals only", async () => {
    await recordView(db.sql, gbId, OWNER, "a");
    await recordView(db.sql, gbId, OWNER, "b");
    const free = await (await call()).json();
    expect(free).toMatchObject({ plan: "free", views_used: 2, views_limit: 30, analytics: false });
    expect(free.guidebooks[0]).toMatchObject({ id: gbId, views_month: 2 });
    expect(free.guidebooks[0].daily).toBeUndefined();
    await setPlan(db.sql, OWNER, "starter");
    expect(await (await call()).json()).toMatchObject({ plan: "starter", views_limit: null, analytics: false });
  });

  it("power/pro: daily series for the last 30 days, owner's guidebooks only", async () => {
    await setPlan(db.sql, OWNER, "power");
    await recordView(db.sql, gbId, OWNER, "a");
    await db.sql`insert into guidebook_view_daily (guidebook_id, user_id, day, views) values (${gbId}, ${OWNER}, (now() at time zone 'utc')::date - 3, 4), (${gbId}, ${OWNER}, (now() at time zone 'utc')::date - 40, 9)`;
    const theirs = await createGuidebook(db.sql, OTHER, { property_name: "Theirs" });
    await recordView(db.sql, theirs.guidebookId, OTHER, "t");
    const out = await (await call()).json();
    expect(out).toMatchObject({ plan: "power", analytics: true, views_limit: null });
    expect(out.guidebooks).toHaveLength(1);
    const days = out.guidebooks[0].daily as { day: string; views: number }[];
    expect(days.map((d) => d.views)).toEqual([4, 1]); // the 40-day-old row is outside the window
    expect(days[0].day < days[1].day).toBe(true);
  });
});

describe("AI recommendation quota", () => {
  const completion = { choices: [{ message: { content: JSON.stringify({ places_to_eat: [{ name: "A", address: "x" }] }) } }] };
  const post = (route: typeof aiRecs, body: unknown) =>
    route(new Request("http://localhost/api/x", { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify(body) }));
  const prev = { g: process.env.GOOGLE_API_KEY, o: process.env.OPENAI_API_KEY };
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = "k";
    process.env.OPENAI_API_KEY = "k";
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const u = String(input);
      if (u.includes("textsearch")) return new Response(JSON.stringify({ results: [{ place_id: "p1" }] }));
      if (u.includes("details")) return new Response(JSON.stringify({ result: { formatted_address: "addr" } }));
      return new Response(JSON.stringify({ routes: [] }));
    }) as unknown as typeof fetch;
  });
  const restore = () => {
    globalThis.fetch = realFetch;
    if (prev.g === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = prev.g;
    if (prev.o === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prev.o;
  };

  it("free gets 3 generations a month, then a 403 with an upgrade hint; failures are refunded", async () => {
    try {
      openaiCreate.mockResolvedValue(completion);
      for (let i = 0; i < 3; i++) expect((await post(aiRecs, { type: "food", location: "Austin" })).status).toBe(200);
      expect(await aiUsage(db.sql, OWNER)).toBe(3);
      const denied = await post(aiRecs, { type: "food", location: "Austin" });
      expect(denied.status).toBe(403);
      expect(await denied.json()).toMatchObject({ upgrade: true, quota: "ai" });
      expect((await post(aiFood, { location: "Austin" })).status).toBe(403);
      expect(openaiCreate).toHaveBeenCalledTimes(3);

      await db.sql`delete from ai_usage_monthly`;
      openaiCreate.mockResolvedValue({ choices: [{ message: { content: "{}" } }] }); // nothing usable
      await post(aiRecs, { type: "food", location: "Austin" });
      openaiCreate.mockRejectedValue(new Error("boom"));
      await post(aiRecs, { type: "food", location: "Austin" });
      expect(await aiUsage(db.sql, OWNER)).toBe(0); // both refunded
    } finally {
      restore();
    }
  });

  it("invalid requests do not use quota, and paid plans get larger allowances", async () => {
    try {
      expect((await post(aiRecs, { type: "food", location: "  " })).status).toBe(400);
      expect(await aiUsage(db.sql, OWNER)).toBe(0);
      await setPlan(db.sql, OWNER, "starter");
      await db.sql`insert into ai_usage_monthly (user_id, month, used) values (${OWNER}, ${monthStart()}::date, 29)`;
      await consumeAiQuota(db.sql, OWNER);
      await expect(consumeAiQuota(db.sql, OWNER)).rejects.toMatchObject({ status: 403 });
      await setPlan(db.sql, OWNER, "power");
      await expect(consumeAiQuota(db.sql, OWNER)).resolves.toBeUndefined();
    } finally {
      restore();
    }
  });
});
