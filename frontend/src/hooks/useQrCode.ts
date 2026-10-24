"use client";

import { useEffect, useState } from "react";
import { qrSvgDataUrl } from "@/lib/qr";

/** An SVG QR code for `text` (null until it's drawn, or when there's nothing to encode). */
export function useQrCode(text: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    if (!text) return;
    qrSvgDataUrl(text).then((url) => !cancelled && setSrc(url), () => {});
    return () => {
      cancelled = true;
    };
  }, [text]);
  return src;
}
