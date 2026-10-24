import { describe, expect, it } from "vitest";
import { MAX_BYTES, compressImage, fitWithin, hasTransparency, isCompressibleType, needsCompression, renameFor } from "../src/utils/compressImage";

describe("image compression helpers", () => {
  it("only redraws still images", () => {
    expect(isCompressibleType("image/jpeg")).toBe(true);
    expect(isCompressibleType("image/png")).toBe(true);
    expect(isCompressibleType("image/webp")).toBe(true);
    expect(isCompressibleType("image/gif")).toBe(false);
    expect(isCompressibleType("image/svg+xml")).toBe(false);
    expect(isCompressibleType("video/mp4")).toBe(false);
    expect(isCompressibleType("")).toBe(false);
  });

  it("compresses when the file is heavy or the picture is large", () => {
    expect(needsCompression(MAX_BYTES + 1, 800, 600)).toBe(true);
    expect(needsCompression(200_000, 4032, 3024)).toBe(true);
    expect(needsCompression(200_000, 1200, 2401)).toBe(true);
    expect(needsCompression(MAX_BYTES, 2400, 1800)).toBe(false);
  });

  it("fits the long edge, keeps the shape and never scales up", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1800, height: 2400 });
    expect(fitWithin(6000, 1000)).toEqual({ width: 2400, height: 400 });
    expect(fitWithin(1200, 900)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(10000, 1)).toEqual({ width: 2400, height: 1 });
    expect(fitWithin(1000, 500, 256)).toEqual({ width: 256, height: 128 });
  });

  it("spots any see-through pixel", () => {
    expect(hasTransparency([10, 20, 30, 255, 0, 0, 0, 255])).toBe(false);
    expect(hasTransparency([10, 20, 30, 255, 0, 0, 0, 254])).toBe(true);
    expect(hasTransparency([])).toBe(false);
  });

  it("names the file after its new type", () => {
    expect(renameFor("IMG_0001.HEIC", "image/jpeg")).toBe("IMG_0001.jpg");
    expect(renameFor("logo.png", "image/png")).toBe("logo.png");
    expect(renameFor("my.photo.webp", "image/jpeg")).toBe("my.photo.jpg");
    expect(renameFor("noext", "image/jpeg")).toBe("noext.jpg");
    expect(renameFor(".png", "image/jpeg")).toBe("photo.jpg");
  });

  it("hands back the original file when it can't redraw it", async () => {
    const gif = new File([new Uint8Array(10)], "a.gif", { type: "image/gif" });
    expect(await compressImage(gif)).toBe(gif);
    // No DOM in this environment: the photo is uploaded as it is
    const photo = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
    expect(await compressImage(photo)).toBe(photo);
  });
});
