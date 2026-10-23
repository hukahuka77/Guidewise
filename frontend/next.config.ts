import type { NextConfig } from "next";

const GUIDEBOOK_TEMPLATES = ["./src/templates/guidebook/**/*"];
const PDF_TEMPLATES = ["./src/templates/pdf/**/*"];
// @sparticuz/chromium keeps the (brotli-compressed) browser in its package's bin directory
const CHROMIUM_BIN = ["./node_modules/@sparticuz/chromium/bin/**/*"];
// Bundled PDF fonts are read from disk at runtime
const PDF_FONTS = [
  "./node_modules/@fontsource/inter/files/inter-latin-*-normal.woff2",
  "./node_modules/@fontsource/playfair-display/files/playfair-display-latin-*-normal.woff2",
];
const PDF_ROUTES = {
  "/api/guidebook/[id]/pdf": [
    ...PDF_TEMPLATES,
    ...GUIDEBOOK_TEMPLATES,
    ...PDF_FONTS,
    ...CHROMIUM_BIN,
  ],
  "/api/guidebook/[id]/print-pdf": [
    ...PDF_TEMPLATES,
    ...GUIDEBOOK_TEMPLATES,
    ...PDF_FONTS,
    ...CHROMIUM_BIN,
  ],
};

const nextConfig: NextConfig = {
  // The guidebook templates are read from disk at runtime, so make sure they ship with the functions.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    ...PDF_ROUTES,
    // the editor's live preview renders the guidebook templates inside an API route
    "/api/guidebooks/[id]/html": GUIDEBOOK_TEMPLATES,
    "/sample-guidebook": GUIDEBOOK_TEMPLATES,
    "/g/[slug]": GUIDEBOOK_TEMPLATES,
    "/guidebook/[id]": GUIDEBOOK_TEMPLATES,
  },
  async redirects() {
    // The old template picker; the editor now switches styles itself
    return [
      { source: "/dashboard/url/:id", destination: "/edit/:id", permanent: false },
      // The PDF layouts page; the dashboard's "Download print version" replaces it
      { source: "/dashboard/pdf/:id", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
