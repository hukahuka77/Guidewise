import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ALLOWED_TEMPLATE_KEYS,
  ServiceError,
  canActivateGuidebook,
  compileRulesInput,
  createGuidebook,
  deleteGuidebook,
  ensurePreviewToken,
  getGuidebookPayload,
  getUserGuidebookLimit,
  listGuidebooks,
  listHosts,
  publishGuidebook,
  setTemplateKey,
  slugify,
  toggleGuidebook,
  updateGuidebook,
} from "../src/lib/server/guidebookService";
import { OTHER, OWNER, setPlan, startTestDb, type TestDb } from "./helpers/testDb";

let db: TestDb;
beforeAll(async () => {
  db = await startTestDb();
}, 60000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.reset();
});

const base = (extra: Record<string, unknown> = {}) => ({ property_name: "Cozy Cabin", ...extra });
const rejects = async (p: Promise<unknown>, status: number) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).status).toBe(status);
    return e as ServiceError;
  }
  throw new Error("expected ServiceError");
};

describe("slugify and rules input", () => {
  it("slugifies like Flask's effective _slugify", () => {
    expect(slugify("Cozy Cabin <Deluxe>")).toBe("cozy-cabin-deluxe");
    expect(slugify("Andrew's  Place!")).toBe("andrews-place");
    expect(slugify("  --x--  ")).toBe("x");
    expect(slugify("")).toBe("guidebook");
    expect(slugify(null)).toBe("guidebook");
  });
  it("compiles rules from dicts and 'Name: details' strings", () => {
    expect(compileRulesInput([{ name: " A ", description: " b " }, "No pets: ask first", "plain", "", null, { name: "", description: "" }])).toEqual([
      { name: "A", description: "b" },
      { name: "No pets", description: "ask first" },
      { name: "plain", description: "" },
    ]);
    expect(compileRulesInput("nope")).toEqual([]);
  });
});

describe("plans", () => {
  it("resolves limits like Flask", async () => {
    expect(await getUserGuidebookLimit(db.sql, OWNER)).toBe(0); // no profile
    await setPlan(db.sql, OWNER, "starter");
    expect(await getUserGuidebookLimit(db.sql, OWNER)).toBe(1);
    await setPlan(db.sql, OWNER, "pro");
    expect(await getUserGuidebookLimit(db.sql, OWNER)).toBe(10);
    await setPlan(db.sql, OWNER, "enterprise");
    expect(await getUserGuidebookLimit(db.sql, OWNER)).toBeNull();
    await setPlan(db.sql, OWNER, "legacy-plan", 5);
    expect(await getUserGuidebookLimit(db.sql, OWNER)).toBe(5);
    await setPlan(db.sql, OWNER, "free");
    expect(await getUserGuidebookLimit(db.sql, OWNER)).toBe(0);
    expect(await getUserGuidebookLimit(db.sql, "not-a-uuid")).toBe(0);
    expect((await canActivateGuidebook(db.sql, OWNER)).ok).toBe(false);
  });
});

