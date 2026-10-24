import { describe, expect, it } from "vitest";
import { parseCsv, stripTracking, toCsvLine } from "../src/lib/csv";

describe("csv helpers", () => {
  it("parses quoted fields, doubled quotes, commas and line breaks inside quotes", () => {
    const text = '﻿name,url\r\n"La Casa, Mexico","https://x/?a=1"\n"Say ""hi""",b\n\n"multi\nline",c';
    expect(parseCsv(text)).toEqual([["name", "url"], ["La Casa, Mexico", "https://x/?a=1"], ['Say "hi"', "b"], ["multi\nline", "c"]]);
  });

  it("round-trips through toCsvLine", () => {
    const values = ["plain", "with, comma", 'a "quote"', "line\nbreak", ""];
    expect(parseCsv(toCsvLine(values))).toEqual([values.slice(0, 4).concat([""])]);
  });

  it("strips tracking parameters but keeps the rest of the link", () => {
    expect(stripTracking(" https://www.airbnb.com/rooms/49199028?utm_source=chatgpt.com ")).toBe("https://www.airbnb.com/rooms/49199028");
    expect(stripTracking("https://www.airbnb.com/rooms/1?adults=2&utm_medium=x&fbclid=y")).toBe("https://www.airbnb.com/rooms/1?adults=2");
    expect(stripTracking("not a url")).toBe("not a url");
  });
});
