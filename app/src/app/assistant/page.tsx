import React from "react";
import type { Metadata } from "next";
import { getExploreData, getSummary } from "@/lib/data";
import AssistantClient from "@/components/AssistantClient";

export const metadata: Metadata = {
  title: "统计研究查询引擎 (Research Query Engine)",
  description: "规则化、确定性中国官方统计查询工具，透明输出计算公式、交互图表与官方出处。",
};

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const summary = getSummary();
  const explore = getExploreData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
          统计研究查询引擎（Research Query Engine）
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          基于确定性规则与公式即时检索并计算 44 项官方统计指标（2000–2025），拒绝虚构预测与无源数值。
        </p>
      </div>
      <AssistantClient
        regions={summary.regions}
        indicators={summary.indicators}
        explore={explore}
        initialQuery={sp.q ?? ""}
      />
    </div>
  );
}
