import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER, OWNER, setPlan, startTestDb, type TestDb } from "./helpers/testDb";

vi.mock("@/lib/server/auth", () => ({
  isAuthConfigured: () => true,
  getAuthedUser: async (request: Request) =>
    request.headers.get("authorization") === "Bearer owner" ? { id: "11111111-1111-4111-8111-aaaaaaaaaaaa", email: "o@example.com" } : null,
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
import { canonicalListingUrl, extractListingContext, hostAllowed, sanitizeExtractedFields, validateListingUrl } from "../src/lib/server/listingImport";
import { clampItems, rateLimited, resetRateLimitsForTests } from "../src/lib/server/rateLimit";
import { aiUsage, monthStart } from "../src/lib/server/usage";

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
  it("clamps item counts", () => {
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
  it("answers 503 when Google is not configured", async () => {
    delete process.env.GOOGLE_API_KEY;
    const res = await searchRoute(post("/api/places/search", { query: "pizza" }));
    expect(res.status).toBe(503);
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
    // Google's location parameter only takes coordinates, so an address goes into the query
    expect(url.searchParams.get("query")).toBe("pizza near Austin");
    expect(url.searchParams.get("location")).toBeNull();
    expect(url.searchParams.get("key")).toBe("gkey");
  });

  it("passes coordinates as the search location", async () => {
    fetchMock.mockResolvedValueOnce(json({ results: [] }));
    await searchRoute(post("/api/places/search", { query: "pizza", near: "30.27, -97.74" }));
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("query")).toBe("pizza");
    expect(url.searchParams.get("location")).toBe("30.27,-97.74");
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

  it("serves the stored reference without a Details lookup, with long-lived cache headers and no auth", async () => {
    fetchMock.mockResolvedValueOnce(img());
    const res = await photoRoute(get("/api/place-photo?place_id=pid&photo_reference=STORED&maxwidth=5000"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("s-maxage=604800");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const photoUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(photoUrl.searchParams.get("photo_reference")).toBe("STORED");
    expect(photoUrl.searchParams.get("maxwidth")).toBe("1600");
  });

  it("refreshes the reference from the place id only when the stored one has expired", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("x", { status: 403 })) // expired stored reference
      .mockResolvedValueOnce(json({ result: { photos: [{ photo_reference: "FRESH" }] } }))
      .mockResolvedValueOnce(img());
    const res = await photoRoute(get("/api/place-photo?place_id=pid&photo_reference=STALE"));
    expect(res.status).toBe(200);
    expect(new URL(fetchMock.mock.calls[2][0] as string).searchParams.get("photo_reference")).toBe("FRESH");
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

  it("answers 503 when Google is not configured", async () => {
    delete process.env.GOOGLE_API_KEY;
    expect((await photoRoute(get("/api/place-photo?photo_reference=R"))).status).toBe(503);
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

  it("answers 503 when OpenAI or Google is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    expect((await aiRecs(post("/api/ai-recommendations", { type: "food", location: "x" }))).status).toBe(503);
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
    expect(openaiCreate.mock.calls[0][0].model).toBe("gpt-6-luna");
    expect(openaiCreate.mock.calls[0][0].reasoning_effort).toBe("none");
    expect(openaiCreate.mock.calls[0][0].response_format).toEqual({ type: "json_object" });
  });

  it("accepts alternate response keys and a bare list", async () => {
    placeFlow("A", "p2");
    openaiCreate.mockResolvedValueOnce(completion({ bars: [{ name: "A", address: "x", description: "d" }] }));
    expect((await (await aiRecs(post("/api/ai-recommendations", { type: "nightlife", address: "Austin" }))).json())).toHaveLength(1);
    openaiCreate.mockResolvedValueOnce(completion([{ name: "A", address: "x" }]));
    expect((await (await aiRecs(post("/api/ai-recommendations", { type: "activities", location: "Austin" }))).json())[0].description).toBe("");
  });

  it("returns [] when OpenAI fails or returns nothing", async () => {
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
    expect(coverImage).toBe("https://a0.muscache.com/im/pictures/x.jpg?im_w=1200&a=1");
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
    expect(extractListingContext(html).coverImage).toBe("https://a0.muscache.com/im/pictures/y.jpg?im_w=1200");
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
  const COVER = "https://a0.muscache.com/im/pictures/miso/Hosting-1/original/c.jpg";
  const page = `<html><head><title>Cabin</title><meta property="og:image" content="${COVER}"></head><body>${"Lovely cabin near the lake. ".repeat(30)}</body></html>`;
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
  const modelReturns = (obj: unknown) => openaiCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(obj) } }] });
  const png = () => new Response(new Uint8Array([1]), { status: 206, headers: { "content-type": "image/png" } });

  /** Routes fetches by URL: listing pages vs photo CDN. */
  const serve = (handlers: { page?: (url: string) => Response; image?: (url: string) => Response }) =>
    fetchMock.mockImplementation(async (input: string) => {
      const url = String(input);
      if (/muscache\.com/.test(url)) return (handlers.image ?? png)(url);
      return (handlers.page ?? (() => new Response(page, { status: 200 })))(url);
    });
  const run = (url = "https://www.airbnb.com/rooms/1") => importRoute(post("/api/import-listing", { url }));
  const pageCalls = () => fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => !/muscache\.com/.test(u));

  it("requires auth and a valid url", async () => {
    expect((await importRoute(post("/api/import-listing", { url: "https://airbnb.com/rooms/1" }, "bad"))).status).toBe(401);
    const res = await run("https://example.com/x");
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_url");
  });

  it("creates a live guidebook with a verified, enlarged cover image and reports imported/missing fields", async () => {
    serve({});
    modelReturns(extraction);
    const res = await run();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.imported).toEqual(expect.arrayContaining(["property name", "host name", "house rules", "cover image"]));
    expect(body.missing).toEqual(expect.arrayContaining(["house manual", "checkout instructions"]));
    const [gb] = await db.sql`select * from guidebook where id = ${body.guidebook_id}`;
    expect(gb.public_slug).toMatch(/^lake-cabin-[0-9a-f]{6}$/);
    expect(gb.user_id).toBe(OWNER);
    expect(gb.cover_image_url).toBe(`${COVER}?im_w=1200`);
    expect(gb.check_in_time).toBe("16:00");
    expect(gb.rules_json).toEqual([{ name: "Quiet hours", description: "10pm" }]);
    expect(gb.template_key).toBe("template_signature");
    const [prop] = await db.sql`select * from property where id = ${gb.property_id}`;
    expect(prop.name).toBe("Lake Cabin");
    expect(prop.address_city_state).toBe("Austin, TX");
    expect((await db.sql`select * from host where user_id = ${OWNER}`).map((h) => h.name)).toEqual(["Sam"]);
    expect(OTHER).not.toBe(OWNER);
  });

  it("fetches the listing without search parameters, falling back to the original link", async () => {
    serve({});
    modelReturns(extraction);
    await run("https://www.airbnb.com/rooms/1101414006622380859?adults=2&check_in=2026-11-07&photo_id=1850473928");
    expect(pageCalls()[0]).toBe("https://www.airbnb.com/rooms/1101414006622380859");

    fetchMock.mockReset();
    serve({ page: (url) => (url.includes("?") ? new Response(page, { status: 200 }) : new Response("", { status: 403 })) });
    modelReturns(extraction);
    const res = await run("https://www.airbnb.com/rooms/7?adults=2");
    expect(res.status).toBe(201);
    expect(pageCalls()).toEqual(["https://www.airbnb.com/rooms/7", "https://www.airbnb.com/rooms/7?adults=2"]);
  });

  it("falls through unreachable candidates and still creates the guidebook when none work", async () => {
    const html = `<head><meta property="og:image" content="https://a0.muscache.com/im/pictures/miso/Hosting-1/dead.jpg"></head>${"Lovely cabin. ".repeat(60)}
      <script>{"photo":"https:\\u002F\\u002Fa0.muscache.com\\u002Fim\\u002Fpictures\\u002Fmiso\\u002FHosting-1\\u002Fgood.jpg"}</script>`;
    serve({ page: () => new Response(html, { status: 200 }), image: (url) => (url.includes("good") ? png() : new Response("", { status: 403 })) });
    modelReturns(extraction);
    let res = await run();
    let body = await res.json();
    const [gb] = await db.sql`select cover_image_url from guidebook where id = ${body.guidebook_id}`;
    expect(gb.cover_image_url).toContain("good.jpg");

    serve({ page: () => new Response(html, { status: 200 }), image: () => new Response("nope", { status: 404 }) });
    modelReturns(extraction);
    res = await run();
    body = await res.json();
    expect(res.status).toBe(201);
    expect(body.missing).toContain("cover image");
    const [gb2] = await db.sql`select cover_image_url from guidebook where id = ${body.guidebook_id}`;
    expect(gb2.cover_image_url).toBeNull();
  });

  it("imports just the cover photo when the page has photos but no readable text", async () => {
    serve({ page: () => new Response(`<meta property="og:image" content="${COVER}">`, { status: 200 }) });
    const res = await run();
    expect(res.status).toBe(201);
    expect(openaiCreate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.imported).toEqual(["cover image"]);
  });

  describe("pre-filling everything it can", () => {
    const rich = {
      ...extraction,
      host_bio: "Sam loves hosting.",
      address_zip: "78701",
      address_street: "",
      access_info: "Self check-in with a keypad",
      wifi_network: "LakeCabin-5G",
      house_manual: [{ name: "Kitchen", description: "Fully equipped" }],
    };
    const place = (name: string) => ({ name, address: `${name} St`, description: `About ${name}` });
    const wire = (opts: { extraction?: unknown } = {}) => {
      fetchMock.mockImplementation(async (input: string) => {
        const u = String(input);
        if (/muscache\.com/.test(u)) return png();
        if (u.includes("textsearch")) return json({ results: [{ place_id: `pid-${new URL(u).searchParams.get("query")?.split(",")[0]}` }] });
        if (u.includes("details")) return json({ result: { formatted_address: "1 Real Addr, Austin, TX", photos: [{ photo_reference: "PHOTOREF" }] } });
        if (u.includes("routes.googleapis")) return json({ routes: [{ duration: "600s" }] });
        return new Response(page, { status: 200 });
      });
      openaiCreate.mockImplementation(async (args: { messages: { content: string }[] }) => {
        const prompt = args.messages.map((m) => m.content).join(" ");
        if (prompt.includes("extract vacation rental")) return { choices: [{ message: { content: JSON.stringify(opts.extraction ?? rich) } }] };
        if (prompt.includes("restaurants")) return { choices: [{ message: { content: JSON.stringify({ places_to_eat: [place("Taco Hut"), place("Pizza Barn")] }) } }] };
        return { choices: [{ message: { content: JSON.stringify({ activities: [place("Lake Trail"), place("Art Museum")] }) } }] };
      });
    };

    it("stores host bio, address, access info, Wi-Fi, things to do and places to eat, with no Neighborhood section", async () => {
      wire();
      const res = await run();
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.recommendations).toEqual({ things_to_do: 2, places_to_eat: 2 });
      expect(body.imported).toEqual(
        expect.arrayContaining(["host bio", "access instructions", "Wi-Fi network", "things to do", "places to eat", "cover image"]),
      );
      const [gb] = await db.sql`select * from guidebook where id = ${body.guidebook_id}`;
      expect(gb.access_info).toBe("Self check-in with a keypad");
      expect(gb.wifi_json).toEqual({ network: "LakeCabin-5G" });
      expect(gb.house_manual).toEqual([{ name: "Kitchen", description: "Fully equipped" }]);
      expect(gb.included_tabs).toEqual(["welcome", "checkin", "property", "food", "activities", "rules", "checkout"]);
      expect(gb.custom_sections).toEqual({});
      expect(gb.custom_tabs_meta).toBeNull();
      expect(gb.things_to_do.map((i: { name: string }) => i.name)).toEqual(["Lake Trail", "Art Museum"]);
      expect(gb.things_to_do[0]).toMatchObject({ address: "1 Real Addr, Austin, TX", image_url: "PHOTOREF", driving_minutes: 10 });
      expect(gb.things_to_do[0].place_id).toMatch(/^pid-/);
      expect(gb.places_to_eat.map((i: { name: string }) => i.name)).toEqual(["Taco Hut", "Pizza Barn"]);
      const [host] = await db.sql`select bio from host where id = ${gb.host_id}`;
      expect(host.bio).toBe("Sam loves hosting.");
      const [prop] = await db.sql`select address_zip, address_city_state from property where id = ${gb.property_id}`;
      expect(prop).toEqual({ address_zip: "78701", address_city_state: "Austin, TX" });
      expect(await aiUsage(db.sql, OWNER)).toBe(1); // one allowance covers both lists
    });

    it("uses the city for the searches and asks for restaurants and activities", async () => {
      wire();
      await run();
      const prompts = openaiCreate.mock.calls.map((c) => (c[0] as { messages: { content: string }[] }).messages[1].content);
      expect(prompts.some((p) => p.includes("Austin, TX") && p.includes("restaurants"))).toBe(true);
      expect(prompts.some((p) => p.includes("Austin, TX") && p.includes("activities"))).toBe(true);
    });

    it("still imports when the free AI allowance is used up, and says so", async () => {
      wire();
      await db.sql`insert into ai_usage_monthly (user_id, month, used) values (${OWNER}, ${monthStart()}::date, 3)`;
      const body = await (await run()).json();
      expect(body.recommendations).toEqual({ things_to_do: 0, places_to_eat: 0, skipped: "quota" });
      expect(body.missing).toEqual(expect.arrayContaining(["things to do", "places to eat"]));
      expect(body.imported).toContain("property name");
      const [gb] = await db.sql`select things_to_do, places_to_eat from guidebook where id = ${body.guidebook_id}`;
      expect(gb.things_to_do).toEqual([]);
    });

    it("skips recommendations without a city or without Google configured, and refunds when they come back empty", async () => {
      wire({ extraction: { ...rich, address_city_state: "" } });
      expect((await (await run()).json()).recommendations.skipped).toBe("no_location");
      wire();
      delete process.env.GOOGLE_API_KEY;
      expect((await (await run()).json()).recommendations.skipped).toBe("not_configured");
      process.env.GOOGLE_API_KEY = "gkey";
      openaiCreate.mockImplementation(async (args: { messages: { content: string }[] }) =>
        args.messages.map((m) => m.content).join(" ").includes("extract vacation rental")
          ? { choices: [{ message: { content: JSON.stringify(rich) } }] }
          : { choices: [{ message: { content: "{}" } }] },
      );
      await db.sql`delete from ai_usage_monthly`;
      expect((await (await run()).json()).recommendations.skipped).toBe("failed");
      expect(await aiUsage(db.sql, OWNER)).toBe(0);
    });

    it("stops before fetching anything when the plan's guidebook cap is reached", async () => {
      wire();
      await setPlan(db.sql, OWNER, "starter");
      const [{ id: pid }] = await db.sql`insert into property (name, user_id) values ('P', ${OWNER}) returning id`;
      for (let i = 0; i < 5; i++) await db.sql`insert into guidebook (id, property_id, user_id, template_key) values (${`cap${i}`}, ${pid}, ${OWNER}, 'template_original')`;
      const res = await run();
      expect(res.status).toBe(403);
      expect((await res.json()).quota).toBe("guidebooks");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(openaiCreate).not.toHaveBeenCalled();
    });
  });

  it("reuses an existing host and property of the same name", async () => {
    serve({});
    for (let i = 0; i < 2; i++) {
      modelReturns(extraction);
      expect((await run()).status).toBe(201);
    }
    expect((await db.sql`select 1 from host where user_id = ${OWNER}`).length).toBe(1);
    expect((await db.sql`select 1 from property where user_id = ${OWNER}`).length).toBe(1);
    expect((await db.sql`select 1 from guidebook where user_id = ${OWNER}`).length).toBe(2);
  });

  it("maps fetch problems to friendly errors", async () => {
    serve({ page: () => new Response("", { status: 403 }) });
    let res = await run();
    expect([res.status, (await res.json()).code]).toEqual([502, "blocked"]);
    serve({ page: () => new Response("", { status: 404 }) });
    res = await run();
    expect([res.status, (await res.json()).code]).toEqual([422, "not_found"]);
    serve({ page: () => new Response("<html>login</html>", { status: 200 }) });
    res = await run();
    expect((await res.json()).code).toBe("no_content");
  });

  it("refuses redirects off the allow-list and hosts resolving to private addresses", async () => {
    serve({ page: () => new Response("", { status: 302, headers: { location: "http://169.254.169.254/latest" } }) });
    let res = await run();
    expect((await res.json()).code).toBe("invalid_url");
    fetchMock.mockClear();
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }] as never);
    res = await run();
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows allowed redirects (short links)", async () => {
    serve({
      page: (url) =>
        url.includes("abnb.me") ? new Response("", { status: 302, headers: { location: "https://www.airbnb.com/rooms/9" } }) : new Response(page, { status: 200 }),
    });
    modelReturns(extraction);
    expect((await run("https://abnb.me/abc")).status).toBe(201);
  });

  it("returns a friendly error when the model fails and rate limits at 5/min", async () => {
    serve({});
    openaiCreate.mockRejectedValue(new Error("down"));
    let res = await run();
    expect([res.status, (await res.json()).code]).toEqual([502, "extract_failed"]);
    for (let i = 0; i < 4; i++) await run();
    res = await run();
    expect(res.status).toBe(429);
  });

  it("answers 503 without an OpenAI key", async () => {
    delete process.env.OPENAI_API_KEY;
    expect((await run()).status).toBe(503);
  });
});

