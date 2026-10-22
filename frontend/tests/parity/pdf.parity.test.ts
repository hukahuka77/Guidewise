import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPdfContext, buildPrintContext } from "../../src/lib/pdf/context";
import type { PhotoResolver } from "../../src/lib/pdf/recommendations";
import { renderPdfHtml, renderPrintHtml, resolvePdfTemplate, resolvePrintTemplate } from "../../src/lib/pdf/render";
import type { GuidebookRow } from "../../src/lib/guidebook/types";

const GOLDEN = path.join(__dirname, "golden_pdf");
const INPUTS = path.join(GOLDEN, "_inputs");
const norm = (html: string) => html.replace(/\n$/, "");

// Same stubs as generate_pdf_goldens.py
const resolver: PhotoResolver = {
  async photoReference(placeId) {
    if (placeId === "ChIJfail") throw new Error("lookup failed");
    if (placeId.startsWith("ChIJnone")) return null;
    return `REF_${placeId}`;
  },
  async findPlaceId(query) {
    return query.includes("NoMatch") ? null : "FOUND";
  },
  photoUrl: (ref) => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=testkey`,
};
const QR_URL = "https://www.example.com/g/my-place?x=1&y=(2)";

function firstDiff(a: string, b: string): string {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  const ctx = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 100), i + 140));
  return `first difference at char ${i}\n  expected: ${ctx(a)}\n  actual:   ${ctx(b)}`;
}

const goldens = fs.readdirSync(GOLDEN).filter((f) => f.endsWith(".html")).sort();
// Fixtures with unpaired surrogates have no goldens: WeasyPrint itself cannot encode them.

describe("Nunjucks PDF HTML matches what Flask handed to WeasyPrint", () => {
  it("has goldens", () => expect(goldens.length).toBeGreaterThan(50));

  for (const file of goldens) {
    const [stem, kind, qr] = file.replace(/\.html$/, "").split("__");
    const row = JSON.parse(fs.readFileSync(path.join(INPUTS, `${stem}.json`), "utf8")) as GuidebookRow;

    it(file, async () => {
      const golden = fs.readFileSync(path.join(GOLDEN, file), "utf8");
      let html: string;
      if (kind === "print") {
        const key = resolvePrintTemplate(row.template_key);
        // Flask printed each rule's dict repr on the non-welcomebook layouts; we print text instead
        if (key !== "template_welcomebook" && Array.isArray(row.rules_json) && row.rules_json.some((r) => typeof r === "object")) {
          return;
        }
        html = renderPrintHtml(key, await buildPrintContext(row, resolver, { rawRules: key === "template_welcomebook" }));
      } else {
        const ctx = await buildPdfContext(row, resolver, { qrUrl: qr ? QR_URL : null });
        html = renderPdfHtml(resolvePdfTemplate(kind), ctx);
      }
      if (norm(html) !== norm(golden)) throw new Error(`${file} differs from Flask output: ${firstDiff(norm(golden), norm(html))}`);
      expect(true).toBe(true);
    });
  }
});
