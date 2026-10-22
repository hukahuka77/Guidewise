import type { MetadataRoute } from "next";

// Marketing pages can be indexed. Guidebooks (door codes, Wi-Fi passwords), the app and the API cannot.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/g/", "/guidebook/", "/api/", "/dashboard", "/edit/", "/onboarding", "/success", "/sample-guidebook"] },
  };
}