describe("createGuidebook", () => {
  it("requires a property name", async () => {
    await rejects(createGuidebook(db.sql, OWNER, {}), 400);
    await rejects(createGuidebook(db.sql, OWNER, { property_name: "   " }), 400);
  });

  it("creates a draft on a plan without slots, storing everything", async () => {
    const result = await createGuidebook(
      db.sql,
      OWNER,
      base({
        host_name: "Andrew", host_bio: "Hi", host_contact: "a@x.com", host_photo_url: "https://x/h.jpg",
        address_street: "1 Main", address_city_state: "Austin, TX", address_zip: "78701",
        check_in_time: "15:00", check_out_time: "11:00", welcome_message: "Welcome!", parking_info: "Driveway",
        access_info: "Lockbox", wifi_network: "Net", wifi_password: "pw",
        safety_info: { emergency_contact: "911" },
        rules: [{ name: "No smoking", description: "Anywhere" }, "Quiet: 10pm"],
        things_to_do: [{ name: "Park" }], places_to_eat: "not a list",
        included_tabs: ["welcome", "bogus", "custom_pets", 5], custom_sections: { custom_pets: ["dogs"], other: ["x"], custom_bad: "str" },
        custom_tabs_meta: { custom_pets: { label: "Pets", icon: "p" }, other: { label: "x" } },
        template_key: "template_welcomebook", cover_image_url: "data:image/png;base64,AAAA",
      }),
    );
    expect(result.active).toBe(false);
    expect(result.publicSlug).toBeNull();
    expect(result.templateKey).toBe("template_welcomebook");

    const [g] = await db.sql`select * from guidebook where id = ${result.guidebookId}`;
    expect(g.user_id).toBe(OWNER);
    expect(g.active).toBe(false);
    expect(g.public_slug).toBeNull();
    expect(g.cover_image_url).toBeNull(); // data URLs are rejected
    expect(g.wifi_json).toEqual({ network: "Net", password: "pw" });
    expect(g.rules_json).toEqual([{ name: "No smoking", description: "Anywhere" }, { name: "Quiet", description: "10pm" }]);
    expect(g.included_tabs).toEqual(["welcome", "custom_pets"]);
    expect(g.custom_sections).toEqual({ custom_pets: ["dogs"] });
    expect(g.custom_tabs_meta).toEqual({ custom_pets: { label: "Pets", icon: "p" } });
    expect(g.places_to_eat).toEqual([]);
    expect(g.things_to_do).toEqual([{ name: "Park" }]);
    expect(g.safety_info).toEqual({ emergency_contact: "911" });
    const [p] = await db.sql`select * from property where id = ${g.property_id}`;
    expect(p).toMatchObject({ name: "Cozy Cabin", address_street: "1 Main", address_city_state: "Austin, TX", address_zip: "78701", user_id: OWNER });
    const [h] = await db.sql`select * from host where id = ${g.host_id}`;
    expect(h).toMatchObject({ name: "Andrew", bio: "Hi", contact: "a@x.com", host_image_url: "https://x/h.jpg", user_id: OWNER });
  });

  it("defaults the template and tabs, and ignores unknown template keys", async () => {
    const r = await createGuidebook(db.sql, OWNER, base({ template_key: "template_nope" }));
    expect(r.templateKey).toBe("template_original");
    const [g] = await db.sql`select included_tabs from guidebook where id = ${r.guidebookId}`;
    expect(g.included_tabs).toEqual(["welcome", "checkin", "property", "food", "activities", "rules", "checkout"]);
  });

  it("auto-activates with a unique slug when the plan has a free slot", async () => {
    await setPlan(db.sql, OWNER, "pro");
    const r = await createGuidebook(db.sql, OWNER, base());
    expect(r.active).toBe(true);
    expect(r.publicSlug).toMatch(/^cozy-cabin-[0-9a-f]{6}$/);
    const [g] = await db.sql`select active, public_slug from guidebook where id = ${r.guidebookId}`;
    expect(g).toMatchObject({ active: true, public_slug: r.publicSlug });
  });

  it("stops activating once the plan limit is reached", async () => {
    await setPlan(db.sql, OWNER, "starter"); // 1 slot
    const first = await createGuidebook(db.sql, OWNER, base({ property_name: "One" }));
    const second = await createGuidebook(db.sql, OWNER, base({ property_name: "Two" }));
    expect(first.active).toBe(true);
    expect(second.active).toBe(false);
  });

  it("reuses an existing property and host by name for the same user, not across users", async () => {
    await createGuidebook(db.sql, OWNER, base({ host_name: "Andrew", address_street: "1 Main" }));
    await createGuidebook(db.sql, OWNER, base({ host_name: "Andrew", address_street: "2 Elm" }));
    await createGuidebook(db.sql, OTHER, base({ host_name: "Andrew" }));
    expect((await db.sql`select count(*)::int as n from property where user_id = ${OWNER}`)[0].n).toBe(1);
    expect((await db.sql`select count(*)::int as n from host where user_id = ${OWNER}`)[0].n).toBe(1);
    expect((await db.sql`select count(*)::int as n from property where user_id = ${OTHER}`)[0].n).toBe(1);
    const [p] = await db.sql`select address_street from property where user_id = ${OWNER}`;
    expect(p.address_street).toBe("2 Elm"); // addresses that were sent update the shared property
  });

  it("is atomic: a failure after the host/property inserts leaves nothing behind", async () => {
    await db.sql.unsafe(`
      create or replace function boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
      create trigger guidebook_boom before insert on guidebook for each row execute function boom();`);
    try {
      await expect(createGuidebook(db.sql, OWNER, base({ host_name: "Andrew" }))).rejects.toThrow();
    } finally {
      await db.sql.unsafe("drop trigger guidebook_boom on guidebook; drop function boom();");
    }
    expect((await db.sql`select count(*)::int as n from host`)[0].n).toBe(0);
    expect((await db.sql`select count(*)::int as n from property`)[0].n).toBe(0);
    expect((await db.sql`select count(*)::int as n from guidebook`)[0].n).toBe(0);
  });
});

