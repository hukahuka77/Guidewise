import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER, OWNER, startTestDb, type TestDb } from "./helpers/testDb";

vi.mock("@/lib/server/auth", () => ({
  isAuthConfigured: () => true,
  getAuthedUser: async (request: Request) =>
    request.headers.get("authorization") === "Bearer owner" ? { id: "11111111-1111-4111-8111-aaaaaaaaaaaa", email: "o@example.com" } : null,
}));
vi.mock("@/lib/server/proxy", () => ({
  proxyToBackend: vi.fn(async (request: Request) => new Response(`PROXIED ${new URL(request.url).pathname}`)),
}));

const openaiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
  },
}));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "23.45.67.89", family: 4 }]) }));

import { lookup } from "node:dns/promises";
import { POST as aiActivities } from "../src/app/api/ai-activities/route";
import { POST as aiFood } from "../src/app/api/ai-food/route";
import { POST as aiRecs } from "../src/app/api/ai-recommendations/route";
import { POST as importRoute } from "../src/app/api/import-listing/route";
import { GET as photoRoute } from "../src/app/api/place-photo/route";
import { GET as enrichRoute } from "../src/app/api/places/enrich/route";
import { POST as searchRoute } from "../src/app/api/places/search/route";
import { setSqlForTests } from "../src/lib/server/db";
import { extractListingContext, hostAllowed, sanitizeExtractedFields, validateListingUrl } from "../src/lib/server/listingImport";
import { clampItems, rateLimited, resetRateLimitsForTests } from "../src/lib/server/rateLimit";
import { proxyToBackend } from "../src/lib/server/proxy";

let db: TestDb;
beforeAll(async () => {
  db = await startTestDb();
}, 60000);
afterAll(async () => {
  setSqlForTests(undefined);
  await db?.close();
});

const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
const savedEnv = { g: process.env.GOOGLE_API_KEY, o: process.env.OPENAI_API_KEY };

beforeEach(async () => {
  process.env.GOOGLE_API_KEY = "gkey";
  process.env.OPENAI_API_KEY = "okey";
  setSqlForTests(db.sql);
  await db.reset();
  resetRateLimitsForTests();
  openaiCreate.mockReset();
  vi.mocked(proxyToBackend).mockClear();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedEnv.g === undefined) delete process.env.GOOGLE_API_KEY;
  else process.env.GOOGLE_API_KEY = savedEnv.g;
  if (savedEnv.o === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedEnv.o;
});

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });
const post = (path: string, body: unknown, token = "owner") =>
  new Request(`https://x.test${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const get = (path: string, token?: string) =>
  new Request(`https://x.test${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

describe("rate limiting helpers", () => {
  it("allows `limit` hits per window then blocks, and the window slides", () => {
    for (let i = 0; i < 3; i++) expect(rateLimited("k", 3, 1000, 100 + i)).toBe(false);
    expect(rateLimited("k", 3, 1000, 200)).toBe(true);
    expect(rateLimited("k", 3, 1000, 1200)).toBe(false);
    expect(rateLimited("other", 3, 1000, 200)).toBe(false);
  });
  it("clamps item counts like Flask", () => {
    expect(clampItems(5)).toBe(5);
    expect(clampItems("7")).toBe(7);
    expect(clampItems(999)).toBe(10);
    expect(clampItems(0)).toBe(1);
    expect(clampItems(-4)).toBe(1);
    expect(clampItems("abc")).toBe(5);
    expect(clampItems(null)).toBe(5);
    expect(clampItems(3.9)).toBe(3);
  });
});

describe("places search / enrich", () => {
  it("proxies to Flask when Google is not configured", async () => {
    delete process.env.GOOGLE_API_KEY;
    const res = await searchRoute(post("/api/places/search", { query: "pizza" }));
    expect(await res.text()).toBe("PROXIED /api/places/search");
  });

  it("requires auth", async () => {
    expect((await searchRoute(post("/api/places/search", { query: "x" }, "nope"))).status).toBe(401);
    expect((await enrichRoute(get("/api/places/enrich?place_id=p"))).status).toBe(401);
  });

  it("validates input and normalizes at most 8 results", async () => {
    expect((await searchRoute(post("/api/places/search", { query: "  " }))).status).toBe(400);
    const results = Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, formatted_address: `A${i}`, place_id: `id${i}`, extra: 1 }));
    fetchMock.mockResolvedValueOnce(json({ results }));
    const res = await searchRoute(post("/api/places/search", { query: "pizza", near: "Austin" }));
    const body = await res.json();
    expect(body.items).toHaveLength(8);
    expect(body.items[0]).toEqual({ name: "P0", address: "A0", place_id: "id0" });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("query")).toBe("pizza");
    expect(url.searchParams.get("location")).toBe("Austin");
    expect(url.searchParams.get("key")).toBe("gkey");
  });

  it("returns 502 when Google fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 500 }));
    const res = await searchRoute(post("/api/places/search", { query: "pizza" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Failed to search places" });
  });

  it("rate limits at 60/min per user", async () => {
    fetchMock.mockImplementation(async () => json({ results: [] }));
    for (let i = 0; i < 60; i++) expect((await searchRoute(post("/api/places/search", { query: "a" }))).status).toBe(200);
    expect((await searchRoute(post("/api/places/search", { query: "a" }))).status).toBe(429);
  });

  it("enriches a place with description, photo reference and driving minutes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ result: { name: "Joe's", formatted_address: "1 Main St", website: "https://joes.test", rating: 4.5, types: ["italian_restaurant"], photos: [{ photo_reference: "REF" }] } }),
      )
      .mockResolvedValueOnce(json({ routes: [{ duration: "905s", distanceMeters: 5000 }] }));
    const res = await enrichRoute(get("/api/places/enrich?place_id=pid&origin=Home", "owner"));
    expect(await res.json()).toEqual({
      name: "Joe's",
      address: "1 Main St",
      description: "Rating 4.5 • Italian Restaurant • https://joes.test",
      place_id: "pid",
      image_url: "REF",
      driving_minutes: 15,
    });
  });

  it("falls back to the Distance Matrix API when Routes fails", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ result: { name: "N", formatted_address: "A" } }))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }))
      .mockResolvedValueOnce(json({ status: "OK", rows: [{ elements: [{ status: "OK", duration: { value: 600 }, distance: { value: 1 } }] }] }));
    const res = await enrichRoute(get("/api/places/enrich?place_id=pid&origin=Home", "owner"));
    expect((await res.json()).driving_minutes).toBe(10);
  });

  it("requires place_id", async () => {
    expect((await enrichRoute(get("/api/places/enrich", "owner"))).status).toBe(400);
  });
});

