import { describe, expect, it } from "vitest";
import { GET } from "../src/app/sample-guidebook/route";
import { ALLOWED_TEMPLATE_KEYS } from "../src/lib/server/guidebookService";

describe("sample guidebook (the phone on the start screen)", () => {
  it("renders in every style, is public, never indexed, and contains no real person's data", async () => {
    for (const key of ALLOWED_TEMPLATE_KEYS) {
      const res = GET(new Request(`https://example.com/sample-guidebook?template=${key}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
      expect(res.headers.get("Cache-Control")).toContain("public");
      const html = await res.text();
      expect(html).toContain("Willow Cottage");
      expect(html).toContain("Riverside Trail");
    }
  });

  it("falls back to the default style for an unknown one", async () => {
    const res = GET(new Request("https://example.com/sample-guidebook?template=nope"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Willow Cottage");
  });
});