describe("read", () => {
  it("returns the editor payload for the owner only and creates a stable preview link for drafts", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base({ host_name: "Andrew", rules: [{ name: "A", description: "b" }], wifi_network: "N" }));
    const a = await getGuidebookPayload(db.sql, OWNER, guidebookId);
    expect(a).toMatchObject({
      id: guidebookId, template_key: "template_original",
      property: { name: "Cozy Cabin", address_street: null }, host: { name: "Andrew" },
      rules: [{ name: "A", description: "b" }], wifi_json: { network: "N" },
    });
    expect(a.preview_url).toMatch(new RegExp(`^/preview/${guidebookId}\\?t=[A-Za-z0-9_-]{32}$`));
    const b = await getGuidebookPayload(db.sql, OWNER, guidebookId);
    expect(b.preview_url).toBe(a.preview_url);
    await rejects(getGuidebookPayload(db.sql, OTHER, guidebookId), 404);
    await rejects(getGuidebookPayload(db.sql, OWNER, "does-not-exist"), 404);
  });

  it("does not bump last_modified_time when it creates a preview token", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base());
    const [before] = await db.sql`select last_modified_time from guidebook where id = ${guidebookId}`;
    await ensurePreviewToken(db.sql, guidebookId);
    const [after] = await db.sql`select last_modified_time from guidebook where id = ${guidebookId}`;
    expect(after.last_modified_time.getTime()).toBe(before.last_modified_time.getTime());
  });

  it("lists only the user's guidebooks, newest edit first, with the right links", async () => {
    await setPlan(db.sql, OWNER, "starter");
    const live = await createGuidebook(db.sql, OWNER, base({ property_name: "Live One" }));
    const draft = await createGuidebook(db.sql, OWNER, base({ property_name: "Draft One" }));
    await createGuidebook(db.sql, OTHER, base({ property_name: "Not Mine" }));
    await updateGuidebook(db.sql, OWNER, draft.guidebookId, { welcome_message: "edited" });
    const items = await listGuidebooks(db.sql, OWNER);
    expect(items.map((i) => i.property_name)).toEqual(["Draft One", "Live One"]);
    const [d, l] = items;
    expect(d).toMatchObject({ active: false, public_slug: null });
    expect(d.preview_url).toMatch(/^\/preview\/.+\?t=/);
    expect(l).toMatchObject({ active: true, public_slug: live.publicSlug, preview_url: null });
    expect(typeof d.last_modified_time).toBe("string");
  });

  it("lists hosts for the user", async () => {
    await createGuidebook(db.sql, OWNER, base({ host_name: "Andrew", host_bio: "bio" }));
    await createGuidebook(db.sql, OTHER, base({ host_name: "Zed" }));
    expect(await listHosts(db.sql, OWNER)).toEqual([{ id: expect.any(Number), name: "Andrew", bio: "bio", contact: null, photo_url: null }]);
  });
});

