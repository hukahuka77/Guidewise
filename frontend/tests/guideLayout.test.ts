import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { htmlToPdf } from "../src/lib/pdf/browser";
import { buildGuideModel, stripEmoji } from "../src/lib/pdf/guide/model";
import { renderGuide, type PageSize } from "../src/lib/pdf/guide/render";
import type { GuidePlan } from "../src/lib/pdf/guide/compose";
import type { ThemeKey } from "../src/lib/pdf/guide/themes";
import type { GuidebookRow } from "../src/lib/guidebook/types";

// Renders real PDFs in headless Chromium and checks the layout from the extracted text of each page:
// no blank pages, headings never stranded from their first card, cards never split across pages.

// pdfjs needs Promise.withResolvers (Node 22+); CI runs Node 20.
if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== "function") {
  (Promise as unknown as { withResolvers: () => unknown }).withResolvers = function () {
    let resolve!: (v: unknown) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

const resolver = { photoReference: async () => null, findPlaceId: async () => null, photoUrl: (r: string) => r };
const FIXTURES = path.join(__dirname, "parity", "fixtures");
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8")) as GuidebookRow;

/** A guidebook big enough to force many page breaks. */
function stress(): GuidebookRow {
  const base = fixture("full_welcomebook");
  const place = (i: number, kind: string) => ({
    name: `${kind} Place Number ${i}`,
    description: `Description for ${kind} place ${i}. `.repeat(4 + (i % 5)),
    address: `${100 + i} Example Street, Austin, TX`,
    image_url: "",
    place_id: "",
    driving_minutes: 5 + i,
  });
  return {
    ...base,
    id: "stress",
    rules_json: Array.from({ length: 28 }, (_, i) => ({ name: `Rule number ${i}`, description: `Please follow rule ${i} during your stay. `.repeat(1 + (i % 3)) })),
    house_manual: Array.from({ length: 16 }, (_, i) => ({ name: `Manual item ${i}`, description: `How to use thing ${i}.\nSecond line of detail for item ${i}. `.repeat(1 + (i % 4)) })),
    places_to_eat: Array.from({ length: 11 }, (_, i) => place(i, "Eat")),
    things_to_do: Array.from({ length: 13 }, (_, i) => place(i, "Do")),
    checkout_info: Array.from({ length: 9 }, (_, i) => ({ name: `Checkout step ${i}`, description: `Do thing ${i} before you leave.` })),
  } as unknown as GuidebookRow;
}

async function pageTexts(pdf: Buffer): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(norm(content.items.map((it) => ("str" in it ? it.str : "")).join(" ")));
  }
  return pages;
}

// Letter-spaced labels come out of the PDF as "c h e c k", so compare with all whitespace removed
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function lintLayout(pages: string[], keepTogether: [string, string][], title = "") {
  const problems: string[] = [];
  pages.forEach((t, i) => {
    if (i === 0) return; // the cover is mostly the title
    // the running footer (title and page number) does not count as content
    const content = t.split(norm(title)).join("").replace(/\d+/g, "");
    if (content.length < 12) problems.push(`page ${i + 1} is blank`);
  });
  for (const [a, b] of keepTogether) {
    const A = norm(a);
    const B = norm(b);
    // headings also appear in the contents page, so compare against the last page that has the heading text
    const aPages = pages.map((t, i) => (t.includes(A) ? i : -1)).filter((i) => i >= 0);
    if (aPages.length === 0) {
      problems.push(`"${a}" not found in the PDF`);
      continue;
    }
    if (!aPages.some((p) => pages[p].includes(B))) problems.push(`"${a}" and "${b}" ended up on different pages (${aPages.map((p) => p + 1).join(",")})`);
  }
  return problems;
}

const CASES: { name: string; row: () => GuidebookRow; themes: ThemeKey[]; sizes: PageSize[] }[] = [
  { name: "full_welcomebook", row: () => fixture("full_welcomebook"), themes: ["welcomebook", "classic", "minimal"], sizes: ["letter", "a4"] },
  { name: "full_original", row: () => fixture("full_original"), themes: ["welcomebook"], sizes: ["letter"] },
  { name: "pdf_edge_cases", row: () => fixture("pdf_edge_cases"), themes: ["classic", "minimal"], sizes: ["letter"] },
  { name: "minimal_original", row: () => fixture("minimal_original"), themes: ["welcomebook", "minimal"], sizes: ["letter"] },
  { name: "filtered_tabs_generic", row: () => fixture("filtered_tabs_generic"), themes: ["classic"], sizes: ["letter"] },
  { name: "stress", row: stress, themes: ["welcomebook", "classic", "minimal"], sizes: ["letter", "a4"] },
];