describe("place photo", () => {
  const img = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });

  it("validates params", async () => {
    expect((await photoRoute(get("/api/place-photo"))).status).toBe(400);
    expect((await photoRoute(get("/api/place-photo?photo_reference=r&maxwidth=abc"))).status).toBe(400);
  });

  it("serves a freshly resolved reference with long-lived cache headers and no auth", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ result: { photos: [{ photo_reference: "FRESH" }] } }))
      .mockResolvedValueOnce(img());
    const res = await photoRoute(get("/api/place-photo?place_id=pid&photo_reference=STALE&maxwidth=5000"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("s-maxage=604800");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
    const photoUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(photoUrl.searchParams.get("photo_reference")).toBe("FRESH");
    expect(photoUrl.searchParams.get("maxwidth")).toBe("1600");
  });

  it("falls back to the stored reference when the fresh one fails", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ result: { photos: [{ photo_reference: "FRESH" }] } }))
      .mockResolvedValueOnce(new Response("x", { status: 403 }))
      .mockResolvedValueOnce(img());
    const res = await photoRoute(get("/api/place-photo?place_id=pid&photo_reference=STORED"));
    expect(res.status).toBe(200);
    expect(new URL(fetchMock.mock.calls[2][0] as string).searchParams.get("photo_reference")).toBe("STORED");
  });

  it("recovers legacy photos by searching the query", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("x", { status: 400 })) // expired stored reference
      .mockResolvedValueOnce(json({ results: [{ place_id: "found" }] }))
      .mockResolvedValueOnce(json({ result: { photos: [{ photo_reference: "RECOVERED" }] } }))
      .mockResolvedValueOnce(img());
    const res = await photoRoute(get("/api/place-photo?photo_reference=OLD&query=Joe%27s%20Pizza"));
    expect(res.status).toBe(200);
  });

  it("rejects non-image upstream responses with 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }));
    expect((await photoRoute(get("/api/place-photo?photo_reference=R"))).status).toBe(404);
  });

  it("proxies to Flask when Google is not configured", async () => {
    delete process.env.GOOGLE_API_KEY;
    expect(await (await photoRoute(get("/api/place-photo?photo_reference=R"))).text()).toBe("PROXIED /api/place-photo");
  });
});

