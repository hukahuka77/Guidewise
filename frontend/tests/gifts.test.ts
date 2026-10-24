import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OWNER, startTestDb, type TestDb } from "./helpers/testDb";

const GUEST = "44444444-4444-4444-8444-dddddddddddd";

vi.mock("@/lib/server/auth", () => ({
  isAuthConfigured: () => true,
  getAuthedUser: async (request: Request) => {
    const header = request.headers.get("authorization");
    if (header === "Bearer admin") return { id: "55555555-5555-4555-8555-eeeeeeeeeeee", email: "Admin@Example.com", isGuest: false };
    if (header === "Bearer owner") return { id: OWNER, email: "owner@example.com", isGuest: false };
    return null;
  },
}));
vi.mock("@/lib/server/listingImport", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  importListing: vi.fn(async () => ({
    property_name: "Willow Cottage", host_name: "Sam Lee", host_bio: "", welcome_message: "", address_city_state: "", address_street: "", address_zip: "",
    check_in_time: null, check_out_time: null, access_info: "", parking_info: "", wifi_network: "", house_rules: [], house_manual: [], checkout_info: [], cover_image_url: null,
  })),
}));
vi.mock("@/lib/server/gifts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createGiftOwner: vi.fn(async () => GUEST),
}));

import { GET as adminCheck, POST as makeGift } from "../src/app/api/admin/gifts/route";
import { GET as giftInfo } from "../src/app/api/gift/[ticket]/route";
import { GET as giftHtml } from "../src/app/api/gift/[ticket]/html/route";
import { isAdmin } from "../src/lib/server/gifts";
import { claimGuestGuidebooks } from "../src/lib/server/guestAccounts";
import { setSqlForTests } from "../src/lib/server/db";

let db: TestDb;
const saved = { ...process.env };
beforeAll(async () => {
  db = await startTestDb();
}, 60000);
afterAll(async () => {
  setSqlForTests(undefined);
  process.env = saved;
  await db?.close();
});
beforeEach(async () => {
  process.env.ADMIN_EMAILS = "someone@else.com, admin@example.com";
  process.env.OPENAI_API_KEY = "test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  setSqlForTests(db.sql);
  await db.reset();
  await db.sql`insert into auth.users (id, is_anonymous) values (${GUEST}::uuid, true), (${OWNER}::uuid, false)`;
});

const post = (token: string, body: unknown) =>
  new Request("http://x/api/admin/gifts", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = (ticket: string) => ({ params: Promise.resolve({ ticket }) });

describe("gifts", () => {
  it("isAdmin matches the ADMIN_EMAILS list, case-insensitively", () => {
    expect(isAdmin("ADMIN@example.com")).toBe(true);
    expect(isAdmin("owner@example.com")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    process.env.ADMIN_EMAILS = "";
    expect(isAdmin("admin@example.com")).toBe(false);
  });

  it("only admins can make gifts", async () => {
    expect((await adminCheck(new Request("http://x", { headers: { Authorization: "Bearer owner" } }))).status).toBe(404);
    expect((await adminCheck(new Request("http://x", { headers: { Authorization: "Bearer admin" } }))).status).toBe(200);
    expect((await makeGift(post("owner", { url: "https://www.airbnb.com/rooms/1" }))).status).toBe(404);
    expect(await db.sql`select id from guidebook`).toHaveLength(0);
  });

  it("builds a private guidebook for a guest owner and a link that shows it until it is claimed", async () => {
    const res = await makeGift(post("admin", { url: "https://www.airbnb.com/rooms/1" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ property_name: "Willow Cottage", host_name: "Sam Lee" });
    const ticket = decodeURIComponent(new URL(body.gift_url).pathname.split("/").at(-1)!);
    expect(new URL(body.gift_url).searchParams.get("utm_source")).toBe("outreach");
    const [gb] = await db.sql`select user_id from guidebook`;
    expect(gb.user_id).toBe(GUEST);

    const info = await giftInfo(new Request("http://x"), ctx(ticket));
    expect(await info.json()).toEqual({ property_name: "Willow Cottage", host_name: "Sam Lee" });
    const html = await giftHtml(new Request("http://x"), ctx(ticket));
    expect(html.status).toBe(200);
    expect(await html.text()).toContain("Willow Cottage");

    // a forged or broken ticket shows nothing
    expect((await giftInfo(new Request("http://x"), ctx(ticket.slice(0, -2) + "xx"))).status).toBe(404);

    // once claimed, the link is spent
    expect(await claimGuestGuidebooks(db.sql, GUEST, OWNER)).toHaveLength(1);
    expect((await giftInfo(new Request("http://x"), ctx(ticket))).status).toBe(404);
    expect((await giftHtml(new Request("http://x"), ctx(ticket))).status).toBe(404);
  });
});
