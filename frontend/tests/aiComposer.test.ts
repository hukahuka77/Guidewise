import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, OWNER, setPlan, type TestDb } from "./helpers/testDb";
import { composeGuidePlan, composerInput, validatePlan, type GuidePlan } from "../src/lib/pdf/guide/compose";
import { buildGuideModel } from "../src/lib/pdf/guide/model";
import { resolveAiPlan } from "../src/lib/pdf/aiPlan";
import { assertAiPdfAllowed } from "../src/lib/pdf/service";
import { PLAN_CONFIGS } from "../src/lib/server/plans";
import { aiUsage } from "../src/lib/server/usage";
import { ServiceError } from "../src/lib/server/guidebookService";
import { setSqlForTests } from "../src/lib/server/db";
import type { GuidebookRow } from "../src/lib/guidebook/types";

const resolver = { photoReference: async () => null, findPlaceId: async () => null, photoUrl: (r: string) => r };
const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "parity", "fixtures", `${name}.json`), "utf8")) as GuidebookRow;

const SECRETS = ["p@ss word!", "Lockbox on the left", "Two spots in the driveway", "555-0100", "andrew@example.com", "Under the kitchen sink"];

async function modelWith(overrides: Record<string, unknown> = {}) {
  return buildGuideModel({ ...fixture("full_welcomebook"), ...overrides } as unknown as GuidebookRow, resolver);
}

describe("composer input", () => {
  it("never contains the Wi-Fi password, access details, parking notes, emergency details, contact or address", async () => {
    const input = JSON.stringify(composerInput(await modelWith()));
    for (const secret of SECRETS) expect(input).not.toContain(secret);
    expect(input).toContain('"wifi":true');
    expect(input).toContain('"access":true');
  });

  it("redacts a secret a host typed into the free-text welcome message", async () => {
    const model = await modelWith({ welcome_info: "Wi-Fi password is p@ss word! and the door code is 4821. Enjoy!" });
    const input = JSON.stringify(composerInput(model));
    expect(input).not.toContain("p@ss word!");
    expect(input).toContain("[hidden]");
  });

  it("what is actually sent to OpenAI is the masked input", async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify({ theme: "classic" }) } }] }));
    await composeGuidePlan(await modelWith(), { client: { chat: { completions: { create } } } as never });
    const sent = JSON.stringify((create.mock.calls[0] as unknown[])[0]);
    for (const secret of SECRETS) expect(sent).not.toContain(secret);
  });
});

describe("plan validation", () => {
  it("keeps good output and drops everything unsafe", async () => {
    const input = composerInput(await modelWith());
    const plan = validatePlan(
      {
        theme: "classic",
        tagline: "Your cozy home away from home",
        welcome: "Welcome! We are so glad you are here.",
        highlights: [
          "Check-in is easy and self-serve",
          "Only $99 per night extra", // invented number
          "Visit https://evil.example.com now", // link
          "Email me at host@example.com", // email
          "The code is [hidden]", // redaction marker echoed back
          "Quiet hours after dark",
          "Trash goes out on the curb",
          "Great local restaurants nearby",
          "A fifth highlight that must be cut",
        ],
        order: ["rules", "nope", "arrival", "rules", "checkout"],
        sections: {
          rules: { title: "The Ground Rules", blurb: "A few things that keep everyone happy." },
          nope: { title: "Not a real section" },
          arrival: { title: "Call 800-555-1234 to arrive" },
        },
      },
      input,
      ["p@ss word!"],
    );
    expect(plan?.theme).toBe("classic");
    expect(plan?.tagline).toBe("Your cozy home away from home");
    expect(plan?.highlights).toEqual(["Check-in is easy and self-serve", "Quiet hours after dark", "Trash goes out on the curb", "Great local restaurants nearby"]);
    expect(plan?.order).toEqual(["rules", "arrival", "checkout"]);
    expect(plan?.sections.rules).toEqual({ title: "The Ground Rules", blurb: "A few things that keep everyone happy." });
    expect(plan?.sections.nope).toBeUndefined();
    expect(plan?.sections.arrival).toBeUndefined();
  });

  it("falls back to the default theme for an unknown one and rejects non-objects", async () => {
    const input = composerInput(await modelWith());
    expect(validatePlan({ theme: "neon" }, input)?.theme).toBe("welcomebook");
    expect(validatePlan(null, input)).toBeNull();
    expect(validatePlan("text", input)).toBeNull();
    expect(validatePlan([], input)).toBeNull();
  });

  it("allows numbers that were in the input and rejects ones that were not", async () => {
    const input = composerInput(await modelWith({ check_in_time: "15:00" }));
    expect(validatePlan({ highlights: ["Check-in starts at 3:00 PM"] }, input)?.highlights).toHaveLength(1);
    expect(validatePlan({ highlights: ["Breakfast is at 8:45"] }, input)?.highlights).toEqual([]);
  });

  it("drops text containing the wifi password even if it slipped in", async () => {
    const input = composerInput(await modelWith());
    expect(validatePlan({ highlights: ["The password is hunter22"] }, input, ["hunter22"])?.highlights).toEqual([]);
  });

  it("returns null from the composer when OpenAI fails or returns junk", async () => {
    const model = await modelWith();
    const boom = { chat: { completions: { create: vi.fn(async () => { throw new Error("down"); }) } } };
    expect(await composeGuidePlan(model, { client: boom as never })).toBeNull();
    const junk = { chat: { completions: { create: vi.fn(async () => ({ choices: [{ message: { content: "not json" } }] })) } } };
    expect(await composeGuidePlan(model, { client: junk as never })).toBeNull();
  });
});

