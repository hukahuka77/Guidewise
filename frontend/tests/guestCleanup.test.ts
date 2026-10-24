import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OWNER, startTestDb, type TestDb } from "./helpers/testDb";

import { cleanupAbandonedGuests } from "../src/lib/server/guestCleanup";
import { GET as cronRoute } from "../src/app/api/cron/cleanup/route";
import { setSqlForTests } from "../src/lib/server/db";

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
  await db.reset();
});

const GIFT_OLD = "a1111111-1111-4111-8111-111111111111"; // gift from 40 days ago, never claimed
const GUEST_ACTIVE = "a2222222-2222-4222-8222-222222222222"; // old guest who edited last week
const GIFT_NEW = "a3333333-3333-4333-8333-333333333333"; // gift from last week (link still valid)
const EMPTY_OLD = "a4444444-4444-4444-8444-444444444444"; // started, never built, gone 10 days
const EMPTY_NEW = "a5555555-5555-4555-8555-555555555555"; // started, never built, here yesterday

async function seed() {
  await db.sql`insert into auth.users (id, is_anonymous, created_at, last_sign_in_at) values
    (${OWNER}::uuid, false, now() - interval '400 days', now() - interval '200 days'),
    (${GIFT_OLD}::uuid, true, now() - interval '40 days', now() - interval '40 days'),
    (${GUEST_ACTIVE}::uuid, true, now() - interval '60 days', now() - interval '6 days'),
    (${GIFT_NEW}::uuid, true, now() - interval '6 days', now() - interval '6 days'),
    (${EMPTY_OLD}::uuid, true, now() - interval '10 days', now() - interval '10 days'),
    (${EMPTY_NEW}::uuid, true, now() - interval '2 days', now() - interval '1 day')`;
  const book = async (id: string, userId: string, edited: string) => {
    const [{ id: pid }] = await db.sql`insert into property (name, user_id) values (${id}, ${userId}) returning id`;
    const [{ id: hid }] = await db.sql`insert into host (name, user_id) values (${id}, ${userId}) returning id`;
    await db.sql`insert into guidebook (id, property_id, host_id, user_id, template_key, created_time, last_modified_time)
      values (${id}, ${pid}, ${hid}, ${userId}, 'template_signature', now() - ${edited}::interval, now() - ${edited}::interval)`;
  };
  await book("gift-old", GIFT_OLD, "40 days");
  await book("guest-active", GUEST_ACTIVE, "6 days");
  await book("gift-new", GIFT_NEW, "6 days");
  await book("owner-ancient", OWNER, "300 days"); // a real account's guidebook, however old, is never touched
}

describe("guest cleanup", () => {
  it("removes unclaimed gifts after their link expired and guests who never built anything; keeps the rest", async () => {
    await seed();
    const deleted: string[] = [];
    const result = await cleanupAbandonedGuests(db.sql, async (id) => {
      deleted.push(id);
      await db.sql`delete from auth.users where id = ${id}::uuid`;
    });
    expect(result).toEqual({ guests: 2, guidebooks: 1, failed: 0 });
    expect(deleted.sort()).toEqual([GIFT_OLD, EMPTY_OLD].sort());
    expect((await db.sql`select id from guidebook order by id`).map((r) => r.id)).toEqual(["gift-new", "guest-active", "owner-ancient"]);
    expect(await db.sql`select id from property where user_id = ${GIFT_OLD}`).toHaveLength(0);
    expect(await db.sql`select id from host where user_id = ${GIFT_OLD}`).toHaveLength(0);
    // a second run has nothing left to do
    expect(await cleanupAbandonedGuests(db.sql, async () => {})).toEqual({ guests: 0, guidebooks: 0, failed: 0 });
  });

  it("keeps going when one guest can't be removed", async () => {
    await seed();
    const result = await cleanupAbandonedGuests(db.sql, async (id) => {
      if (id === EMPTY_OLD) throw new Error("auth said no");
      await db.sql`delete from auth.users where id = ${id}::uuid`;
    });
    expect(result).toEqual({ guests: 1, guidebooks: 1, failed: 1 });
  });

  it("the cron route only runs with the cron secret", async () => {
    const saved = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      expect((await cronRoute(new Request("http://x/api/cron/cleanup", { headers: { authorization: "Bearer " } }))).status).toBe(404);
      process.env.CRON_SECRET = "s3cret";
      expect((await cronRoute(new Request("http://x/api/cron/cleanup"))).status).toBe(404);
      expect((await cronRoute(new Request("http://x/api/cron/cleanup", { headers: { authorization: "Bearer nope" } }))).status).toBe(404);
      const ok = await cronRoute(new Request("http://x/api/cron/cleanup", { headers: { authorization: "Bearer s3cret" } }));
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ guests: 0, guidebooks: 0, failed: 0 });
    } finally {
      if (saved === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = saved;
    }
  });
});
