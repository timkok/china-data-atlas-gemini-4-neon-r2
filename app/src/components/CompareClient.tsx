"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Download, GitCompare } from "lucide-react";
import type { EChartsCoreOption } from "echarts/core";
import LazyChart from "./LazyChart";
import {
  buildCsv,
  computeIndexed,
  downloadTextFile,
  formatNum,
} from "@/lib/analytics";
import type { ExploreData, IndicatorSummary, RegionMeta } from "@/lib/types";

const COMPARE_CORE_IDS = [
  "population",
  "gdp",
  "gdp_per_capita",
  "disposable_income",
  "urban_rural_income_ratio",
  "retail_sales",
  "urbanization_rate",
  "birth_rate",
  "population_65plus",
  "higher_education_students",
  "physicians_per_1000",
  "hospital_beds_per_1000",
  "rd_expenditure_industrial",
  "electricity_consumption",
];

const PRESETS = [
  { label: "粤苏浙 (默认)", codes: ["440000", "320000", "330000"] },
  { label: "京沪津渝 (直辖市)", codes: ["110000", "310000", "120000", "500000"] },
  { label: "东北三省", codes: ["210000", "220000", "230000"] },
  { label: "粤苏鲁浙川 (前五经济大省)", codes: ["440000", "320000", "370000", "330000", "510000"] },
];

const COLORS = ["#0F2942", "#B83A2D", "#1E6B52", "#D97706", "#6B46C1"];

