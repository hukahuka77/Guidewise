import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { googlePhotoReference, placePhotoUrl } from "../../src/lib/guidebook/placePhotos";
import { jinjaTitle, jinjaUrlencode } from "../../src/lib/guidebook/pyCompat";
import { normalizeRules, rulesAsText } from "../../src/lib/guidebook/rules";

type Case<I, E> = { input: I; expected: E };
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "unit_expectations.json"), "utf8")) as {
  place_photo_url: Case<unknown, string>[];
  google_photo_reference: Case<string, string>[];
  urlencode: Case<string, string>[];
  title: Case<string, string>[];
  normalize_rules: Case<unknown, unknown>[];
  rules_as_text: Case<unknown, string[]>[];
};

describe("TypeScript helpers match the Python originals", () => {
  it.each(data.place_photo_url.map((c, i) => [i, c] as const))("place_photo_url case %i", (_i, c) => {
    expect(placePhotoUrl(c.input)).toBe(c.expected);
  });
  it.each(data.google_photo_reference.map((c, i) => [i, c] as const))("google_photo_reference case %i", (_i, c) => {
    expect(googlePhotoReference(c.input)).toBe(c.expected);
  });
  it.each(data.urlencode.map((c, i) => [i, c] as const))("jinja urlencode case %i", (_i, c) => {
    expect(jinjaUrlencode(c.input)).toBe(c.expected);
  });
  it.each(data.title.map((c, i) => [i, c] as const))("jinja title case %i", (_i, c) => {
    expect(jinjaTitle(c.input)).toBe(c.expected);
  });
  it.each(data.normalize_rules.map((c, i) => [i, c] as const))("normalize_rules case %i", (_i, c) => {
    expect(normalizeRules(c.input)).toEqual(c.expected);
  });
  it.each(data.rules_as_text.map((c, i) => [i, c] as const))("rules_as_text case %i", (_i, c) => {
    expect(rulesAsText(c.input)).toEqual(c.expected);
  });
});
