import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderGuidebookHtml, renderPublishSnapshot } from "../../src/lib/guidebook/render";
import type { GuidebookRow } from "../../src/lib/guidebook/types";

const FIXTURES = path.join(__dirname, "fixtures");
const GOLDEN = path.join(__dirname, "golden");

// Jinja leaves a single trailing newline off; ignore only that.
const norm = (html: string) => html.replace(/\n$/, "");

function firstDiff(a: string, b: string): string {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  const ctx = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 80), i + 120));
  return `first difference at char ${i}\n  expected: ${ctx(a)}\n  actual:   ${ctx(b)}`;
}

describe("Nunjucks guidebook pages match the Flask/Jinja output", () => {
  for (const file of fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort()) {
    const name = file.replace(/\.json$/, "");
    const row = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8")) as GuidebookRow;

    for (const watermark of [false, true]) {
      it(`${name} (watermark=${watermark})`, () => {
        const golden = fs.readFileSync(path.join(GOLDEN, `${name}__wm${Number(watermark)}.html`), "utf8");
        const { html } = renderGuidebookHtml(row, {
          showWatermark: watermark,
          upgradeUrl: "https://www.example.com/pricing",
        });
        if (norm(html) !== norm(golden)) {
          throw new Error(`${name} differs from Flask output: ${firstDiff(norm(golden), norm(html))}`);
        }
        expect(true).toBe(true);
      });
    }
  }
});

describe("Published snapshots match what Flask's publish stored", () => {
  const stems = fs
    .readdirSync(GOLDEN)
    .filter((f) => f.endsWith("__publish.html"))
    .map((f) => f.replace("__publish.html", ""))
    .sort();

  it("has publish goldens to compare", () => {
    expect(stems.length).toBeGreaterThan(0);
  });

  for (const stem of stems) {
    it(stem, () => {
      const row = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${stem}.json`), "utf8")) as GuidebookRow;
      const golden = fs.readFileSync(path.join(GOLDEN, `${stem}__publish.html`), "utf8");
      const { html } = renderPublishSnapshot(row);
      if (norm(html) !== norm(golden)) {
        throw new Error(`${stem} publish snapshot differs from Flask: ${firstDiff(norm(golden), norm(html))}`);
      }
    });
  }
});