describe("updateGuidebook", () => {
  it("applies only the fields that were sent and bumps last_modified_time", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base({ welcome_message: "old", parking_info: "keep" }));
    const [before] = await db.sql`select last_modified_time from guidebook where id = ${guidebookId}`;
    await new Promise((r) => setTimeout(r, 20));
    await updateGuidebook(db.sql, OWNER, guidebookId, { welcome_message: "new", check_in_time: "16:00", things_to_do: [{ name: "Park" }] });
    const [g] = await db.sql`select * from guidebook where id = ${guidebookId}`;
    expect(g).toMatchObject({ welcome_info: "new", parking_info: "keep", check_in_time: "16:00" });
    expect(g.things_to_do).toEqual([{ name: "Park" }]);
    expect(g.last_modified_time.getTime()).toBeGreaterThan(before.last_modified_time.getTime());
  });

  it("can clear a field with null, and rejects data-URL covers", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base({ welcome_message: "x", cover_image_url: "https://x/c.jpg" }));
    await updateGuidebook(db.sql, OWNER, guidebookId, { welcome_message: null, cover_image_url: "data:image/png;base64,AA" });
    const [g] = await db.sql`select welcome_info, cover_image_url from guidebook where id = ${guidebookId}`;
    expect(g.welcome_info).toBeNull();
    expect(g.cover_image_url).toBeNull();
  });

  it("normalises safety_info, merges wifi, replaces rules", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base({ wifi_network: "Net", rules: [{ name: "Old", description: "" }] }));
    await updateGuidebook(db.sql, OWNER, guidebookId, {
      safety_info: { emergency_contact: "  911 ", fire_extinguisher_location: "  " },
      wifi_password: "secret",
      rules: ["New rule: details"],
    });
    const [g] = await db.sql`select safety_info, wifi_json, rules_json from guidebook where id = ${guidebookId}`;
    expect(g.safety_info).toEqual({ emergency_contact: "911", fire_extinguisher_location: null });
    expect(g.wifi_json).toEqual({ network: "Net", password: "secret" });
    expect(g.rules_json).toEqual([{ name: "New rule", description: "details" }]);
    await updateGuidebook(db.sql, OWNER, guidebookId, { rules: [] });
    expect((await db.sql`select rules_json from guidebook where id = ${guidebookId}`)[0].rules_json).toBeNull();
  });

  it("updates the linked host and property, creating a host when none exists", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base());
    await updateGuidebook(db.sql, OWNER, guidebookId, {
      property_name: "Renamed", address_street: "9 Oak", host_name: "New Host", host_bio: "bio", host_contact: "c", host_photo_url: "https://x/p.jpg",
    });
    const [g] = await db.sql`select * from guidebook where id = ${guidebookId}`;
    expect(g.host_id).not.toBeNull();
    const [p] = await db.sql`select * from property where id = ${g.property_id}`;
    expect(p).toMatchObject({ name: "Renamed", address_street: "9 Oak" });
    const [h] = await db.sql`select * from host where id = ${g.host_id}`;
    expect(h).toMatchObject({ name: "New Host", bio: "bio", contact: "c", host_image_url: "https://x/p.jpg", user_id: OWNER });
    // a later edit updates the same host rather than adding another
    await updateGuidebook(db.sql, OWNER, guidebookId, { host_name: "Renamed Host" });
    expect((await db.sql`select count(*)::int as n from host`)[0].n).toBe(1);
    expect((await db.sql`select name from host`)[0].name).toBe("Renamed Host");
  });

  it("ignores a non-string template_key and enforces ownership", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base());
    await updateGuidebook(db.sql, OWNER, guidebookId, { template_key: null, welcome_message: "ok" });
    expect((await db.sql`select template_key from guidebook where id = ${guidebookId}`)[0].template_key).toBe("template_original");
    await rejects(updateGuidebook(db.sql, OTHER, guidebookId, { welcome_message: "hax" }), 404);
    await rejects(updateGuidebook(db.sql, OWNER, "nope", {}), 404);
    expect((await db.sql`select welcome_info from guidebook where id = ${guidebookId}`)[0].welcome_info).toBe("ok");
  });

  it("is atomic: a failed save does not leave a half-applied host/property change", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base({ host_name: "Andrew" }));
    await db.sql.unsafe(`
      create or replace function boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
      create trigger guidebook_boom before update on guidebook for each row execute function boom();`);
    try {
      await expect(updateGuidebook(db.sql, OWNER, guidebookId, { host_name: "Changed", property_name: "Changed", welcome_message: "x" })).rejects.toThrow();
    } finally {
      await db.sql.unsafe("drop trigger guidebook_boom on guidebook; drop function boom();");
    }
    expect((await db.sql`select name from host`)[0].name).toBe("Andrew");
    expect((await db.sql`select name from property`)[0].name).toBe("Cozy Cabin");
  });
});

