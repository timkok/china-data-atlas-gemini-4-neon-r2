import React from "react";
import type { Metadata } from "next";
import { getSummary } from "@/lib/data";
import IndicatorsDirectoryClient from "@/components/IndicatorsDirectoryClient";

export const metadata: Metadata = {
  title: "44 项官方统计指标目录",
  description: "按五大主题浏览中国数据地图全部 44 项官方统计指标（12 项核心指标 + 32 项 Round 2 扩展指标）。",
};

export default async function IndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const sp = await searchParams;
  const summary = getSummary();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
          官方统计指标目录（{summary.indicators.length} 项）
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          涵盖人口与社会、经济与财政、教育与科创、医疗卫生、能源环境与基建五大领域；保留 Round 1 全部 12 项核心指标并新增 32 项高价值指标（含本专科与研究生口径拆分）。
        </p>
      </div>
      <IndicatorsDirectoryClient
        indicators={summary.indicators}
        initialDomain={sp.domain || "all"}
      />
    </div>
  );
}
