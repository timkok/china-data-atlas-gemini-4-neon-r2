"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle, Compass, Download, ScatterChart, Table2 } from "lucide-react";
import type { EChartsCoreOption } from "echarts/core";
import LazyChart from "./LazyChart";
import {
  buildCsv,
  computeCAGR,
  computePearson,
  downloadTextFile,
  formatNum,
} from "@/lib/analytics";
import type { ExploreData, IndicatorSummary, RegionMeta } from "@/lib/types";

const REGION_COLORS: Record<string, string> = {
  华北: "#0F2942",
  东北: "#64748B",
  华东: "#B83A2D",
  华中: "#D97706",
  华南: "#1E6B52",
  西南: "#6B46C1",
  西北: "#0284C7",
};

export default function ExploreClient({
  regions,
  indicators,
  explore,
}: {
  regions: RegionMeta[];
  indicators: IndicatorSummary[];
  explore: ExploreData;
}) {
  const provInds = useMemo(
    () => indicators.filter((i) => i.geo_coverage_scope !== "national_only"),
    [indicators]
  );
  const provinces = useMemo(
    () => regions.filter((r) => r.geo_code !== "000000"),
    [regions]
  );
  const indMap = useMemo(
    () => new Map(indicators.map((i) => [i.indicator_id, i])),
    [indicators]
  );
  const regMap = useMemo(() => new Map(regions.map((r) => [r.geo_code, r])), [regions]);

  const [mode, setMode] = useState<"scatter" | "builder">("scatter");

  // Mode 1: Cross-indicator scatter & Pearson r
  const [xInd, setXInd] = useState("urbanization_rate");
  const [yInd, setYInd] = useState("gdp_per_capita");
  const [sizeInd, setSizeInd] = useState("population");
  const [scatterYear, setScatterYear] = useState(2024);

  const commonYears = useMemo(() => {
    const xs = explore.series[xInd] ?? {};
    const ys = explore.series[yInd] ?? {};
    const xSet = new Set(Object.values(xs).flatMap((arr) => arr.map(([y]) => y)));
    const ySet = new Set(Object.values(ys).flatMap((arr) => arr.map(([y]) => y)));
    return Array.from(xSet)
      .filter((y) => ySet.has(y))
      .sort((a, b) => b - a);
  }, [explore, xInd, yInd]);

  const activeScatterYear = commonYears.includes(scatterYear)
    ? scatterYear
    : commonYears[0] ?? 2024;

  const scatterCalc = useMemo(() => {
    const xs = explore.series[xInd] ?? {};
    const ys = explore.series[yInd] ?? {};
    const ss = explore.series[sizeInd] ?? {};
    const points: {
      geo_code: string;
      name: string;
      region: string;
      x: number;
      y: number;
      s: number;
    }[] = [];
    const missing: string[] = [];

    for (const p of provinces) {
      const xv = (xs[p.geo_code] ?? []).find(([yr]) => yr === activeScatterYear)?.[1];
      const yv = (ys[p.geo_code] ?? []).find(([yr]) => yr === activeScatterYear)?.[1];
      const sv = (ss[p.geo_code] ?? []).find(([yr]) => yr === activeScatterYear)?.[1] ?? 1000;
      if (xv !== undefined && yv !== undefined) {
        points.push({
          geo_code: p.geo_code,
          name: p.short_zh,
          region: p.macro_region_zh,
          x: xv,
          y: yv,
          s: sv,
        });
      } else {
        missing.push(p.short_zh);
      }
    }
    const r = computePearson(
      points.map((p) => p.x),
      points.map((p) => p.y)
    );
    return { points, missing, r };
  }, [explore, xInd, yInd, sizeInd, provinces, activeScatterYear]);

  const scatterOption: EChartsCoreOption = useMemo(() => {
    const xMeta = indMap.get(xInd);
    const yMeta = indMap.get(yInd);
    const maxS = Math.max(...scatterCalc.points.map((p) => p.s), 1);
    const grouped = new Map<string, typeof scatterCalc.points>();
    for (const pt of scatterCalc.points) {
      const arr = grouped.get(pt.region) ?? [];
      arr.push(pt);
      grouped.set(pt.region, arr);
    }

    return {
      tooltip: {
        trigger: "item",
        formatter: (params: { data?: { name?: string; value?: number[] } }) => {
          const d = params.data;
          if (!d || !d.value) return "";
          return `<strong>${d.name}</strong> (${activeScatterYear})<br/>${xMeta?.short_zh}: ${d.value[0]} ${xMeta?.unit_zh}<br/>${yMeta?.short_zh}: ${d.value[1]} ${yMeta?.unit_zh}`;
        },
      },
      legend: { bottom: 0 },
      grid: { top: 36, left: 72, right: 32, bottom: 72 },
      xAxis: {
        type: "value",
        name: `${xMeta?.short_zh} (${xMeta?.unit_zh})`,
        nameLocation: "middle",
        nameGap: 24,
        scale: true,
        splitLine: { lineStyle: { color: "#ECEAE4" } },
      },
      yAxis: {
        type: "value",
        name: `${yMeta?.short_zh} (${yMeta?.unit_zh})`,
        scale: true,
        splitLine: { lineStyle: { color: "#ECEAE4" } },
      },
      series: Array.from(grouped.entries()).map(([reg, pts]) => ({
        name: reg,
        type: "scatter",
        itemStyle: { color: REGION_COLORS[reg] ?? "#0F2942", opacity: 0.85 },
        label: { show: true, position: "top", formatter: "{b}", fontSize: 10, color: "#334155" },
        symbolSize: (val: number[]) => 10 + Math.sqrt((val[2] ?? 1) / maxS) * 26,
        data: pts.map((p) => ({ name: p.name, value: [p.x, p.y, p.s] })),
      })),
    };
  }, [scatterCalc, indMap, xInd, yInd, activeScatterYear]);

  // Mode 2: Multi-Province × Multi-Indicator Custom Builder & Synchronized CSV Export (Task P!)
  const [selProvs, setSelProvs] = useState<string[]>(["440000", "320000", "330000"]);
  const [selInds, setSelInds] = useState<string[]>(["gdp", "disposable_income", "physicians_per_1000"]);
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2025);

  const toggleProv = (gc: string) =>
    setSelProvs((prev) =>
      prev.includes(gc) ? (prev.length > 1 ? prev.filter((x) => x !== gc) : prev) : [...prev, gc]
    );
  const toggleInd = (id: string) =>
    setSelInds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    );

  const customRows = useMemo(() => {
    const out: {
      indicator_id: string;
      indicator_name_zh: string;
      unit: string;
      geo_code: string;
      geo_name_zh: string;
      year: number;
      value: number;
    }[] = [];
    for (const indId of selInds) {
      const im = indMap.get(indId);
      const ser = explore.series[indId] ?? {};
      for (const gc of selProvs) {
        const rm = regMap.get(gc);
        for (const [yr, val] of ser[gc] ?? []) {
          if (yr >= startYear && yr <= endYear) {
            out.push({
              indicator_id: indId,
              indicator_name_zh: im?.name_zh ?? indId,
              unit: im?.unit_zh ?? "",
              geo_code: gc,
              geo_name_zh: rm?.name_zh ?? gc,
              year: yr,
              value: val,
            });
          }
        }
      }
    }
    return out.sort((a, b) => a.indicator_id.localeCompare(b.indicator_id) || a.geo_code.localeCompare(b.geo_code) || a.year - b.year);
  }, [selInds, selProvs, startYear, endYear, explore, indMap, regMap]);

  const cagrRows = useMemo(() => {
    const out: {
      indName: string;
      unit: string;
      provName: string;
      y0: number;
      v0: number;
      y1: number;
      v1: number;
      cagr: number | null;
    }[] = [];
    for (const indId of selInds) {
      const im = indMap.get(indId);
      const ser = explore.series[indId] ?? {};
      for (const gc of selProvs) {
        const pts = (ser[gc] ?? []).filter(([y]) => y >= startYear && y <= endYear).sort((a, b) => a[0] - b[0]);
        if (pts.length >= 2) {
          const [y0, v0] = pts[0];
          const [y1, v1] = pts[pts.length - 1];
          out.push({
            indName: im?.name_zh ?? indId,
            unit: im?.unit_zh ?? "",
            provName: regMap.get(gc)?.short_zh ?? gc,
            y0,
            v0,
            y1,
            v1,
            cagr: computeCAGR(v0, v1, y0, y1),
          });
        }
      }
    }
    return out;
  }, [selInds, selProvs, startYear, endYear, explore, indMap, regMap]);

  const handleExportCustomCsv = () => {
    const headers = [
      "indicator_id",
      "indicator_name_zh",
      "unit",
      "geo_code",
      "geo_name_zh",
      "year",
      "value",
      "source_attribution",
    ];
    const rows = customRows.map((r) => [
      r.indicator_id,
      r.indicator_name_zh,
      r.unit,
      r.geo_code,
      r.geo_name_zh,
      r.year,
      r.value,
      "China Data Atlas R2 (NBS/MOE/NHC Official Statistics)",
    ]);
    downloadTextFile(
      `china-data-atlas_explorer_${selProvs.length}provs_${selInds.length}inds_${startYear}-${endYear}.csv`,
      buildCsv(headers, rows)
    );
  };

  const handleExportScatterCsv = () => {
    const xMeta = indMap.get(xInd);
    const yMeta = indMap.get(yInd);
    const headers = [
      "year",
      "geo_code",
      "geo_name_zh",
      "macro_region",
      `${xInd}(${xMeta?.unit_zh})`,
      `${yInd}(${yMeta?.unit_zh})`,
      `${sizeInd}`,
    ];
    const rows = scatterCalc.points.map((p) => [
      activeScatterYear,
      p.geo_code,
      regMap.get(p.geo_code)?.name_zh ?? p.name,
      p.region,
      p.x,
      p.y,
      p.s,
    ]);
    downloadTextFile(
      `china-data-atlas_scatter_${xInd}_vs_${yInd}_${activeScatterYear}.csv`,
      buildCsv(headers, rows)
    );
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("scatter")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            mode === "scatter"
              ? "bg-[#0f2942] text-white"
              : "border border-stone-300 bg-white text-slate-700 hover:bg-stone-50"
          }`}
        >
          <ScatterChart className="h-4 w-4" />
          跨指标气泡相关性探索 (Pearson r)
        </button>
        <button
          type="button"
          onClick={() => setMode("builder")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            mode === "builder"
              ? "bg-[#0f2942] text-white"
              : "border border-stone-300 bg-white text-slate-700 hover:bg-stone-50"
          }`}
        >
          <Table2 className="h-4 w-4" />
          多省 × 多指标定制导出与 CAGR 分析
        </button>
      </div>

      {/* MODE 1: SCATTER / CORRELATION */}
      {mode === "scatter" && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600" htmlFor="x-ind">
                  横轴 X 指标
                </label>
                <select
                  id="x-ind"
                  value={xInd}
                  onChange={(e) => setXInd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-medium"
                >
                  {provInds.map((i) => (
                    <option key={i.indicator_id} value={i.indicator_id}>
                      {i.name_zh} ({i.unit_zh})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600" htmlFor="y-ind">
                  纵轴 Y 指标
                </label>
                <select
                  id="y-ind"
                  value={yInd}
                  onChange={(e) => setYInd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-medium"
                >
                  {provInds.map((i) => (
                    <option key={i.indicator_id} value={i.indicator_id}>
                      {i.name_zh} ({i.unit_zh})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600" htmlFor="s-ind">
                  气泡大小指标
                </label>
                <select
                  id="s-ind"
                  value={sizeInd}
                  onChange={(e) => setSizeInd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-medium"
                >
                  {provInds.map((i) => (
                    <option key={i.indicator_id} value={i.indicator_id}>
                      {i.name_zh}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600" htmlFor="yr-sel">
                  共同可比年份
                </label>
                <select
                  id="yr-sel"
                  value={activeScatterYear}
                  onChange={(e) => setScatterYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold"
                >
                  {commonYears.map((y) => (
                    <option key={y} value={y}>
                      {y} 年
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Statistical Summary Ribbon */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#faf9f6] p-3.5 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-slate-600">Pearson 相关系数 r：</span>
                  <strong className="text-base tabular-nums text-[#0f2942]">
                    {scatterCalc.r !== null ? scatterCalc.r.toFixed(4) : "样本不足"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-600">有效样本量：</span>
                  <strong className="tabular-nums text-slate-900">n = {scatterCalc.points.length} 省</strong>
                </div>
                <div>
                  <span className="text-slate-600">缺失处理：</span>
                  <strong className="text-slate-700">
                    {scatterCalc.missing.length === 0
                      ? "零缺失（31 省全覆盖）"
                      : `已剔除缺失 ${scatterCalc.missing.length} 省（不插值）`}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportScatterCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2942] px-3 py-1.5 font-semibold text-white hover:bg-[#193d60]"
              >
                <Download className="h-3.5 w-3.5" />
                导出散点数据 CSV
              </button>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-950">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>
                <strong>统计学提示（相关性 ≠ 因果性）：</strong>
                Pearson r 仅度量横截面线性关联强度，不能单独推导出单向因果关系，跨省比较应结合经济结构、人口流动与政策变量综合判断。
              </span>
            </div>

            <div className="mt-4">
              <LazyChart option={scatterOption} height={440} eager />
            </div>
          </section>
        </div>
      )}

      {/* MODE 2: MULTI-PROVINCE × MULTI-INDICATOR BUILDER & SYNC CSV EXPORT (Task P) */}
      {mode === "builder" && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-[#0f2942]">
                  <Compass className="h-4 w-4 text-[#1e6b52]" />
                  定制多省 × 多指标数据集（已匹配 {customRows.length} 条记录）
                </h2>
                <p className="text-xs text-slate-600">
                  勾选任意省份与指标组合，实时计算年均复合增长率（CAGR）并同步导出规范长表 CSV。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCustomCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e6b52] px-4 py-2 text-xs font-semibold text-white hover:bg-[#175541]"
              >
                <Download className="h-4 w-4" />
                同步导出定制 CSV ({customRows.length} 行)
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-stone-200 bg-[#faf9f6] p-3.5">
                <div className="mb-2 text-xs font-bold text-[#0f2942]">
                  1. 选择地区（已选 {selProvs.length} 个）
                </div>
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {regions.map((r) => (
                    <button
                      key={r.geo_code}
                      type="button"
                      onClick={() => toggleProv(r.geo_code)}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        selProvs.includes(r.geo_code)
                          ? "bg-[#0f2942] text-white"
                          : "border border-stone-200 bg-white text-slate-700"
                      }`}
                    >
                      {r.short_zh}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-[#faf9f6] p-3.5">
                <div className="mb-2 text-xs font-bold text-[#0f2942]">
                  2. 选择指标（已选 {selInds.length} 项）
                </div>
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {indicators.map((ind) => (
                    <button
                      key={ind.indicator_id}
                      type="button"
                      onClick={() => toggleInd(ind.indicator_id)}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        selInds.includes(ind.indicator_id)
                          ? "bg-[#b83a2d] text-white"
                          : "border border-stone-200 bg-white text-slate-700"
                      }`}
                    >
                      {ind.short_zh}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700">3. 年份区间：</span>
              <input
                type="number"
                min={2000}
                max={2025}
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                aria-label="起始年份"
                className="w-20 rounded border border-stone-300 px-2 py-1 font-semibold tabular-nums"
              />
              <span>至</span>
              <input
                type="number"
                min={2000}
                max={2025}
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}
                aria-label="结束年份"
                className="w-20 rounded border border-stone-300 px-2 py-1 font-semibold tabular-nums"
              />
            </div>

            {/* Live CAGR Summary Table */}
            <div className="atlas-scroll overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-[#f4f2ec] text-slate-700">
                  <tr>
                    <th className="px-3 py-2.5">指标</th>
                    <th className="px-3 py-2.5">地区</th>
                    <th className="px-3 py-2.5">起止年份</th>
                    <th className="px-3 py-2.5 text-right">期初值</th>
                    <th className="px-3 py-2.5 text-right">期末值</th>
                    <th className="px-3 py-2.5 text-right">年均复合增速 (CAGR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {cagrRows.map((r, i) => (
                    <tr key={i} className="hover:bg-stone-50">
                      <td className="px-3 py-2 font-semibold text-[#0f2942]">{r.indName}</td>
                      <td className="px-3 py-2">{r.provName}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">
                        {r.y0} → {r.y1}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNum(r.v0, 2)} <span className="text-slate-600">{r.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {formatNum(r.v1, 2)} <span className="font-normal text-slate-600">{r.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {r.cagr !== null ? (
                          <span className={r.cagr >= 0 ? "text-emerald-700" : "text-rose-700"}>
                            {r.cagr >= 0 ? "+" : ""}
                            {r.cagr}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
