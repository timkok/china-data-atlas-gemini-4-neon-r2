import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://china-data-atlas-gemini-4-neon-r2.vercel.app/sitemap.xml",
  };
}
