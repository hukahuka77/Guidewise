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

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];
// Only this site may frame its pages (stops clickjacking on login, billing and the editor). Guest
// guidebooks stay embeddable so hosts can put them on their own websites.
const NO_FRAMING = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

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
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/((?!g/|guidebook/).*)", headers: NO_FRAMING },
      // The editor's phone preview is a sandboxed (origin "null") frame; without this its fonts are blocked
      { source: "/fonts/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
  async redirects() {
    // The old template picker; the editor now switches styles itself
    return [
      { source: "/dashboard/url/:id", destination: "/edit/:id", permanent: false },
      // The PDF layouts page; the dashboard's "Download print version" replaces it
      { source: "/dashboard/pdf/:id", destination: "/dashboard", permanent: false },
      // The outreach tool moved into the dashboard's Admin tab
      { source: "/admin/outreach", destination: "/dashboard/admin", permanent: false },
    ];
  },
};

export default nextConfig;
