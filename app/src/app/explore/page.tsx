import React from "react";
import type { Metadata } from "next";
import { getExploreData, getSummary } from "@/lib/data";
import ExploreClient from "@/components/ExploreClient";

export const metadata: Metadata = {
  title: "高级数据探索器与多指标定制导出",
  description: "跨指标气泡相关性分析（Pearson r）、多省多指标 CAGR 计算与同步长表 CSV 导出。",
};

export default function ExplorePage() {
  const summary = getSummary();
  const explore = getExploreData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
          高级数据探索器（Data Explorer）
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          自由组合 44 项权威统计指标与全国 31 个省份，探索横截面统计相关性、计算多年复合增速（CAGR），并一键导出同步筛选后的 CSV 数据集。
        </p>
      </div>
      <ExploreClient
        regions={summary.regions}
        indicators={summary.indicators}
        explore={explore}
      />
    </div>
  );
}
