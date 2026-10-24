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
import { GET as statsRoute } from "../src/app/api/admin/stats/route";
import { PATCH as replyRoute } from "../src/app/api/admin/outreach/[guestId]/route";
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

  it("records outreach results: the prospect's email when built, real opens (not bots or previews), and the claim", async () => {
    const res = await makeGift(post("admin", { url: "https://www.airbnb.com/rooms/1", email: " sam@host.com " }));
    const ticket = decodeURIComponent(new URL((await res.json()).gift_url).pathname.split("/").at(-1)!);
    const row = async () => (await db.sql`select * from outreach_gift where guest_id = ${GUEST}::uuid`)[0];
    expect(await row()).toMatchObject({ property_name: "Willow Cottage", prospect_email: "sam@host.com", opens: 0, first_opened_at: null, claimed_at: null });

    const browser = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" };
    await giftInfo(new Request("http://x", { headers: { "user-agent": "Slackbot-LinkExpanding 1.0" } }), ctx(ticket));
    await giftInfo(new Request("http://x?preview=1", { headers: browser }), ctx(ticket));
    await giftInfo(new Request("http://x"), ctx(ticket));
    expect((await row()).opens).toBe(0);
    await giftInfo(new Request("http://x", { headers: browser }), ctx(ticket));
    await giftInfo(new Request("http://x", { headers: browser }), ctx(ticket));
    const opened = await row();
    expect(opened.opens).toBe(2);
    expect(opened.first_opened_at).not.toBeNull();

    await claimGuestGuidebooks(db.sql, GUEST, OWNER);
    expect(await row()).toMatchObject({ claimed_by: OWNER });
    expect((await row()).claimed_at).not.toBeNull();

    await db.sql`update auth.users set email = 'owner@example.com' where id = ${OWNER}::uuid`;
    const stats = await (await statsRoute(new Request("http://x", { headers: { Authorization: "Bearer admin" } }))).json();
    expect(stats.outreach).toEqual([expect.objectContaining({ property_name: "Willow Cottage", prospect_email: "sam@host.com", opens: 2, claimed_by_email: "owner@example.com" })]);
  });

  it("a gift without a usable email is still tracked, and a missing table doesn't break gifts", async () => {
    await makeGift(post("admin", { url: "https://www.airbnb.com/rooms/1", email: "not an email" }));
    expect((await db.sql`select prospect_email from outreach_gift`)[0].prospect_email).toBeNull();
    await db.reset();
    await db.sql`insert into auth.users (id, is_anonymous) values (${GUEST}::uuid, true)`;
    await db.sql`alter table outreach_gift rename to outreach_gift_gone`;
    try {
      const res = await makeGift(post("admin", { url: "https://www.airbnb.com/rooms/1" }));
      expect(res.status).toBe(201);
      const ticket = decodeURIComponent(new URL((await res.json()).gift_url).pathname.split("/").at(-1)!);
      expect((await giftInfo(new Request("http://x", { headers: { "user-agent": "Mozilla/5.0" } }), ctx(ticket))).status).toBe(200);
      const stats = await (await statsRoute(new Request("http://x", { headers: { Authorization: "Bearer admin" } }))).json();
      expect(stats.outreach).toEqual([]);
    } finally {
      await db.sql`alter table outreach_gift_gone rename to outreach_gift`;
    }
  });

  it("admins mark how a prospect replied; it shows in the outreach results", async () => {
    await makeGift(post("admin", { url: "https://www.airbnb.com/rooms/1", email: "sam@host.com" }));
    const patch = (token: string, body: unknown, id = GUEST) =>
      replyRoute(new Request(`http://x/api/admin/outreach/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ guestId: id }) });
    expect((await patch("owner", { reply_status: "declined" })).status).toBe(404);
    expect((await patch("admin", { reply_status: "maybe" })).status).toBe(400);
    expect((await patch("admin", { reply_status: "declined" }, "66666666-6666-4666-8666-000000000000")).status).toBe(404);
    expect((await patch("admin", { reply_status: "declined", reply_note: "No thanks", replied_at: "2026-10-24T20:40:01Z" })).status).toBe(200);
    const stats = async () => (await (await statsRoute(new Request("http://x", { headers: { Authorization: "Bearer admin" } }))).json()).outreach[0];
    expect(await stats()).toMatchObject({ guest_id: GUEST, reply_status: "declined", reply_note: "No thanks", replied_at: "2026-10-24T20:40:01.000Z" });
    // changing the status keeps when they replied; clearing it removes everything
    await patch("admin", { reply_status: "interested", reply_note: "No thanks" });
    expect(await stats()).toMatchObject({ reply_status: "interested", replied_at: "2026-10-24T20:40:01.000Z" });
    await patch("admin", { reply_status: null });
    expect(await stats()).toMatchObject({ reply_status: null, replied_at: null, reply_note: null });
  });

  it("admin stats count accounts, sources, plans and views, for admins only", async () => {
    await db.sql`insert into auth.users (id, is_anonymous, email, created_at, raw_user_meta_data) values
      ('66666666-6666-4666-8666-ffffffffffff'::uuid, false, 'new@host.com', now() - interval '2 days', '{"signup_source":{"source":"outreach"},"heard_about":"A message from Guidewise"}'::jsonb),
      ('77777777-7777-4777-8777-777777777777'::uuid, false, 'old@host.com', now() - interval '60 days', '{"signup_source":{"referrer":"google.com"}}'::jsonb)`;
    await db.sql`update auth.users set email = 'owner@example.com', created_at = now() - interval '10 days' where id = ${OWNER}::uuid`;
    await db.sql`insert into public.profiles (user_id, plan) values (${OWNER}::uuid, 'power'), ('66666666-6666-4666-8666-ffffffffffff'::uuid, 'growth')`;
    const [{ id: pid }] = await db.sql`insert into property (name, user_id) values ('Willow', ${GUEST}) returning id`;
    await db.sql`insert into guidebook (id, property_id, user_id, template_key) values ('gift1', ${pid}, ${GUEST}, 'template_signature'), ('own1', ${pid}, ${OWNER}, 'template_signature')`;
    await db.sql`insert into guidebook_view_daily (guidebook_id, user_id, day, views) values ('own1', ${OWNER}, (now() at time zone 'utc')::date, 9)`;

    expect((await statsRoute(new Request("http://x", { headers: { Authorization: "Bearer owner" } }))).status).toBe(404);
    const res = await statsRoute(new Request("http://x", { headers: { Authorization: "Bearer admin" } }));
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.users).toEqual({ members: 3, new_7d: 1, new_30d: 2, guests: 1 });
    expect(s.guidebooks).toMatchObject({ total: 2, unclaimed: 1 });
    expect(s.plans).toEqual({ power: 2 });
    expect(s.mrr_usd).toBe(30);
    expect(s.views_month).toBe(9);
    expect(s.top_guidebooks[0]).toEqual({ id: "own1", property_name: "Willow", views: 9 });
    expect(s.sources).toEqual(expect.arrayContaining([{ source: "outreach", signups: 1 }, { source: "direct / unknown", signups: 1 }]));
    expect(s.heard_about).toEqual([{ answer: "A message from Guidewise", signups: 1 }]);
    expect(s.recent_signups[0]).toMatchObject({ email: "new@host.com", source: "outreach", plan: "power", guidebooks: 0 });
    expect(s.recent_signups.find((u: { email: string }) => u.email === "old@host.com").source).toBe("referral: google.com");
  });
});