describe("listing import: cover photo discovery", () => {
  it("collects candidates from meta, JSON-LD objects, escaped script text and embedded JSON, best first", () => {
    const html = `<head>
      <meta property="og:image" content="https://a0.muscache.com/im/pictures/miso/Hosting-9/og.jpg?im_w=720&amp;x=1">
      <script type="application/ld+json">{"image":[{"url":"https://a0.muscache.com/im/pictures/ld.jpg"}]}</script>
      <script id="data-deferred-state-0" type="application/json">{"a":{"pic":"https://a0.muscache.com/im/pictures/miso/Hosting-9/state.jpg","host":"https://a0.muscache.com/im/pictures/user/User-1/avatar.jpg"}}</script>
      <script>var s="https:\\u002F\\u002Fa0.muscache.com\\u002Fim\\u002Fpictures\\u002Fmiso\\u002FHosting-9\\u002Fescaped.jpg";</script>
      <img src="https://www.airbnb.com/static/logo.svg"></head>`;
    const { coverCandidates } = extractListingContext(html);
    expect(coverCandidates[0]).toBe("https://a0.muscache.com/im/pictures/miso/Hosting-9/og.jpg?im_w=1200&x=1");
    expect(coverCandidates).toEqual(
      expect.arrayContaining([
        "https://a0.muscache.com/im/pictures/ld.jpg?im_w=1200",
        "https://a0.muscache.com/im/pictures/miso/Hosting-9/state.jpg?im_w=1200",
        "https://a0.muscache.com/im/pictures/miso/Hosting-9/escaped.jpg?im_w=1200",
      ]),
    );
    expect(coverCandidates.join(" ")).not.toMatch(/avatar|logo/);
  });

  it("ranks listing photos above other images and ignores unknown hosts", () => {
    const html = `<script>var a="https://a0.muscache.com/im/pictures/plain.jpg", b="https://a0.muscache.com/im/pictures/miso/Hosting-2/first.jpg", c="https://evil.example.com/x.jpg";</script>`;
    const { coverCandidates } = extractListingContext(html);
    expect(coverCandidates[0]).toContain("Hosting-2/first.jpg");
    expect(coverCandidates.join(" ")).not.toContain("evil.example.com");
  });

  const photo = (n: string) => `https://a0.muscache.com/im/pictures/miso/Hosting-7/original/${n}.jpeg`;
  const stateHtml = (state: unknown, head = "") => `<head>${head}</head><script type="application/json">${JSON.stringify(state)}</script>`;

  it("uses the photo the link points at (photo_id) over page order", () => {
    const state = { sections: [{ thumbs: [{ id: "1", baseUrl: photo("t1") }, { id: "2", baseUrl: photo("t2") }, { id: "3", baseUrl: photo("t3") }] }, { gallery: [{ id: "900", baseUrl: photo("second") }, { id: "1850473928", baseUrl: photo("cover") }, { id: "901", baseUrl: photo("third") }] }] };
    const { coverCandidates } = extractListingContext(stateHtml(state), { photoId: "1850473928" });
    expect(coverCandidates[0]).toContain("cover.jpeg");
  });

  it("falls back to the first photo of the largest gallery, not whichever photo appears first", () => {
    const state = { related: [photo("rel1"), photo("rel2"), photo("rel3")], listing: { photos: [{ baseUrl: photo("cover") }, { baseUrl: photo("b") }, { baseUrl: photo("c") }, { baseUrl: photo("d") }, { baseUrl: photo("e") }] }, stray: photo("stray") };
    const { coverCandidates } = extractListingContext(stateHtml(state));
    expect(coverCandidates[0]).toContain("cover.jpeg");
    expect(coverCandidates.some((u) => u.includes("rel1"))).toBe(true); // still available as a fallback
  });

  it("still trusts the page's own preview image when there is no photo_id", () => {
    const state = { photos: [{ baseUrl: photo("g1") }, { baseUrl: photo("g2") }, { baseUrl: photo("g3") }] };
    const { coverCandidates } = extractListingContext(stateHtml(state, `<meta property="og:image" content="${photo("og")}">`));
    expect(coverCandidates[0]).toContain("og.jpeg");
  });

  it("the importer reads photo_id from the pasted link", async () => {
    const state = { photos: [{ id: "5", baseUrl: photo("first") }, { id: "1850473928", baseUrl: photo("chosen") }, { id: "6", baseUrl: photo("last") }], t: "x".repeat(500) };
    fetchMock.mockImplementation(async (input: string) =>
      /muscache\.com/.test(String(input))
        ? new Response(new Uint8Array([1]), { status: 206, headers: { "content-type": "image/png" } })
        : new Response(`<title>Cabin</title>${"Lovely cabin. ".repeat(60)}<script type="application/json">${JSON.stringify(state)}</script>`, { status: 200 }),
    );
    openaiCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ property_name: "Lake Cabin" }) } }] });
    const res = await importRoute(post("/api/import-listing", { url: "https://www.airbnb.com/rooms/1?adults=2&photo_id=1850473928" }));
    expect(res.status).toBe(201);
    const [gb] = await db.sql`select cover_image_url from guidebook where id = ${(await res.json()).guidebook_id}`;
    expect(gb.cover_image_url).toContain("chosen.jpeg");
  });

  it("prioritizes house rules and check-in details when embedded state is huge", () => {
    const noise = Array.from({ length: 5000 }, (_, i) => `"title${i}":"Some unrelated title number ${i} with padding text"`).join(",");
    const state = `{${noise},"houseRules":"No parties or events","checkInTime":"After 4 PM"}`;
    const { context } = extractListingContext(`<script type="application/json">${state}</script>`);
    expect(context).toContain("houseRules: No parties or events");
    expect(context.indexOf("houseRules")).toBeLessThan(context.indexOf("title0"));
  });

  it("canonicalizes Airbnb room links only", () => {
    expect(canonicalListingUrl("https://www.airbnb.com/rooms/123?adults=2&check_in=x")).toBe("https://www.airbnb.com/rooms/123");
    expect(canonicalListingUrl("https://www.airbnb.co.uk/rooms/plus/456?x=1")).toBe("https://www.airbnb.co.uk/rooms/456");
    expect(canonicalListingUrl("https://www.vrbo.com/12345?x=1")).toBe("https://www.vrbo.com/12345?x=1");
  });
});
