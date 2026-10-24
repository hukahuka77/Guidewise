import { describe, expect, it } from "vitest";
import { qrPngDataUrl, qrSvgDataUrl } from "../src/lib/qr";
import { qrImageSrc } from "../src/lib/pdf/context";

describe("QR codes are drawn locally", () => {
  it("makes an SVG data URL for pages and PDFs, and none without a link", async () => {
    const svg = await qrSvgDataUrl("https://www.guidewiseapp.com/guidebook/abc");
    expect(svg.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(svg)).toContain("<svg");
    expect(await qrImageSrc("https://www.guidewiseapp.com/guidebook/abc")).toBe(svg);
    expect(await qrImageSrc(null)).toBeNull();
  });

  it("makes a PNG data URL for downloads", async () => {
    expect((await qrPngDataUrl("https://www.guidewiseapp.com/guidebook/abc", 400)).startsWith("data:image/png;base64,")).toBe(true);
  });
});
