/**
 * Phone photos are often 4-12 MB and far larger than a guidebook ever shows them. Before uploading, big
 * photos are scaled down to fit MAX_EDGE on their long side and saved as JPEG (PNG when they have see-through
 * parts). The original is kept whenever that wouldn't make it smaller, or anything goes wrong.
 */

export const MAX_EDGE = 2400;
export const MAX_BYTES = 1.5 * 1024 * 1024;
export const JPEG_QUALITY = 0.82;

/** Still images the browser can redraw. Not GIFs (they may move) or SVGs (they scale anyway). */
export function isCompressibleType(type: string): boolean {
  return type.startsWith("image/") && type !== "image/gif" && type !== "image/svg+xml";
}

/** Whether an image is big enough, in bytes or pixels, to be worth re-encoding. */
export function needsCompression(bytes: number, width: number, height: number): boolean {
  return bytes > MAX_BYTES || Math.max(width, height) > MAX_EDGE;
}

/** The size that fits within `maxEdge` on the long side, keeping the shape. Never scales up. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const scale = maxEdge / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** True when any pixel in RGBA data is not fully opaque. */
export function hasTransparency(rgba: ArrayLike<number>): boolean {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) return true;
  return false;
}

/** The file name with the extension that matches the new type ("IMG_1.HEIC" -> "IMG_1.jpg"). */
export function renameFor(name: string, type: string): string {
  const ext = type === "image/png" ? "png" : "jpg";
  const base = name.replace(/\.[^./\\]+$/, "") || "photo";
  return `${base}.${ext}`;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

/** Decodes the photo upright (phones store sideways pixels plus an EXIF rotation). */
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Older browsers reject the options or the format: try an <img>, which also applies EXIF rotation
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A smaller copy of a big photo for uploading, or the file itself when that isn't possible or worthwhile. */
export async function compressImage(file: File): Promise<File> {
  if (!isCompressibleType(file.type) || typeof document === "undefined") return file;
  try {
    const image = await decode(file);
    try {
      if (!needsCompression(file.size, image.width, image.height)) return file;
      const { width, height } = fitWithin(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(image.source, 0, 0, width, height);

      // See-through parts would turn black in a JPEG; a small copy is enough to find them
      let type = "image/jpeg";
      if (file.type !== "image/jpeg") {
        const probe = document.createElement("canvas");
        const small = fitWithin(width, height, 256);
        probe.width = small.width;
        probe.height = small.height;
        const probeCtx = probe.getContext("2d");
        if (!probeCtx) return file;
        probeCtx.drawImage(canvas, 0, 0, small.width, small.height);
        if (hasTransparency(probeCtx.getImageData(0, 0, small.width, small.height).data)) type = "image/png";
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], renameFor(file.name, type), { type, lastModified: file.lastModified });
    } finally {
      image.close();
    }
  } catch (err) {
    console.warn("Image compression skipped:", err);
    return file;
  }
}
