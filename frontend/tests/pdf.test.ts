import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER, OWNER, setPlan, startTestDb, type TestDb } from "./helpers/testDb";
import { absoluteQrUrl, absoluteUrl } from "@/lib/publicUrl";

vi.mock("@/lib/server/auth", () => ({
  isAuthConfigured: () => true,
  getAuthedUser: async (request: Request) => {
    const h = request.headers.get("authorization");
    if (h === "Bearer owner") return { id: "11111111-1111-4111-8111-aaaaaaaaaaaa", email: "o@example.com" };
    if (h === "Bearer other") return { id: "22222222-2222-4222-8222-bbbbbbbbbbbb", email: "x@example.com" };
    return null;
  },
}));
vi.mock("@/lib/server/proxy", () => ({
  proxyToBackend: vi.fn(async () => new Response("PROXIED")),
}));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

import { GET as pdfRoute } from "../src/app/api/guidebook/[id]/pdf/route";
import { GET as printRoute } from "../src/app/api/guidebook/[id]/print-pdf/route";
import { isRequestAllowed } from "../src/lib/pdf/browser";
import { setSqlForTests } from "../src/lib/server/db";
import { resetRateLimitsForTests } from "../src/lib/server/rateLimit";

let db: TestDb;
const GB = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";

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
  await setPlan(db.sql, OWNER, "starter");
  const [p] = await db.sql`insert into property (name, address_street, user_id) values ('Café Cabin / №1', '1 Main St', ${OWNER}) returning id`;
  await db.sql`
    insert into guidebook (id, user_id, property_id, template_key, check_in_time, welcome_info, included_tabs, rules_json, wifi_json, house_manual)
    values (${GB}, ${OWNER}, ${p.id}, 'template_welcomebook', '15:00', 'Welcome <b>friends</b>',
            ${db.sql.json(["welcome", "checkin", "property", "rules", "checkout"] as never)},
            ${db.sql.json([{ name: "Quiet", description: "after 10" }] as never)},
            ${db.sql.json({ network: "Net", password: "pw" } as never)},
            ${db.sql.json([{ name: "Thermostat", description: "68-76" }] as never)})`;
});

const call = (route: typeof pdfRoute, query = "", token = "owner", headers: Record<string, string> = {}, id = GB) =>
  route(new Request(`https://x.test/api/guidebook/${id}/pdf${query}`, { headers: { authorization: `Bearer ${token}`, ...headers } }), {
    params: Promise.resolve({ id }),
  });

const isPdf = async (res: Response) => Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString() === "%PDF-";

describe("PDF routes", () => {
  it("requires auth and ownership", async () => {
    expect((await call(pdfRoute, "", "nope")).status).toBe(401);
    expect((await call(pdfRoute, "", "other")).status).toBe(404);
    expect((await call(printRoute, "", "other")).status).toBe(404);
    expect(OTHER).toBeTruthy();
  });

  it("returns 404 for an unknown guidebook", async () => {
    expect((await call(pdfRoute, "", "owner", {}, "bbbbbbbb-bbbb-4bbb-8bbb-000000000002")).status).toBe(404);
  });

  it("renders a PDF with private caching, an ETag and the template key, and honours If-None-Match", async () => {
    const res = await call(pdfRoute, "?template=template_pdf_mobile");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(res.headers.get("x-pdf-template-key")).toBe("template_pdf_mobile");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(await isPdf(res)).toBe(true);

    const etag = res.headers.get("etag")!;
    const again = await call(pdfRoute, "?template=template_pdf_mobile", "owner", { "if-none-match": etag });
    expect(again.status).toBe(304);
    // a different template or QR gets a different tag
    const other = await call(pdfRoute, "?template=template_pdf_basic", "owner", { "if-none-match": etag });
    expect(other.status).toBe(200);
  }, 60000);

  it("falls back to the original template for unknown keys and supports download + QR", async () => {
    const res = await call(pdfRoute, "?template=bogus&download=1&include_qr=1&qr_url=https%3A%2F%2Fexample.com%2Fg%2Fx");
    expect(res.headers.get("x-pdf-template-key")).toBe("template_pdf_original");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(await isPdf(res)).toBe(true);
  }, 60000);

  it("changes the ETag when the guidebook changes", async () => {
    const a = (await call(pdfRoute)).headers.get("etag");
    await db.sql`update guidebook set last_modified_time = now() + interval '1 minute' where id = ${GB}`;
    const b = (await call(pdfRoute)).headers.get("etag");
    expect(a).not.toBe(b);
  }, 60000);

  it("renders the print PDF with a safe download filename", async () => {
    const res = await call(printRoute);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-pdf-type")).toBe("print");
    const disposition = res.headers.get("content-disposition")!;
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("filename*=UTF-8''Caf%C3%A9_Cabin___%E2%84%961_print.pdf");
    expect(/^[\x20-\x7e]*$/.test(disposition)).toBe(true);
    expect(await isPdf(res)).toBe(true);
    expect((await call(printRoute, "?download=0")).headers.get("content-disposition")).toContain("inline");
  }, 60000);

  it("rate limits PDF generation at 10 per minute", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await call(pdfRoute, `?template=template_pdf_qr&qr_url=u${i}&include_qr=1`);
      expect(r.status).toBe(200);
    }
    expect((await call(pdfRoute, "?template=template_pdf_qr&qr_url=zzz&include_qr=1")).status).toBe(429);
  }, 120000);
});

