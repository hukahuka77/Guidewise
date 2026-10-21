import type { NextConfig } from "next";

// Flask backend (Render). Routes that exist in this Next.js app are served here;
// anything else falls through to Flask until it has been migrated.
const BACKEND_URL = (
  process.env.BACKEND_URL || "https://guidewise.onrender.com"
).replace(/\/$/, "");

const GUIDEBOOK_TEMPLATES = ["./src/templates/guidebook/**/*"];
const PDF_TEMPLATES = ["./src/templates/pdf/**/*"];
// @sparticuz/chromium keeps the (brotli-compressed) browser in its package's bin directory
const CHROMIUM_BIN = ["./node_modules/@sparticuz/chromium/bin/**/*"];
const PDF_ROUTES = {
  "/api/guidebook/[id]/pdf": [
    ...PDF_TEMPLATES,
    ...GUIDEBOOK_TEMPLATES,
    ...CHROMIUM_BIN,
  ],
  "/api/guidebook/[id]/print-pdf": [
    ...PDF_TEMPLATES,
    ...GUIDEBOOK_TEMPLATES,
    ...CHROMIUM_BIN,
  ],
};

const nextConfig: NextConfig = {
  // The guidebook templates are read from disk at runtime, so make sure they ship with the functions.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    // publish renders the guidebook templates inside an API route
    "/api/guidebooks/[id]/publish": GUIDEBOOK_TEMPLATES,
    ...PDF_ROUTES,
    "/g/[slug]": GUIDEBOOK_TEMPLATES,
    "/guidebook/[id]": GUIDEBOOK_TEMPLATES,
    "/preview/[id]": GUIDEBOOK_TEMPLATES,
  },
  async rewrites() {
    return {
      // `fallback` rewrites only apply when no page or route handler matched,
      // so migrated routes automatically take precedence over Flask.
      fallback: [
        { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
        { source: "/g/:slug", destination: `${BACKEND_URL}/g/:slug` },
        { source: "/preview/:id", destination: `${BACKEND_URL}/preview/:id` },
        {
          source: "/guidebook/:id",
          destination: `${BACKEND_URL}/guidebook/:id`,
        },
        {
          source: "/webhooks/:path*",
          destination: `${BACKEND_URL}/webhooks/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
