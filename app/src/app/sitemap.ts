import type { MetadataRoute } from "next";
import { getAllIndicatorIds, getAllProvinceCodes, getStories } from "@/lib/data";

const BASE = "https://china-data-atlas-gemini-4-neon-r2.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/indicators",
    "/provinces",
    "/compare",
    "/explore",
    "/stories",
    "/assistant",
    "/audit",
    "/methodology",
  ].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date("2026-11-25"),
  }));

  const indRoutes = getAllIndicatorIds().map((id) => ({
    url: `${BASE}/indicators/${id}`,
    lastModified: new Date("2026-11-25"),
  }));

  const provRoutes = getAllProvinceCodes().map((code) => ({
    url: `${BASE}/provinces/${code}`,
    lastModified: new Date("2026-11-25"),
  }));

  const storyRoutes = getStories().map((s) => ({
    url: `${BASE}/stories/${s.slug}`,
    lastModified: new Date("2026-11-25"),
  }));

  return [...staticRoutes, ...indRoutes, ...provRoutes, ...storyRoutes];
}
