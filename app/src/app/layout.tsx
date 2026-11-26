import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import Header, { type SearchIndexItem } from "@/components/Header";
import Footer from "@/components/Footer";
import { getStories, getSummary } from "@/lib/data";

export const metadata: Metadata = {
  title: {
    default: "中国数据地图 | China Data Atlas — 权威公开统计研究平台",
    template: "%s | 中国数据地图 China Data Atlas",
  },
  description:
    "基于国家统计局、教育部、国家卫健委等公开官方数据的现代化中国统计研究平台，覆盖44项权威指标、30,220条核验观测、31省份档案、多版本修订归档与跨模型审计。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const summary = getSummary();
  const stories = getStories();

  const searchIndex: SearchIndexItem[] = [
    ...summary.indicators.map((ind) => ({
      type: "indicator" as const,
      id: ind.indicator_id,
      title: ind.name_zh,
      subtitle: `${ind.domain_zh} · ${ind.name_en} (${ind.unit_zh})`,
      href: `/indicators/${ind.indicator_id}`,
      keywords: `${ind.indicator_id} ${ind.short_zh} ${ind.domain_zh} ${ind.domain_en} ${ind.unit_zh}`,
    })),
    ...summary.regions
      .filter((r) => r.geo_code !== "000000")
      .map((reg) => ({
        type: "province" as const,
        id: reg.geo_code,
        title: `${reg.name_zh}（${reg.name_en}）`,
        subtitle: `${reg.macro_region_zh} · ${reg.nbs_economic_zone_zh} · GB/T 2260: ${reg.geo_code}`,
        href: `/provinces/${reg.geo_code}`,
        keywords: `${reg.short_zh} ${reg.capital_zh} ${reg.capital_en} ${reg.iso_3166_2}`,
      })),
    ...stories.map((st) => ({
      type: "story" as const,
      id: st.slug,
      title: st.title_zh,
      subtitle: `${st.tag} · ${st.title_en}`,
      href: `/stories/${st.slug}`,
      keywords: `${st.tag} ${st.relatedIndicators.join(" ")}`,
    })),
  ];

  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col">
        <Header searchIndex={searchIndex} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