describe("AI recommendations", () => {
  const completion = (content: unknown) => ({ choices: [{ message: { content: JSON.stringify(content) } }] });
  const placeFlow = (name: string, id: string) => {
    fetchMock.mockImplementation(async (input: string) => {
      const u = String(input);
      if (u.includes("textsearch")) return json({ results: [{ place_id: id, formatted_address: "search addr" }] });
      if (u.includes("details")) return json({ result: { formatted_address: `${name} real addr`, photos: [{ photo_reference: `ref-${id}` }] } });
      if (u.includes("routes.googleapis")) return json({ routes: [{ duration: "1200s" }] });
      return new Response("?", { status: 404 });
    });
  };

  it("proxies when OpenAI or Google is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    expect(await (await aiRecs(post("/api/ai-recommendations", { type: "food", location: "x" }))).text()).toBe("PROXIED /api/ai-recommendations");
  });

  it("validates input", async () => {
    expect((await aiRecs(post("/api/ai-recommendations", { location: "x" }))).status).toBe(400);
    expect((await aiRecs(post("/api/ai-recommendations", { type: "food", location: "  " }))).status).toBe(400);
    const res = await aiRecs(post("/api/ai-recommendations", { type: "bogus", location: "Austin" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Unknown recommendation type");
    expect((await aiRecs(post("/api/ai-recommendations", { type: "food", location: "x" }, "bad"))).status).toBe(401);
  });

  it("enriches items, skips ones without name/address and caps the requested count", async () => {
    placeFlow("Joe", "p1");
    openaiCreate.mockResolvedValueOnce(
      completion({ places_to_eat: [{ name: "Joe", address: "1 St", description: "Great" }, { name: "NoAddr" }, { address: "x" }] }),
    );
    const res = await aiRecs(post("/api/ai-recommendations", { type: "food", location: "Austin, TX", num_items: 500 }));
    expect(await res.json()).toEqual([
      { name: "Joe", address: "Joe real addr", description: "Great", place_id: "p1", photo_reference: "ref-p1", driving_minutes: 20 },
    ]);
    const prompt = openaiCreate.mock.calls[0][0].messages[1].content as string;
    expect(prompt).toContain("exactly 10 items");
    expect(openaiCreate.mock.calls[0][0].model).toBe("gpt-4-1106-preview");
    expect(openaiCreate.mock.calls[0][0].response_format).toEqual({ type: "json_object" });
  });

  it("accepts alternate response keys and a bare list", async () => {
    placeFlow("A", "p2");
    openaiCreate.mockResolvedValueOnce(completion({ bars: [{ name: "A", address: "x", description: "d" }] }));
    expect((await (await aiRecs(post("/api/ai-recommendations", { type: "nightlife", address: "Austin" }))).json())).toHaveLength(1);
    openaiCreate.mockResolvedValueOnce(completion([{ name: "A", address: "x" }]));
    expect((await (await aiRecs(post("/api/ai-recommendations", { type: "activities", location: "Austin" }))).json())[0].description).toBe("");
  });

  it("returns [] (like Flask) when OpenAI fails or returns nothing", async () => {
    openaiCreate.mockRejectedValueOnce(new Error("boom"));
    expect(await (await aiRecs(post("/api/ai-recommendations", { type: "food", location: "A" }))).json()).toEqual([]);
    openaiCreate.mockResolvedValueOnce(completion({ other: [] }));
    expect(await (await aiRecs(post("/api/ai-recommendations", { type: "food", location: "A" }))).json()).toEqual([]);
  });

  it("skips an item whose Places lookup fails without failing the rest", async () => {
    let call = 0;
    fetchMock.mockImplementation(async (input: string) => {
      const u = String(input);
      if (u.includes("textsearch")) {
        if (u.includes("Bad")) throw new Error("network");
        return json({ results: [{ place_id: "ok" }] });
      }
      if (u.includes("details")) return json({ result: { formatted_address: "addr" } });
      call++;
      return json({ routes: [] });
    });
    openaiCreate.mockResolvedValueOnce(completion({ activities: [{ name: "Bad", address: "x" }, { name: "Good", address: "y" }] }));
    const body = await (await aiRecs(post("/api/ai-recommendations", { type: "activities", location: "A" }))).json();
    expect(body.map((b: { name: string }) => b.name)).toEqual(["Good"]);
    expect(call).toBeGreaterThan(0);
  });

  it("legacy endpoints keep their response shapes", async () => {
    placeFlow("A", "p3");
    openaiCreate.mockResolvedValueOnce(completion({ places_to_eat: [{ name: "A", address: "x" }] }));
    expect(Array.isArray(await (await aiFood(post("/api/ai-food", { location: "A" }))).json())).toBe(true);
    openaiCreate.mockResolvedValueOnce(completion({ activities: [{ name: "A", address: "x" }] }));
    expect((await (await aiActivities(post("/api/ai-activities", { location: "A" }))).json()).activities).toHaveLength(1);
    openaiCreate.mockRejectedValueOnce(new Error("x"));
    expect(await (await aiFood(post("/api/ai-food", { location: "A" }))).json()).toEqual({ error: "Could not get recommendations" });
    expect((await aiFood(post("/api/ai-food", {}))).status).toBe(400);
  });

  it("rate limits at 10/min per user", async () => {
    openaiCreate.mockResolvedValue(completion({ places_to_eat: [] }));
    for (let i = 0; i < 10; i++) expect((await aiRecs(post("/api/ai-recommendations", { type: "food", location: "A" }))).status).toBe(200);
    expect((await aiRecs(post("/api/ai-recommendations", { type: "food", location: "A" }))).status).toBe(429);
  });
});

describe("listing import: URL safety", () => {
  it("only allows Airbnb/VRBO hosts", () => {
    for (const ok of ["airbnb.com", "www.airbnb.co.uk", "abnb.me", "www.vrbo.com", "x.homeaway.com"]) expect(hostAllowed(ok)).toBe(true);
    for (const bad of ["airbnb.xyz", "evilairbnb.com", "airbnb.com.evil.test", "localhost", "", "vrbo.com.evil.io"]) expect(hostAllowed(bad)).toBe(false);
  });
  it("normalizes and rejects", () => {
    expect(validateListingUrl("airbnb.com/rooms/1?x=1#frag")).toBe("https://airbnb.com/rooms/1?x=1");
    expect(validateListingUrl("http://www.airbnb.com:443/rooms/1")).toBe("https://www.airbnb.com/rooms/1");
    expect(() => validateListingUrl("https://www.airbnb.com:8080/x")).toThrow();
    expect(() => validateListingUrl("ftp://airbnb.com/x")).toThrow();
    expect(() => validateListingUrl("")).toThrow();
    expect(() => validateListingUrl("https://example.com/rooms/1")).toThrow();
  });
});

describe("listing import: page reduction", () => {
  it("reads meta, JSON-LD and embedded JSON state and finds a cover image", () => {
    const html = `<html><head><title>Cozy Cabin &amp; Spa</title>
      <meta property="og:image" content="https://a0.muscache.com/im/pictures/x.jpg?im_w=720&amp;a=1">
      <meta name="description" content="A lovely place">
      <script type="application/ld+json">{"@type":"VacationRental","name":"Cozy Cabin"}</script>
      <script id="data-deferred-state-0" type="application/json">{"niobeMinimalClientData":[["k",{"data":{"houseRules":"No parties","checkInTime":"3 PM","amenities":["Wifi"],"blob":"${"A".repeat(60)}"}}]]}</script>
      <script>var x = "ignore me";</script></head><body><h1>Hello</h1><style>.a{}</style></body></html>`;
    const { context, coverImage } = extractListingContext(html);
    expect(coverImage).toBe("https://a0.muscache.com/im/pictures/x.jpg?im_w=720&a=1");
    expect(context).toContain("TITLE: Cozy Cabin & Spa");
    expect(context).toContain("META description: A lovely place");
    expect(context).toContain("JSON-LD:");
    expect(context).toContain("houseRules: No parties");
    expect(context).toContain("checkInTime: 3 PM");
    expect(context).not.toContain("ignore me");
    expect(context).not.toContain("AAAAAAAAAA");
  });
  it("falls back to an embedded image when there is no og:image", () => {
    const html = `<script type="application/json">{"pic":"https://a0.muscache.com/im/pictures/y.jpg"}</script>`;
    expect(extractListingContext(html).coverImage).toBe("https://a0.muscache.com/im/pictures/y.jpg");
  });
  it("ignores non-https images", () => {
    expect(extractListingContext(`<meta property="og:image" content="javascript:alert(1)">`).coverImage).toBeNull();
  });
  it("sanitizes model output", () => {
    const f = sanitizeExtractedFields({
      property_name: "  A\n  B ",
      check_in_time: "3:00",
      check_out_time: "25:00",
      house_rules: [{ name: "n", description: "d" }, "str", 5, {}],
      host_name: 7,
    });
    expect(f.property_name).toBe("A B");
    expect(f.check_in_time).toBe("03:00");
    expect(f.check_out_time).toBeNull();
    expect(f.house_rules).toEqual([{ name: "n", description: "d" }, { name: "str", description: "" }]);
    expect(f.host_name).toBe("");
  });
});

describe("listing import route", () => {
  const page = `<html><head><title>Cabin</title><meta property="og:image" content="https://a0.muscache.com/c.jpg"></head><body>${"Lovely cabin near the lake. ".repeat(30)}</body></html>`;
  const extraction = {
    property_name: "Lake Cabin",
    host_name: "Sam",
    welcome_message: "Welcome!",
    address_city_state: "Austin, TX",
    check_in_time: "16:00",
    check_out_time: "10:00",
    parking_info: "Driveway",
    house_rules: [{ name: "Quiet hours", description: "10pm" }],
    house_manual: [],
    checkout_info: [],
  };

  it("requires auth and a valid url", async () => {
    expect((await importRoute(post("/api/import-listing", { url: "https://airbnb.com/rooms/1" }, "bad"))).status).toBe(401);
    const res = await importRoute(post("/api/import-listing", { url: "https://example.com/x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_url");
  });

  it("creates a draft guidebook with a cover image and reports imported/missing fields", async () => {
    fetchMock.mockResolvedValueOnce(new Response(page, { status: 200 }));
    openaiCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(extraction) } }] });
    const res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.imported).toEqual(expect.arrayContaining(["property name", "host name", "house rules", "cover image"]));
    expect(body.missing).toEqual(expect.arrayContaining(["house manual", "checkout instructions"]));
    const [gb] = await db.sql`select * from guidebook where id = ${body.guidebook_id}`;
    expect(gb.active).toBe(false);
    expect(gb.public_slug).toBeNull();
    expect(gb.user_id).toBe(OWNER);
    expect(gb.cover_image_url).toBe("https://a0.muscache.com/c.jpg");
    expect(gb.check_in_time).toBe("16:00");
    expect(gb.rules_json).toEqual([{ name: "Quiet hours", description: "10pm" }]);
    expect(gb.template_key).toBe("template_original");
    const [prop] = await db.sql`select * from property where id = ${gb.property_id}`;
    expect(prop.name).toBe("Lake Cabin");
    expect(prop.address_city_state).toBe("Austin, TX");
    const hosts = await db.sql`select * from host where user_id = ${OWNER}`;
    expect(hosts.map((h) => h.name)).toEqual(["Sam"]);
    expect(OTHER).not.toBe(OWNER);
  });

  it("reuses an existing host and property of the same name", async () => {
    for (let i = 0; i < 2; i++) {
      fetchMock.mockResolvedValueOnce(new Response(page, { status: 200 }));
      openaiCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(extraction) } }] });
      expect((await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }))).status).toBe(201);
    }
    expect((await db.sql`select 1 from host where user_id = ${OWNER}`).length).toBe(1);
    expect((await db.sql`select 1 from property where user_id = ${OWNER}`).length).toBe(1);
    expect((await db.sql`select 1 from guidebook where user_id = ${OWNER}`).length).toBe(2);
  });

  it("maps fetch problems to friendly errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));
    let res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    expect([res.status, (await res.json()).code]).toEqual([502, "blocked"]);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    expect([res.status, (await res.json()).code]).toEqual([422, "not_found"]);
    fetchMock.mockResolvedValueOnce(new Response("<html>login</html>", { status: 200 }));
    res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    expect((await res.json()).code).toBe("no_content");
  });

  it("refuses redirects off the allow-list and hosts resolving to private addresses", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 302, headers: { location: "http://169.254.169.254/latest" } }));
    let res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    expect((await res.json()).code).toBe("invalid_url");
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }] as never);
    res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows allowed redirects (short links)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 302, headers: { location: "https://www.airbnb.com/rooms/9" } }))
      .mockResolvedValueOnce(new Response(page, { status: 200 }));
    openaiCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(extraction) } }] });
    expect((await importRoute(post("/api/import-listing", { url: "https://abnb.me/abc" }))).status).toBe(201);
  });

  it("returns a friendly error when the model fails and rate limits at 5/min", async () => {
    fetchMock.mockImplementation(async () => new Response(page, { status: 200 }));
    openaiCreate.mockRejectedValue(new Error("down"));
    let res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    expect([res.status, (await res.json()).code]).toEqual([502, "extract_failed"]);
    for (let i = 0; i < 4; i++) await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }));
    expect(res.status).toBe(429);
  });

  it("proxies to Flask without an OpenAI key", async () => {
    delete process.env.OPENAI_API_KEY;
    expect(await (await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1" }))).text()).toBe("PROXIED /api/import-listing");
  });
});