describe("plan access", () => {
  it("is for paid plans with the print PDF", () => {
    expect(() => assertAiPdfAllowed(PLAN_CONFIGS.free)).toThrow(ServiceError);
    expect(() => assertAiPdfAllowed(PLAN_CONFIGS.starter)).not.toThrow();
    expect(() => assertAiPdfAllowed(PLAN_CONFIGS.pro)).not.toThrow();
  });
});

describe("resolveAiPlan (cache and allowance)", () => {
  let db: TestDb;
  const plan: GuidePlan = { theme: "minimal", tagline: "Hello", highlights: [], order: [], sections: {} };

  beforeAll(async () => {
    db = await startTestDb();
    setSqlForTests(db.sql);
  }, 60000);
  afterAll(async () => {
    setSqlForTests(null);
    await db.close();
  });
  beforeEach(async () => {
    await db.reset();
    await setPlan(db.sql, OWNER, "starter");
  });

  it("charges once, then serves the cached plan for free until the content changes", async () => {
    const compose = vi.fn(async () => plan);
    const model = await modelWith();
    expect((await resolveAiPlan(db.sql, OWNER, "g1", model, {}, { compose })).status).toBe("generated");
    expect((await resolveAiPlan(db.sql, OWNER, "g1", model, {}, { compose })).status).toBe("cached");
    expect(compose).toHaveBeenCalledTimes(1);
    expect((await aiUsage(db.sql, OWNER))).toBe(1);

    const edited = await modelWith({ welcome_info: "A brand new welcome message." });
    expect((await resolveAiPlan(db.sql, OWNER, "g1", edited, {}, { compose })).status).toBe("generated");
    expect(compose).toHaveBeenCalledTimes(2);
    expect((await aiUsage(db.sql, OWNER))).toBe(2);
  });

  it("refresh composes again and charges again", async () => {
    const compose = vi.fn(async () => plan);
    const model = await modelWith();
    await resolveAiPlan(db.sql, OWNER, "g1", model, {}, { compose });
    const again = await resolveAiPlan(db.sql, OWNER, "g1", model, { refresh: true }, { compose });
    expect(again.status).toBe("generated");
    expect((await aiUsage(db.sql, OWNER))).toBe(2);
  });

  it("refunds the allowance and falls back when nothing usable comes back", async () => {
    const result = await resolveAiPlan(db.sql, OWNER, "g1", await modelWith(), {}, { compose: async () => null });
    expect(result).toEqual({ plan: null, status: "fallback" });
    expect((await aiUsage(db.sql, OWNER))).toBe(0);
  });

  it("is a 403 with an upgrade hint once the monthly allowance is used up, without calling OpenAI", async () => {
    await db.sql`insert into ai_usage_monthly (user_id, month, used) values (${OWNER}, date_trunc('month', now())::date, ${PLAN_CONFIGS.starter.aiPerMonth})`;
    const compose = vi.fn(async () => plan);
    await expect(resolveAiPlan(db.sql, OWNER, "g1", await modelWith(), {}, { compose })).rejects.toMatchObject({ status: 403, extra: { quota: "ai" } });
    expect(compose).not.toHaveBeenCalled();
  });

  it("still works when the cache table is unavailable", async () => {
    await db.sql`alter table guidebook_pdf_plan rename to guidebook_pdf_plan_off`;
    try {
      const result = await resolveAiPlan(db.sql, OWNER, "g1", await modelWith(), {}, { compose: async () => plan });
      expect(result.status).toBe("generated");
    } finally {
      await db.sql`alter table guidebook_pdf_plan_off rename to guidebook_pdf_plan`;
    }
  });
});
