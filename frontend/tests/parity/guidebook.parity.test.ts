import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderGuidebookHtml } from "../../src/lib/guidebook/render";
import type { GuidebookRow } from "../../src/lib/guidebook/types";

const FIXTURES = path.join(__dirname, "fixtures");
const GOLDEN = path.join(__dirname, "golden");

// Snapshots of the rendered guidebook pages. They started as the Flask/Jinja output; after the watermark and
// the separately stored "published" copy were removed they are regenerated from the renderer itself
// (UPDATE_GOLDEN=1 npx vitest run tests/parity/guidebook.parity.test.ts) and reviewed in the diff.

// Jinja leaves a single trailing newline off; ignore only that.
const norm = (html: string) => html.replace(/\n$/, "");

function firstDiff(a: string, b: string): string {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  const ctx = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 80), i + 120));
  return `first difference at char ${i}\n  expected: ${ctx(a)}\n  actual:   ${ctx(b)}`;
}

describe("guidebook pages match their snapshots", () => {
  for (const file of fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort()) {
    const name = file.replace(/\.json$/, "");
    const row = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8")) as GuidebookRow;

    it(name, () => {
      const { html } = renderGuidebookHtml(row);
      const goldenPath = path.join(GOLDEN, `${name}.html`);
      if (process.env.UPDATE_GOLDEN) fs.writeFileSync(goldenPath, html);
      const golden = fs.readFileSync(goldenPath, "utf8");
      if (norm(html) !== norm(golden)) {
        throw new Error(`${name} differs from its snapshot: ${firstDiff(norm(golden), norm(html))}`);
      }
      expect(html).not.toMatch(/preview-watermark|Preview Mode/);
    });
  }
});
