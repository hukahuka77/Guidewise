import QRCode from "qrcode";

// QR codes are drawn here, in the browser or on the server, so a guidebook's link is never sent to a
// third-party QR service.

const OPTIONS = { errorCorrectionLevel: "M", margin: 1 } as const;

/** A QR code as an SVG data URL: sharp at any size, for pages and PDFs. */
export async function qrSvgDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { ...OPTIONS, type: "svg" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A QR code as a PNG data URL, for downloading and printing. */
export function qrPngDataUrl(text: string, width = 800): Promise<string> {
  return QRCode.toDataURL(text, { ...OPTIONS, margin: 2, width });
}
