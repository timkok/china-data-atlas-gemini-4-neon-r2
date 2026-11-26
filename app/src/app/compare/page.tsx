import React from "react";
import type { Metadata } from "next";
import { getExploreData, getSummary } from "@/lib/data";
import CompareClient from "@/components/CompareClient";

export const metadata: Metadata = {
  title: "多省份横向对比工作台",
  description: "同时对比 2–5 个中国省级行政区的人口、GDP、居民收入、城镇化、老龄化、教育与医疗指标。",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ provs?: string }>;
}) {
  const sp = await searchParams;
  const summary = getSummary();
  const explore = getExploreData();
  const validCodes = new Set(summary.regions.map((r) => r.geo_code));
  const initialCodes = (sp.provs ?? "440000,320000,330000")
    .split(",")
    .map((s) => s.trim())
    .filter((c) => validCodes.has(c) && c !== "000000");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
          多省份横向对比工作台
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          支持选择 2–5 个省份进行跨领域对齐对比（默认加载广东、江苏、浙江），自动匹配最新共同可比年份，杜绝跨年份混比。
        </p>
      </div>
      <CompareClient
        regions={summary.regions}
        indicators={summary.indicators}
        explore={explore}
        initialCodes={initialCodes}
      />
    </div>
  );
}
