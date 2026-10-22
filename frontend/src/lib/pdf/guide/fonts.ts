import fs from "node:fs";
import path from "node:path";

// Fonts are bundled (not taken from whatever the server has installed) so PDFs look the same everywhere.
// Latin subsets only; each file is ~24 KB.
const FONT_FILES: { family: string; weight: number; pkg: string; file: string }[] = [
  { family: "Inter", weight: 400, pkg: "@fontsource/inter", file: "inter-latin-400-normal.woff2" },
  { family: "Inter", weight: 600, pkg: "@fontsource/inter", file: "inter-latin-600-normal.woff2" },
  { family: "Inter", weight: 700, pkg: "@fontsource/inter", file: "inter-latin-700-normal.woff2" },
  { family: "Playfair Display", weight: 600, pkg: "@fontsource/playfair-display", file: "playfair-display-latin-600-normal.woff2" },
  { family: "Playfair Display", weight: 700, pkg: "@fontsource/playfair-display", file: "playfair-display-latin-700-normal.woff2" },
];

let cached: string | null = null;

/** `@font-face` rules with the font data inlined as base64. */
export function fontFaceCss(): string {
  if (cached) return cached;
  cached = FONT_FILES.map(({ family, weight, pkg, file }) => {
    const data = fs.readFileSync(path.join(process.cwd(), "node_modules", pkg, "files", file)).toString("base64");
    return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");}`;
  }).join("\n");
  return cached;
}
