import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addressLine, contactLinks, formatTime12, guideSections } from "../src/lib/guidebook/format";
import { DEFAULT_TEMPLATE_KEY, FALLBACK_TEMPLATE_KEY, SELECTABLE_TEMPLATE_KEYS, renderGuidebookHtml, resolveTemplateKey } from "../src/lib/guidebook/render";
import { sampleGuidebook } from "../src/lib/guidebook/sample";
import type { GuidebookRow } from "../src/lib/guidebook/types";

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "parity", "fixtures", `${name}.json`), "utf8")) as GuidebookRow;

describe("template defaults", () => {
  it("uses Signature for new guidebooks and no longer offers Classic", () => {
    expect(DEFAULT_TEMPLATE_KEY).toBe("template_signature");
    expect(SELECTABLE_TEMPLATE_KEYS[0]).toBe("template_signature");
    expect(SELECTABLE_TEMPLATE_KEYS).not.toContain("template_original");
  });

  it("keeps rendering Classic for guidebooks on Classic, or with a missing or unknown key", () => {
    expect(resolveTemplateKey("template_original")).toBe("template_original");
    expect(resolveTemplateKey(null)).toBe(FALLBACK_TEMPLATE_KEY);
    expect(resolveTemplateKey("template_gone")).toBe("template_original");
  });
});

describe("format helpers", () => {
  it("formats 24h times as 12h and leaves free text alone", () => {
    expect(formatTime12("15:00")).toBe("3:00 PM");
    expect(formatTime12("09:30:00")).toBe("9:30 AM");
    expect(formatTime12("00:15")).toBe("12:15 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatTime12("after 4pm")).toBe("after 4pm");
    expect(formatTime12(null)).toBe("");
  });

  it("turns a contact line into call, text and email links", () => {
    expect(contactLinks("(555) 123-4567 · alex@example.com")).toEqual([
      { kind: "call", label: "Call", href: "tel:5551234567" },
      { kind: "text", label: "Text", href: "sms:5551234567" },
      { kind: "email", label: "Email", href: "mailto:alex@example.com" },
    ]);
    expect(contactLinks("+44 20 7946 0958")[0].href).toBe("tel:+442079460958");
    expect(contactLinks("Message me on Airbnb")).toEqual([]);
    expect(contactLinks("Room 12")).toEqual([]);
  });

  it("joins the address parts", () => {
    expect(addressLine({ street: "1 Main St", city_state: "Austin, TX", zip: "78701" })).toBe("1 Main St, Austin, TX 78701");
    expect(addressLine({ street: "1 Main St", city_state: null, zip: null })).toBe("1 Main St");
    expect(addressLine(undefined)).toBe("");
  });

  it("lists sections in the host's order, numbered, skipping empty ones", () => {
    const sections = guideSections({
      included_tabs: ["checkout", "welcome", "food", "custom_pool", "custom_empty", "rules"],
      welcome_message: "Hi",
      check_out_time: "11:00",
      places_to_eat: undefined,
      rules: [{ name: "No parties" }],
      custom_sections: { custom_pool: [{ type: "text", content: "Pool opens at 9" }], custom_empty: [{ type: "text", content: "  " }] },
      custom_tabs_meta: { custom_pool: { label: "Pool", icon: "🏊" } },
    });
    expect(sections.map((s) => [s.key, s.num])).toEqual([["checkout", "01"], ["welcome", "02"], ["custom_pool", "03"], ["rules", "04"]]);
    expect(sections[2]).toMatchObject({ label: "Pool", emoji: "🏊", icon: null });
  });
});

describe("Signature template", () => {
  const html = renderGuidebookHtml(fixture("full_signature")).html;

  it("is self-contained: no CSS, script or font CDNs", () => {
    for (const host of ["cdn.tailwindcss.com", "unpkg.com", "fonts.googleapis.com", "jsdelivr"]) expect(html).not.toContain(host);
    expect(html).toContain("/fonts/guidebook/inter-latin-400-normal.woff2");
  });

  it("puts Wi-Fi with a copy button, check-in and check-out up top", () => {
    const top = html.slice(0, html.indexOf('class="tabs"'));
    expect(top).toContain("HomeNet");
    expect(top).toContain('data-copy="p@ss word!"');
    expect(top).toMatch(/Check-in<\/span><span class="tile-value">/);
  });

  it("renders the sections in the host's order, including custom sections", () => {
    const ids = [...html.matchAll(/<section class="sec" id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids[0]).toBe("welcome");
    expect(ids).toContain("custom_pets");
    expect(ids.indexOf("rules")).toBeLessThan(ids.indexOf("checkout"));
  });

  it("escapes guidebook content", () => {
    const row = fixture("full_signature");
    row.welcome_info = "<script>alert(1)</script> Hi";
    const out = renderGuidebookHtml(row).html;
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders the start-screen sample without errors and with a checkout checklist", () => {
    const out = renderGuidebookHtml(sampleGuidebook()).html;
    expect(out).toContain("Willow Cottage");
    expect(out).toContain("data-checklist=");
    expect(out).toContain("3:00 PM");
  });

  it("still renders a guidebook with almost nothing filled in", () => {
    const out = renderGuidebookHtml({ ...fixture("minimal_original"), template_key: "template_signature" }).html;
    expect(out).toContain("<h1>");
    expect(out).toContain("Have a wonderful stay.");
  });
});
