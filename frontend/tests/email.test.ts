import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OWNER, startTestDb, type TestDb } from "./helpers/testDb";
import { escapeHtml, sendEmail } from "../src/lib/server/email";
import { buildWeeklySummary, summaryRecipients } from "../src/lib/server/weeklySummary";
import { GET as summaryRoute } from "../src/app/api/cron/summary/route";
import { setSqlForTests } from "../src/lib/server/db";

const ENV = ["RESEND_API_KEY", "CRON_SECRET", "ADMIN_EMAILS", "SUMMARY_EMAILS"];
const saved: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let db: TestDb;

beforeAll(async () => {
  db = await startTestDb();
}, 60000);
afterAll(async () => {
  setSqlForTests(undefined);
  await db?.close();
});
beforeEach(async () => {
  for (const k of ENV) saved[k] = process.env[k];
  setSqlForTests(db.sql);
  await db.reset();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const resend = () => {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
};

describe("email", () => {
  it("sends from the mail. subdomain with replies going to the real inbox", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = resend();
    expect(await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" })).toBe("em_1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "Guidewise <hello@mail.guidewiseapp.com>",
      reply_to: "hello@guidewiseapp.com",
      to: ["a@b.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
    });
  });

  it("says why Resend refused", async () => {
    process.env.RESEND_API_KEY = "re_test";
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 })) as unknown as typeof fetch;
    await expect(sendEmail({ to: "a@b.com", subject: "x", html: "x" })).rejects.toThrow("Resend 403: domain not verified");
  });

  it("escapes text going into HTML", () => {
    expect(escapeHtml(`<b>"Tom's" & co</b>`)).toBe("&lt;b&gt;&quot;Tom&#39;s&quot; &amp; co&lt;/b&gt;");
  });
});

describe("weekly summary", () => {
  it("goes to SUMMARY_EMAILS, else the admins", () => {
    process.env.ADMIN_EMAILS = "a@x.com, not-an-email ,b@x.com";
    delete process.env.SUMMARY_EMAILS;
    expect(summaryRecipients()).toEqual(["a@x.com", "b@x.com"]);
    process.env.SUMMARY_EMAILS = "me@x.com";
    expect(summaryRecipients()).toEqual(["me@x.com"]);
  });

  it("sums up the week: accounts, money, views and outreach replies", async () => {
    await db.sql`insert into auth.users (id, is_anonymous, email, created_at) values (${OWNER}::uuid, false, 'new@host.com', now() - interval '1 day')`;
    await db.sql`insert into profiles (user_id, plan) values (${OWNER}::uuid, 'starter')`;
    await db.sql`insert into outreach_gift (guest_id, property_name, prospect_email, opens, reply_status, replied_at, reply_note)
      values ('44444444-4444-4444-8444-dddddddddddd'::uuid, 'Willow <Cottage>', 'p@x.com', 2, 'declined', now() - interval '2 days', 'No thanks')`;
    const { subject, html, text } = await buildWeeklySummary(db.sql);
    expect(subject).toBe("Guidewise this week: 1 new account, $5/mo");
    expect(html).toContain("new@host.com");
    expect(html).toContain("1 Starter");
    expect(html).toContain("Willow &lt;Cottage&gt;: declined (No thanks)");
    expect(html).not.toContain("<Cottage>");
    expect(text).toContain("Replied: 1 (0 interested, 1 declined)");
  });

  it("the cron route sends it only with the cron secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    process.env.RESEND_API_KEY = "re_test";
    process.env.ADMIN_EMAILS = "admin@x.com";
    const fetchMock = resend();
    expect((await summaryRoute(new Request("http://x/api/cron/summary"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    const ok = await summaryRoute(new Request("http://x/api/cron/summary", { headers: { authorization: "Bearer s3cret" } }));
    expect(await ok.json()).toEqual({ sent: 1, id: "em_1" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).to).toEqual(["admin@x.com"]);
  });
});