export default function CompareClient({
  regions,
  indicators,
  explore,
  initialCodes,
}: {
  regions: RegionMeta[];
  indicators: IndicatorSummary[];
  explore: ExploreData;
  initialCodes: string[];
}) {
  const provinces = useMemo(
    () => regions.filter((r) => r.geo_code !== "000000"),
    [regions]
  );
  const regMap = useMemo(() => new Map(regions.map((r) => [r.geo_code, r])), [regions]);
  const indMap = useMemo(
    () => new Map(indicators.map((i) => [i.indicator_id, i])),
    [indicators]
  );

  const [selected, setSelected] = useState<string[]>(
    initialCodes.length >= 2 ? initialCodes.slice(0, 5) : ["440000", "320000", "330000"]
  );
  const [chartInd, setChartInd] = useState<string>("gdp");
  const [chartMode, setChartMode] = useState<"absolute" | "indexed">("absolute");

  const toggleProvince = (code: string) => {
    setSelected((prev) => {
      if (prev.includes(code)) {
        return prev.length > 2 ? prev.filter((c) => c !== code) : prev;
      }
      if (prev.length >= 5) return [...prev.slice(1), code];
      return [...prev, code];
    });
  };

  // Compute common latest comparable year for each indicator across selected provinces
  const comparisonRows = useMemo(() => {
    return COMPARE_CORE_IDS.map((indId) => {
      const meta = indMap.get(indId);
      const indSeries = explore.series[indId] ?? {};
      // Intersection of years available in all selected provinces
      const yearSets = selected.map((gc) => new Set((indSeries[gc] ?? []).map(([y]) => y)));
      const commonYears = yearSets.length
        ? Array.from(yearSets[0]).filter((y) => yearSets.every((s) => s.has(y))).sort((a, b) => a - b)
        : [];
      const commonYear = commonYears[commonYears.length - 1] ?? null;
      const values: Record<string, number | null> = {};
      for (const gc of selected) {
        const pt = (indSeries[gc] ?? []).find(([y]) => y === commonYear);
        values[gc] = pt ? pt[1] : null;
      }
      const natPt = (indSeries["000000"] ?? []).find(([y]) => y === commonYear);
      return {
        indId,
        meta,
        commonYear,
        values,
        natValue: natPt ? natPt[1] : null,
      };
    });
  }, [selected, explore, indMap]);

  const activeMeta = indMap.get(chartInd);
  const chartOption: EChartsCoreOption = useMemo(() => {
    const indSeries = explore.series[chartInd] ?? {};
    const allYears = Array.from(
      new Set(selected.flatMap((gc) => (indSeries[gc] ?? []).map(([y]) => y)))
    ).sort((a, b) => a - b);

    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0 },
      grid: { top: 36, left: 64, right: 24, bottom: 48 },
      xAxis: { type: "category", data: allYears.map(String) },
      yAxis: {
        type: "value",
        name: chartMode === "indexed" ? "定基指数 (2015=100)" : activeMeta?.unit_zh ?? "",
        scale: true,
        splitLine: { lineStyle: { color: "#ECEAE4" } },
      },
      series: selected.map((gc, idx) => {
        const rawPts = (indSeries[gc] ?? []).map(([year, value]) => ({ year, value }));
        const pts = chartMode === "indexed" ? computeIndexed(rawPts, 2015).series : rawPts;
        const map = new Map(pts.map((p) => [p.year, p.value]));
        return {
          name: regMap.get(gc)?.short_zh ?? gc,
          type: "line",
          symbolSize: 6,
          lineStyle: { width: 2.5 },
          itemStyle: { color: COLORS[idx % COLORS.length] },
          data: allYears.map((y) => map.get(y) ?? null),
        };
      }),
    };
  }, [explore, chartInd, selected, chartMode, regMap, activeMeta]);

  const handleExportCsv = () => {
    const headers = [
      "indicator_id",
      "indicator_name_zh",
      "unit",
      "common_comparable_year",
      ...selected.map((gc) => `${regMap.get(gc)?.short_zh ?? gc}(${gc})`),
      "全国参考(000000)",
    ];
    const rows = comparisonRows.map((r) => [
      r.indId,
      r.meta?.name_zh ?? r.indId,
      r.meta?.unit_zh ?? "",
      r.commonYear ?? "",
      ...selected.map((gc) => r.values[gc] ?? ""),
      r.natValue ?? "",
    ]);
    downloadTextFile(
      `china-data-atlas_compare_${selected.join("-")}.csv`,
      buildCsv(headers, rows)
    );
  };

  return (
    <div className="space-y-6">
      {/* Selector & Presets */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#0f2942]">快捷对比组合：</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSelected(p.codes)}
                className="rounded-lg border border-stone-200 bg-[#faf9f6] px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#0f2942] hover:bg-white"
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2942] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#193d60]"
          >
            <Download className="h-3.5 w-3.5" />
            导出对比表 CSV
          </button>
        </div>

        <div className="mt-4 border-t border-stone-100 pt-3">
          <div className="mb-2 text-xs font-semibold text-slate-600">
            自定义选择 2–5 个省份（已选 {selected.length}/5：
            {selected.map((c) => regMap.get(c)?.short_zh).join("、")}）：
          </div>
          <div className="flex flex-wrap gap-1.5">
            {provinces.map((p) => {
              const active = selected.includes(p.geo_code);
              return (
                <button
                  key={p.geo_code}
                  type="button"
                  onClick={() => toggleProvince(p.geo_code)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-[#0f2942] text-white"
                      : "border border-stone-200 bg-white text-slate-700 hover:bg-stone-100"
                  }`}
                >
                  {p.short_zh}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interactive Trend Overlay */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#0f2942]">
              <GitCompare className="h-4 w-4 text-[#b83a2d]" />
              历史走势横向叠加：{activeMeta?.name_zh}
            </h2>
            <p className="text-xs text-slate-600">
              可切换原始绝对值或以 2015 年 = 100 定基指数观察相对增长斜率。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="选择趋势对比指标"
              value={chartInd}
              onChange={(e) => setChartInd(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              {indicators
                .filter((i) => i.geo_coverage_scope !== "national_only")
                .map((i) => (
                  <option key={i.indicator_id} value={i.indicator_id}>
                    {i.name_zh} ({i.unit_zh})
                  </option>
                ))}
            </select>
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setChartMode("absolute")}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  chartMode === "absolute" ? "bg-white text-[#0f2942] shadow-2xs" : "text-slate-600"
                }`}
              >
                绝对值
              </button>
              <button
                type="button"
                onClick={() => setChartMode("indexed")}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  chartMode === "indexed" ? "bg-white text-[#0f2942] shadow-2xs" : "text-slate-600"
                }`}
              >
                指数 (2015=100)
              </button>
            </div>
          </div>
        </div>

        <LazyChart option={chartOption} height={360} eager />
      </section>

      {/* Common-Year Aligned Multi-Domain Matrix */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <h2 className="mb-3 text-base font-bold text-[#0f2942]">
          跨领域核心指标对齐对比表（严格按共同可比年份对齐）
        </h2>
        <div className="atlas-scroll overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[#f4f2ec] text-slate-700">
              <tr>
                <th className="px-3 py-2.5">统计指标</th>
                <th className="px-3 py-2.5">共同年份</th>
                {selected.map((gc, idx) => (
                  <th key={gc} className="px-3 py-2.5 text-right">
                    <Link
                      href={`/provinces/${gc}`}
                      style={{ color: COLORS[idx % COLORS.length] }}
                      className="font-bold hover:underline"
                    >
                      {regMap.get(gc)?.name_zh}
                    </Link>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-slate-600">全国参考</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {comparisonRows.map((r) => {
                const dec = Number(r.meta?.display_decimals ?? 1);
                const validNums = selected
                  .map((gc) => r.values[gc])
                  .filter((v): v is number => v !== null);
                const maxV = validNums.length ? Math.max(...validNums) : null;
                return (
                  <tr
                    key={r.indId}
                    onClick={() => setChartInd(r.indId)}
                    className={`cursor-pointer hover:bg-stone-50 ${
                      chartInd === r.indId ? "bg-[#0f2942]/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-[#0f2942]">
                      {r.meta?.name_zh}{" "}
                      <span className="font-normal text-slate-600">({r.meta?.unit_zh})</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600">
                      {r.commonYear ?? "—"}
                    </td>
                    {selected.map((gc) => {
                      const v = r.values[gc];
                      const isLeader = v !== null && maxV !== null && v === maxV;
                      return (
                        <td
                          key={gc}
                          className={`px-3 py-2.5 text-right tabular-nums ${
                            isLeader ? "font-extrabold text-[#b83a2d]" : "font-medium text-slate-800"
                          }`}
                        >
                          {formatNum(v, dec)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {formatNum(r.natValue, dec)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