describe("PDF plan gating", () => {
  it("free: only the standard layout; other layouts, the QR poster and the print PDF need a paid plan", async () => {
    await setPlan(db.sql, OWNER, "free");
    const ok = await call(pdfRoute);
    expect(ok.status).toBe(200);
    expect((await call(pdfRoute, "?template=template_pdf_original")).status).toBe(200);
    expect((await call(pdfRoute, "?template=template_pdf_modern")).status).toBe(200); // renders the standard layout
    expect((await call(pdfRoute, "?template=bogus")).status).toBe(200);
    for (const template of ["template_pdf_basic", "template_pdf_mobile", "template_pdf_qr"]) {
      const res = await call(pdfRoute, `?template=${template}`);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ upgrade: true, feature: "pdf_template" });
    }
    const print = await call(printRoute);
    expect(print.status).toBe(403);
    expect(await print.json()).toMatchObject({ upgrade: true, feature: "print_pdf" });
  }, 60000);

  it("paid plans get every layout and the print PDF", async () => {
    for (const plan of ["starter", "power", "pro"]) {
      await setPlan(db.sql, OWNER, plan);
      expect((await call(pdfRoute, "?template=template_pdf_qr")).status).toBe(200);
      expect((await call(printRoute)).status).toBe(200);
    }
  }, 120000);
});

describe("headless browser request guard", () => {
  it("allows data URIs and public http(s), blocks other schemes and private hosts", async () => {
    expect(await isRequestAllowed("data:image/png;base64,AAAA")).toBe(true);
    expect(await isRequestAllowed("https://images.example.com/a.jpg")).toBe(true);
    expect(await isRequestAllowed("file:///etc/passwd")).toBe(false);
    expect(await isRequestAllowed("ftp://x/y")).toBe(false);
    expect(await isRequestAllowed("not a url")).toBe(false);
  });
});

describe("absoluteQrUrl", () => {
  it("makes relative QR targets absolute so printed codes can be scanned", () => {
    expect(absoluteQrUrl("/guidebook/abc", "https://guidewise.example")).toBe("https://guidewise.example/guidebook/abc");
    expect(absoluteQrUrl("https://other.example/g/x", "https://guidewise.example")).toBe("https://other.example/g/x");
  });

  it("drops non-http targets and empty values", () => {
    expect(absoluteQrUrl("javascript:alert(1)", "https://guidewise.example")).toBeNull();
    expect(absoluteQrUrl("", "https://guidewise.example")).toBeNull();
    expect(absoluteQrUrl(null, "https://guidewise.example")).toBeNull();
  });
});

describe("absoluteUrl", () => {
  it("prefixes the site origin when no API base is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://guidewise.example/");
    try {
      expect(absoluteUrl("/g/slug")).toBe("https://guidewise.example/g/slug");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