describe("guide PDF layout", () => {
  for (const c of CASES) {
    for (const theme of c.themes) {
      for (const size of c.sizes) {
        it(`${c.name} / ${theme} / ${size}`, async () => {
          const model = await buildGuideModel(c.row(), resolver);
          const { html, keepTogether, sections } = renderGuide(model, { theme, pageSize: size });
          const pages = await pageTexts(await htmlToPdf(html));
          expect(pages.length).toBeGreaterThan(1);
          expect(pages[0]).toContain(norm(model.title));
          for (const title of sections) expect(pages.join(" ")).toContain(norm(title));
          expect(lintLayout(pages, keepTogether, model.title)).toEqual([]);
        }, 120000);
      }
    }
  }

  const plan: GuidePlan = {
    theme: "classic",
    tagline: "A calm place to land",
    welcome: "Welcome, and thank you for choosing our home for your stay.",
    highlights: ["Self check-in keeps arrival easy", "Quiet hours keep the neighbors happy", "Great food is a short drive away"],
    order: ["eat", "do", "rules", "manual", "arrival", "welcome", "checkout"],
    sections: {
      rules: { title: "Ground Rules", blurb: "A few simple things that keep everyone comfortable." },
      eat: { title: "Where to Eat", blurb: "Our favorite spots nearby." },
    },
  };

  for (const name of ["full_welcomebook", "stress"] as const) {
    it(`an AI plan (${name}): renames, reorders and adds intros without breaking the layout`, async () => {
      const row = name === "stress" ? stress() : fixture(name);
      const model = await buildGuideModel(row, resolver);
      const { html, keepTogether, sections } = renderGuide(model, { theme: plan.theme, plan });
      const pages = await pageTexts(await htmlToPdf(html));
      const all = pages.join(" ");
      expect(sections[0]).toBe("Welcome"); // Welcome stays first even though the plan put it later
      expect(sections[sections.length - 1]).toBe("Checkout"); // and Checkout stays last
      expect(sections).toContain("Where to Eat");
      expect(sections).toContain("Ground Rules");
      expect(sections).not.toContain("House Rules");
      expect(sections.indexOf("Where to Eat")).toBeLessThan(sections.indexOf("Ground Rules"));
      for (const text of [plan.tagline!, plan.welcome!, ...plan.highlights, plan.sections.rules.blurb!, "Good to know"]) {
        expect(all).toContain(norm(text));
      }
      expect(lintLayout(pages, keepTogether, model.title)).toEqual([]);
    }, 120000);
  }

  it("a plan that is null or empty renders exactly like no plan", async () => {
    const model = await buildGuideModel(fixture("full_welcomebook"), resolver);
    const base = renderGuide(model, { theme: "welcomebook" }).html;
    expect(renderGuide(model, { theme: "welcomebook", plan: null }).html).toBe(base);
    expect(renderGuide(model, { theme: "welcomebook", plan: { theme: "welcomebook", highlights: [], order: [], sections: {} } }).html).toBe(base);
  });

  it("an empty guidebook still gets a content page", async () => {
    const empty = { ...fixture("minimal_original"), included_tabs: ["welcome"], welcome_info: null, host: null } as unknown as GuidebookRow;
    const model = await buildGuideModel(empty, resolver);
    const { html } = renderGuide(model, { theme: "welcomebook" });
    const pages = await pageTexts(await htmlToPdf(html));
    expect(pages.join(" ")).toContain(norm("We hope you have a wonderful stay"));
    expect(lintLayout(pages, [], model.title)).toEqual([]);
  }, 60000);

  it("emoji are removed from PDF text (no emoji font on the server) but ordinary text and URLs are untouched", async () => {
    expect(stripEmoji("Pets 🐶 welcome 👨‍👩‍👧 ❤️ 🇺🇸 ok")).toBe("Pets welcome ok");
    expect(stripEmoji("Café – 7 min drive")).toBe("Café – 7 min drive");
    const row = { ...fixture("full_original"), cover_image_url: "https://example.com/a🐶.jpg" } as unknown as GuidebookRow;
    const model = await buildGuideModel(row, resolver);
    expect(model.custom.map((c) => c.title)).toContain("Pets");
    expect(model.coverUrl).toBe("https://example.com/a🐶.jpg");
    expect(JSON.stringify(model.custom)).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("the linter itself catches a stranded heading and a blank page", () => {
    const pages = ["cover title", "contents house guide", "house guide", "first card text more", "  "].map(norm);
    const problems = lintLayout(pages, [["House Guide", "First card text"]], "cover title");
    expect(problems.some((p) => p.includes("different pages"))).toBe(true);
    expect(problems.some((p) => p.includes("blank"))).toBe(true);
  });
});
