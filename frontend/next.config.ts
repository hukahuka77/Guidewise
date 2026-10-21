import type { NextConfig } from "next";

// Flask backend (Render). Routes that exist in this Next.js app are served here;
// anything else falls through to Flask until it has been migrated.
const BACKEND_URL = (process.env.BACKEND_URL || "https://guidewise.onrender.com").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // `fallback` rewrites only apply when no page or route handler matched,
      // so migrated routes automatically take precedence over Flask.
      fallback: [
        { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
        { source: "/g/:slug", destination: `${BACKEND_URL}/g/:slug` },
        { source: "/preview/:id", destination: `${BACKEND_URL}/preview/:id` },
        { source: "/guidebook/:id", destination: `${BACKEND_URL}/guidebook/:id` },
      ],
    };
  },
};

export default nextConfig;