describe("delete, template, toggle, publish", () => {
  it("deletes only the owner's guidebook", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base());
    await rejects(deleteGuidebook(db.sql, OTHER, guidebookId), 404);
    await deleteGuidebook(db.sql, OWNER, guidebookId);
    expect((await db.sql`select count(*)::int as n from guidebook`)[0].n).toBe(0);
    await rejects(deleteGuidebook(db.sql, OWNER, guidebookId), 404);
  });

  it("changes the template for the owner with validation", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base());
    expect(await setTemplateKey(db.sql, OWNER, guidebookId, "template_lifestyle")).toBe("template_lifestyle");
    const err = await rejects(setTemplateKey(db.sql, OWNER, guidebookId, "template_nope"), 400);
    expect(err.extra.allowed).toEqual(ALLOWED_TEMPLATE_KEYS);
    await rejects(setTemplateKey(db.sql, OTHER, guidebookId, "template_generic"), 404);
    await rejects(setTemplateKey(db.sql, OWNER, "nope", "template_generic"), 404);
    expect((await db.sql`select template_key from guidebook where id = ${guidebookId}`)[0].template_key).toBe("template_lifestyle");
  });

  it("toggle: refuses without a plan, enforces the limit, then unpublishes with a preview link", async () => {
    const free = await createGuidebook(db.sql, OWNER, base({ property_name: "One" }));
    const noPlan = await rejects(toggleGuidebook(db.sql, OWNER, free.guidebookId), 403);
    expect(noPlan.message).toBe("Please upgrade to a paid plan to publish guidebooks");

    await setPlan(db.sql, OWNER, "starter");
    const on = await toggleGuidebook(db.sql, OWNER, free.guidebookId);
    expect(on).toMatchObject({ active: true, publicSlug: "one", previewUrl: null });

    const second = await createGuidebook(db.sql, OWNER, base({ property_name: "Two" }));
    const full = await rejects(toggleGuidebook(db.sql, OWNER, second.guidebookId), 403);
    expect(full.message).toContain("reached your limit of 1 guidebooks");

    const off = await toggleGuidebook(db.sql, OWNER, free.guidebookId);
    expect(off.active).toBe(false);
    expect(off.publicSlug).toBeNull();
    expect(off.previewUrl).toMatch(/^\/preview\/.+\?t=/);
    await rejects(toggleGuidebook(db.sql, OTHER, free.guidebookId), 404);
  });

  it("toggle: avoids slug collisions", async () => {
    await setPlan(db.sql, OWNER, "pro");
    await setPlan(db.sql, OTHER, "pro");
    const a = await createGuidebook(db.sql, OWNER, base({ property_name: "Same Name" }));
    await db.sql`update guidebook set public_slug = 'same-name' where id = ${a.guidebookId}`;
    const b = await createGuidebook(db.sql, OTHER, base({ property_name: "Same Name" }));
    await db.sql`update guidebook set active = false, public_slug = null where id = ${b.guidebookId}`;
    const on = await toggleGuidebook(db.sql, OTHER, b.guidebookId);
    expect(on.publicSlug).toMatch(/^same-name-[0-9a-f]{6}$/);
  });

  it("publish stores a fresh snapshot with the marker and refuses other users", async () => {
    const { guidebookId } = await createGuidebook(db.sql, OWNER, base({ welcome_message: "Hello guests", template_key: "template_welcomebook" }));
    const result = await publishGuidebook(db.sql, OWNER, guidebookId);
    expect(result.etag).toMatch(/^[0-9a-f]{64}$/);
    const [g] = await db.sql`select published_html, published_etag, published_at, last_modified_time from guidebook where id = ${guidebookId}`;
    expect(g.published_html.startsWith("<!-- place-photo-v2 -->")).toBe(true);
    expect(g.published_html).toContain("Hello guests");
    expect(g.published_etag).toBe(result.etag);
    expect(g.published_at.getTime()).toBeGreaterThanOrEqual(g.last_modified_time.getTime());
    await rejects(publishGuidebook(db.sql, OTHER, guidebookId), 404);

    // editing afterwards makes the snapshot stale again until the next publish
    await new Promise((r) => setTimeout(r, 20));
    await updateGuidebook(db.sql, OWNER, guidebookId, { welcome_message: "Changed" });
    const [stale] = await db.sql`select published_at, last_modified_time from guidebook where id = ${guidebookId}`;
    expect(stale.published_at.getTime()).toBeLessThan(stale.last_modified_time.getTime());
  });
});
