"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart2,
  Check,
  Copy,
  Download,
  History,
  Image as ImageIcon,
  Info,
  Layers,
  LineChart as LineChartIcon,
  Map as MapIcon,
  Table2,
} from "lucide-react";
import type { EChartsCoreOption } from "echarts/core";
import LazyChart from "./LazyChart";
import SpatialMatrixView from "./SpatialMatrixView";
import {
  EVIDENCE_META,
  buildCsv,
  computeDistribution,
  computeIndexed,
  computeYoY,
  downloadTextFile,
  formatCitation,
  formatNum,
} from "@/lib/analytics";
import type { EvidenceLevel, IndicatorSlice, RegionMeta } from "@/lib/types";

type TabMode = "spatial" | "trend" | "ranking" | "table" | "vintages";
type TransformMode = "absolute" | "yoy" | "indexed";
type ScaleMode = "linear" | "log";

const SERIES_COLORS = [
  "#0F2942",
  "#B83A2D",
  "#1E6B52",
  "#D97706",
  "#6B46C1",
  "#0284C7",
  "#BE185D",
];

const EXTENSIVE_TOTAL_IDS = new Set([
  "population",
  "urban_population",
  "rural_population",
  "gdp",
  "gdp_primary",
  "gdp_secondary",
  "gdp_tertiary",
  "retail_sales",
  "fiscal_revenue",
  "fiscal_expenditure",
  "higher_education_students",
  "higher_education_institutions",
  "senior_high_students",
  "primary_school_students",
  "rd_expenditure_industrial",
  "patent_grants_domestic",
  "health_institutions",
  "electricity_consumption",
  "highway_mileage",
  "private_cars",
]);

export default function IndicatorWorkbench({
  slice,
  regions,
}: {
  slice: IndicatorSlice;
  regions: RegionMeta[];
}) {
  const { meta, coverage, rows, sourceTables, vintages } = slice;
  const decimals = Number(meta.display_decimals) || 0;
  const isNationalOnly = meta.geo_coverage_scope === "national_only";
  const isExtensiveTotal = EXTENSIVE_TOTAL_IDS.has(meta.indicator_id);

  const regionMap = useMemo(() => new Map(regions.map((r) => [r.geo_code, r])), [regions]);

  const availableYears = useMemo(
    () => Array.from(new Set(rows.map((r) => r.y))).sort((a, b) => a - b),
    [rows]
  );

  // Default year = Complete Comparable Year (so 31 provinces are always comparable on open!),
  // with instant switch to Latest Available Year (Task K!).
  const [yearMode, setYearMode] = useState<"comparable" | "latest">("comparable");
  const [selectedYear, setSelectedYear] = useState<number>(
    coverage.complete_comparable_year || availableYears[availableYears.length - 1]
  );
  const [activeTab, setActiveTab] = useState<TabMode>(isNationalOnly ? "trend" : "spatial");
  const [transform, setTransform] = useState<TransformMode>("absolute");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("linear");
  const [selectedGeos, setSelectedGeos] = useState<string[]>(
    isNationalOnly
      ? ["000000"]
      : isExtensiveTotal
      ? ["440000", "320000", "330000", "370000", "110000"]
      : ["000000", "440000", "320000", "330000", "110000"]
  );
  const [evidenceFilter, setEvidenceFilter] = useState<"ALL" | EvidenceLevel>("ALL");
  const [tableSearch, setTableSearch] = useState("");
  const [citationStyle, setCitationStyle] = useState<"gbt7714" | "apa">("gbt7714");
  const [copied, setCopied] = useState(false);

  const exportPngRef = useRef<(() => string | null) | null>(null);

  const handleYearModeSwitch = (mode: "comparable" | "latest") => {
    setYearMode(mode);
    if (mode === "comparable") {
      setSelectedYear(coverage.complete_comparable_year);
    } else {
      setSelectedYear(coverage.year_max);
    }
  };

  // Rows for selected year (for spatial matrix, ranking, and distribution summary)
  const yearRows = useMemo(
    () => rows.filter((r) => r.y === selectedYear),
    [rows, selectedYear]
  );
  const natYearRow = useMemo(
    () => yearRows.find((r) => r.g === "000000") ?? null,
    [yearRows]
  );
  const provYearRows = useMemo(
    () => yearRows.filter((r) => r.g !== "000000").sort((a, b) => b.v - a.v),
    [yearRows]
  );

  const valuesByGeo = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of yearRows) out[r.g] = r.v;
    return out;
  }, [yearRows]);

  const distribution = useMemo(
    () => computeDistribution(provYearRows.map((r) => r.v)),
    [provYearRows]
  );

  const outliers = useMemo(() => {
    if (!distribution) return [];
    return provYearRows.filter(
      (r) => r.v > distribution.upperFence || r.v < distribution.lowerFence
    );
  }, [provYearRows, distribution]);

  // Trend series for selected provinces
  const trendData = useMemo(() => {
    const byGeo = new Map<string, { year: number; value: number }[]>();
    for (const r of rows) {
      if (!selectedGeos.includes(r.g)) continue;
      const arr = byGeo.get(r.g) ?? [];
      arr.push({ year: r.y, value: r.v });
      byGeo.set(r.g, arr);
    }

    let hasNonPositive = false;
    let baseYearUsed: number | null = null;
    const seriesList = selectedGeos.map((gc, idx) => {
      const pts = (byGeo.get(gc) ?? []).sort((a, b) => a.year - b.year);
      let transformed = pts;
      if (transform === "yoy") {
        transformed = computeYoY(pts);
      } else if (transform === "indexed") {
        const res = computeIndexed(pts, 2015);
        transformed = res.series;
        if (baseYearUsed === null) baseYearUsed = res.baseYearUsed;
      }
      if (transformed.some((p) => p.value <= 0)) hasNonPositive = true;
      return {
        geoCode: gc,
        name: regionMap.get(gc)?.short_zh ?? gc,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        points: transformed,
      };
    });

    return { seriesList, hasNonPositive, baseYearUsed };
  }, [rows, selectedGeos, transform, regionMap]);

  const effectiveLog = scaleMode === "log" && !trendData.hasNonPositive && transform !== "yoy";

  const trendOption: EChartsCoreOption = useMemo(() => {
    const yrs = Array.from(
      new Set(trendData.seriesList.flatMap((s) => s.points.map((p) => p.year)))
    ).sort((a, b) => a - b);

    const yName =
      transform === "yoy"
        ? "同比增速 (%)"
        : transform === "indexed"
        ? `定基指数 (${trendData.baseYearUsed ?? "基期"}=100)`
        : meta.unit_zh;

    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, type: "scroll" },
      grid: { top: 36, left: 64, right: 24, bottom: 52 },
      xAxis: { type: "category", data: yrs.map(String) },
      yAxis: {
        type: effectiveLog ? "log" : "value",
        name: yName,
        scale: true,
        splitLine: { lineStyle: { color: "#ECEAE4" } },
      },
      series: trendData.seriesList.map((s) => {
        const map = new Map(s.points.map((p) => [p.year, p.value]));
        return {
          name: s.name,
          type: "line",
          smooth: false,
          symbolSize: 6,
          lineStyle: { width: s.geoCode === "000000" ? 3 : 2 },
          itemStyle: { color: s.color },
          data: yrs.map((y) => map.get(y) ?? null),
        };
      }),
    };
  }, [trendData, transform, effectiveLog, meta.unit_zh]);

  const rankingOption: EChartsCoreOption = useMemo(() => {
    const ordered = [...provYearRows].reverse();
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 20, left: 74, right: 48, bottom: 32 },
      xAxis: { type: "value", name: meta.unit_zh, splitLine: { lineStyle: { color: "#ECEAE4" } } },
      yAxis: {
        type: "category",
        data: ordered.map((r) => regionMap.get(r.g)?.short_zh ?? r.g),
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: `${selectedYear}年`,
          type: "bar",
          data: ordered.map((r) => ({
            value: r.v,
            itemStyle: {
              color: selectedGeos.includes(r.g) ? "#B83A2D" : "#0F2942",
            },
          })),
          label: { show: true, position: "right", fontSize: 10 },
        },
      ],
    };
  }, [provYearRows, regionMap, selectedYear, selectedGeos, meta.unit_zh]);

  // Filtered table rows
  const filteredTableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (evidenceFilter !== "ALL" && r.el !== evidenceFilter) return false;
        if (q) {
          const reg = regionMap.get(r.g);
          const hay = `${reg?.name_zh ?? ""} ${reg?.name_en ?? ""} ${r.g} ${r.y} ${r.vid}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.y - a.y || a.g.localeCompare(b.g));
  }, [rows, evidenceFilter, tableSearch, regionMap]);

  const handleToggleGeo = (gc: string) => {
    setSelectedGeos((prev) => {
      if (prev.includes(gc)) {
        return prev.length > 1 ? prev.filter((x) => x !== gc) : prev;
      }
      if (prev.length >= 7) return [...prev.slice(1), gc];
      return [...prev, gc];
    });
  };

  // Synchronized CSV export matching active filters
  const handleDownloadCsv = () => {
    const exportRows = activeTab === "table" ? filteredTableRows : rows;
    const headers = [
      "indicator_id",
      "indicator_name_zh",
      "geo_code",
      "geo_name_zh",
      "year",
      "value",
      "unit",
      "original_value",
      "original_unit",
      "evidence_level",
      "extraction_method",
      "vintage_id",
      "source_table",
    ];
    const dataRows = exportRows.map((r) => [
      meta.indicator_id,
      meta.name_zh,
      r.g,
      regionMap.get(r.g)?.name_zh ?? r.g,
      r.y,
      r.v,
      meta.unit_zh,
      r.ov,
      r.ou,
      r.el,
      r.em,
      r.vid,
      sourceTables[r.st] ?? "",
    ]);
    const csv = buildCsv(headers, dataRows);
    downloadTextFile(`china-data-atlas_${meta.indicator_id}_r2.csv`, csv);
  };

  const handleExportPng = () => {
    const dataUrl = exportPngRef.current?.();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `china-data-atlas_${meta.indicator_id}_${selectedYear}.png`;
    a.click();
  };

  const citationText = formatCitation(
    meta.name_zh,
    meta.name_en,
    "中华人民共和国国家统计局（国家数据公开库 / 年度统计公报）",
    `${coverage.year_min}–${coverage.year_max}`,
    citationStyle,
    `/indicators/${meta.indicator_id}`
  );

  const handleCopyCitation = async () => {
    try {
      await navigator.clipboard.writeText(citationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary Card */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href="/indicators" className="text-slate-600 hover:text-[#0f2942] hover:underline">
            指标目录
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-[#b83a2d]">{meta.domain_zh}</span>
          {meta.is_core_r1 === "true" && (
            <span className="rounded bg-[#0f2942] px-2 py-0.5 text-[10px] font-semibold text-white">
              核心 12 指标
            </span>
          )}
          {isNationalOnly && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              仅全国口径（国家数据无分省序列）
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
              {meta.name_zh}
            </h1>
            <div className="mt-1 text-sm text-slate-600">
              {meta.name_en} · 单位：<strong>{meta.unit_zh}</strong> ({meta.unit_en})
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{meta.definition_zh}</p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2942] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#193d60]"
            >
              <Download className="h-3.5 w-3.5" />
              导出当前 CSV
            </button>
            {(activeTab === "trend" || activeTab === "ranking") && (
              <button
                type="button"
                onClick={handleExportPng}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-stone-50"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                导出图表 PNG
              </button>
            )}
          </div>
        </div>

        {/* KPI Bar + Evidence Distribution */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 sm:grid-cols-4">
          <div className="rounded-xl bg-[#faf9f6] p-3">
            <div className="text-[11px] text-slate-600">当前年份全国值 ({selectedYear})</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-[#0f2942]">
              {natYearRow ? formatNum(natYearRow.v, decimals) : "暂无"}
              <span className="ml-1 text-xs font-normal text-slate-600">{meta.unit_zh}</span>
            </div>
          </div>
          <div className="rounded-xl bg-[#faf9f6] p-3">
            <div className="text-[11px] text-slate-600">
              {selectedYear} 省级首位 / 末位
            </div>
            <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
              {provYearRows.length > 0 ? (
                <>
                  {regionMap.get(provYearRows[0].g)?.short_zh} ({formatNum(provYearRows[0].v, decimals)})
                  <span className="mx-1 text-slate-600">/</span>
                  {regionMap.get(provYearRows[provYearRows.length - 1].g)?.short_zh} (
                  {formatNum(provYearRows[provYearRows.length - 1].v, decimals)})
                </>
              ) : (
                "仅全国序列"
              )}
            </div>
          </div>
          <div className="rounded-xl bg-[#faf9f6] p-3">
            <div className="text-[11px] text-slate-600">完整31省可比年 / 最新年</div>
            <div className="mt-0.5 text-lg font-bold tabular-nums text-[#1e6b52]">
              {coverage.complete_comparable_year} <span className="text-slate-600">/</span> {coverage.year_max}
            </div>
          </div>
          <div className="rounded-xl bg-[#faf9f6] p-3">
            <div className="text-[11px] text-slate-600">证据分级分布 (共 {coverage.total_rows} 条)</div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold">
              {coverage.e4_count > 0 && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900">E4:{coverage.e4_count}</span>
              )}
              {coverage.e3_count > 0 && (
                <span className="rounded bg-teal-100 px-1.5 py-0.5 text-teal-900">E3:{coverage.e3_count}</span>
              )}
              {coverage.e2_count > 0 && (
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-900">E2:{coverage.e2_count}</span>
              )}
              <span className="rounded bg-stone-200 px-1.5 py-0.5 text-stone-800">E1:{coverage.e1_count}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Data vs. Complete Comparable Year Switcher + View Mode Tabs */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <div className="flex flex-col justify-between gap-3 border-b border-stone-200 pb-4 lg:flex-row lg:items-center">
          {/* Primary View Tabs */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="可视化视图切换">
            {!isNationalOnly && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "spatial"}
                onClick={() => setActiveTab("spatial")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                  activeTab === "spatial"
                    ? "bg-[#0f2942] text-white"
                    : "bg-stone-100 text-slate-700 hover:bg-stone-200"
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" />
                空间矩阵
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "trend"}
              onClick={() => setActiveTab("trend")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                activeTab === "trend"
                  ? "bg-[#0f2942] text-white"
                  : "bg-stone-100 text-slate-700 hover:bg-stone-200"
              }`}
            >
              <LineChartIcon className="h-3.5 w-3.5" />
              历史趋势
            </button>
            {!isNationalOnly && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ranking"}
                onClick={() => setActiveTab("ranking")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                  activeTab === "ranking"
                    ? "bg-[#0f2942] text-white"
                    : "bg-stone-100 text-slate-700 hover:bg-stone-200"
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                省份排名
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "table"}
              onClick={() => setActiveTab("table")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                activeTab === "table"
                  ? "bg-[#0f2942] text-white"
                  : "bg-stone-100 text-slate-700 hover:bg-stone-200"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              数据明细表
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "vintages"}
              onClick={() => setActiveTab("vintages")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                activeTab === "vintages"
                  ? "bg-[#b83a2d] text-white"
                  : "bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              修订版本 ({slice.totalVintageRecords})
            </button>
          </div>

          {/* Year Mode Switch (Latest vs Complete Comparable Year) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleYearModeSwitch("comparable")}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  yearMode === "comparable"
                    ? "bg-white text-[#0f2942] shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                完整可比年 ({coverage.complete_comparable_year})
              </button>
              <button
                type="button"
                onClick={() => handleYearModeSwitch("latest")}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  yearMode === "latest"
                    ? "bg-white text-[#0f2942] shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                最新数据 ({coverage.year_max})
              </button>
            </div>

            <select
              aria-label="选择年份"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              {[...availableYears].reverse().map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Incomplete provincial year notice */}
        {!isNationalOnly && provYearRows.length < 31 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-950">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
            <span>
              <strong>年份覆盖提示：</strong>
              {selectedYear} 年当前仅有 {provYearRows.length} 个省份记录（最新公报可能仅发布全国数）。跨省横向排名请点击上方“完整可比年 ({coverage.complete_comparable_year})”。
            </span>
          </div>
        )}

        {/* TAB 1: SPATIAL MATRIX */}
        {activeTab === "spatial" && !isNationalOnly && (
          <div className="mt-4">
            <SpatialMatrixView
              year={selectedYear}
              unit={meta.unit_zh}
              decimals={decimals}
              regions={regions}
              valuesByGeo={valuesByGeo}
              selectedGeo={selectedGeos[1]}
              onSelectGeo={(gc) => {
                handleToggleGeo(gc);
                setActiveTab("trend");
              }}
            />
          </div>
        )}

        {/* TAB 2: TREND ANALYSIS */}
        {activeTab === "trend" && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#faf9f6] p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold text-slate-600">展示模式：</span>
                {(
                  [
                    ["absolute", "绝对值"],
                    ["yoy", "同比增速 (%)"],
                    ["indexed", "定基指数 (Base=100)"],
                  ] as const
                ).map(([m, lbl]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTransform(m)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      transform === m
                        ? "bg-[#0f2942] text-white"
                        : "border border-stone-200 bg-white text-slate-700"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">坐标轴：</span>
                <button
                  type="button"
                  onClick={() => setScaleMode("linear")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    scaleMode === "linear"
                      ? "bg-[#0f2942] text-white"
                      : "border border-stone-200 bg-white text-slate-700"
                  }`}
                >
                  线性
                </button>
                <button
                  type="button"
                  onClick={() => setScaleMode("log")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    scaleMode === "log"
                      ? "bg-[#0f2942] text-white"
                      : "border border-stone-200 bg-white text-slate-700"
                  }`}
                >
                  对数 (Log)
                </button>
              </div>
            </div>

            {scaleMode === "log" && (trendData.hasNonPositive || transform === "yoy") && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                当前序列包含 ≤ 0 的数值（或处于同比增速模式），对数坐标在数学上无定义，已自动回退为线性坐标。
              </div>
            )}

            <LazyChart
              option={trendOption}
              height={400}
              eager
              onReady={(fn) => {
                exportPngRef.current = fn;
              }}
            />

            {!isNationalOnly && (
              <div className="rounded-xl border border-stone-200 bg-[#faf9f6] p-3">
                <div className="mb-2 text-xs font-semibold text-slate-700">
                  选择对比地区（最多同时选 7 个）：
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {regions.map((r) => {
                    const active = selectedGeos.includes(r.geo_code);
                    return (
                      <button
                        key={r.geo_code}
                        type="button"
                        onClick={() => handleToggleGeo(r.geo_code)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                          active
                            ? "bg-[#0f2942] text-white"
                            : "border border-stone-200 bg-white text-slate-700 hover:bg-stone-100"
                        }`}
                      >
                        {r.short_zh}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RANKING BAR */}
        {activeTab === "ranking" && !isNationalOnly && (
          <div className="mt-4">
            <LazyChart
              option={rankingOption}
              height={760}
              eager
              onReady={(fn) => {
                exportPngRef.current = fn;
              }}
            />
          </div>
        )}

        {/* TAB 4: DATA TABLE WITH EVIDENCE LEVEL FILTER */}
        {activeTab === "table" && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(["ALL", "E4", "E3", "E2", "E1"] as const).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setEvidenceFilter(lv)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      evidenceFilter === lv
                        ? "bg-[#0f2942] text-white"
                        : "border border-stone-200 bg-stone-50 text-slate-700"
                    }`}
                  >
                    {lv === "ALL" ? "全部证据级" : lv}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="搜索省份、年份或版本 ID…"
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs focus:border-[#0f2942] focus:outline-none"
              />
            </div>

            <div className="atlas-scroll max-h-[520px] overflow-auto rounded-xl border border-stone-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-[#f4f2ec] text-slate-700">
                  <tr>
                    <th className="px-3 py-2.5">年份</th>
                    <th className="px-3 py-2.5">地区</th>
                    <th className="px-3 py-2.5 text-right">标准值 ({meta.unit_zh})</th>
                    <th className="px-3 py-2.5 text-right">原始值 / 单位</th>
                    <th className="px-3 py-2.5">证据级别</th>
                    <th className="px-3 py-2.5">提取方式</th>
                    <th className="px-3 py-2.5">版本 ID</th>
                    <th className="px-3 py-2.5">官方来源表</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {filteredTableRows.slice(0, 200).map((r) => {
                    const reg = regionMap.get(r.g);
                    const ev = EVIDENCE_META[r.el];
                    return (
                      <tr key={`${r.g}-${r.y}`} className="hover:bg-stone-50">
                        <td className="px-3 py-2 font-semibold tabular-nums">{r.y}</td>
                        <td className="px-3 py-2">
                          <Link
                            href={r.g === "000000" ? "/provinces" : `/provinces/${r.g}`}
                            className="font-medium text-[#0f2942] hover:underline"
                          >
                            {reg?.name_zh ?? r.g}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                          {formatNum(r.v, decimals)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {r.ov} <span className="text-[10px] text-slate-600">{r.ou}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${ev.colorClass}`}>
                            {r.el}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.em}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{r.vid}</td>
                        <td className="max-w-xs truncate px-3 py-2 text-slate-600">
                          {sourceTables[r.st]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-slate-600">
              当前筛选共 {filteredTableRows.length} 条记录（表格预览前 200 条；点击右上角“导出当前 CSV”可下载全部筛选结果）。
            </div>
          </div>
        )}

        {/* TAB 5: MULTI-VINTAGE & REVISION HISTORY DRAWER (Task L!) */}
        {activeTab === "vintages" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs leading-relaxed text-amber-950">
              <div className="font-bold">历史修订版本与口径对照（Multi-Vintage Archive）</div>
              <p className="mt-1">
                本平台从不静默覆盖历史官方数字。下方保留了第五次经济普查修订前、第七次人口普查修订前、国家卫健委年鉴直接口径、NBS 每万人取整旧口径或教育部终审修订等真实历史版本，供学术复现与差异追溯。
              </p>
            </div>

            {vintages.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-xs text-slate-600">
                该指标当前采用国家统计局统一官方版本（NBS 2026），暂无归档的跨版本历史修订差异记录。
              </div>
            ) : (
              <div className="atlas-scroll max-h-[500px] overflow-auto rounded-xl border border-stone-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-[#f4f2ec] text-slate-700">
                    <tr>
                      <th className="px-3 py-2.5">年份</th>
                      <th className="px-3 py-2.5">地区</th>
                      <th className="px-3 py-2.5">版本说明</th>
                      <th className="px-3 py-2.5 text-right">数值 ({meta.unit_zh})</th>
                      <th className="px-3 py-2.5 text-right">较当前权威值差异</th>
                      <th className="px-3 py-2.5">来源与备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {vintages.slice(0, 150).map((v, idx) => (
                      <tr
                        key={`${v.g}-${v.y}-${v.vid}-${idx}`}
                        className={v.curr ? "bg-emerald-50/40" : "hover:bg-stone-50"}
                      >
                        <td className="px-3 py-2 font-semibold tabular-nums">{v.y}</td>
                        <td className="px-3 py-2">{regionMap.get(v.g)?.short_zh ?? v.g}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              v.curr
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {v.curr ? "权威现行" : "历史归档"}
                          </span>
                          <span className="font-medium text-slate-800">{v.lbl}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {formatNum(v.v, decimals)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {v.curr ? "基准 (0%)" : `${v.d}%`}
                        </td>
                        <td className="max-w-sm px-3 py-2 text-slate-600">{v.n || v.src}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Distribution / Outliers + Methodological Breaks + Citation Grid */}
      <section className="grid gap-5 lg:grid-cols-3">
        {/* Distribution & Outliers */}
        <div className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f2942]">
            <Layers className="h-4 w-4 text-[#0f2942]" />
            {selectedYear} 年省级分布与极值诊断
          </h2>
          {distribution ? (
            <div className="mt-3 space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-[#faf9f6] p-2.5">
                  <div className="text-slate-600">最小值</div>
                  <div className="font-bold tabular-nums">{formatNum(distribution.min, decimals)}</div>
                </div>
                <div className="rounded-lg bg-[#faf9f6] p-2.5">
                  <div className="text-slate-600">中位数</div>
                  <div className="font-bold tabular-nums">{formatNum(distribution.median, decimals)}</div>
                </div>
                <div className="rounded-lg bg-[#faf9f6] p-2.5">
                  <div className="text-slate-600">最大值</div>
                  <div className="font-bold tabular-nums">{formatNum(distribution.max, decimals)}</div>
                </div>
                <div className="rounded-lg bg-[#faf9f6] p-2.5">
                  <div className="text-slate-600">均值 (n={distribution.n})</div>
                  <div className="font-bold tabular-nums">{formatNum(distribution.mean, decimals)}</div>
                </div>
                <div className="rounded-lg bg-[#faf9f6] p-2.5">
                  <div className="text-slate-600">Q1 (25%)</div>
                  <div className="font-bold tabular-nums">{formatNum(distribution.q1, decimals)}</div>
                </div>
                <div className="rounded-lg bg-[#faf9f6] p-2.5">
                  <div className="text-slate-600">Q3 (75%)</div>
                  <div className="font-bold tabular-nums">{formatNum(distribution.q3, decimals)}</div>
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5 text-slate-600">
                <strong>IQR 统计离群省份：</strong>
                {outliers.length === 0
                  ? "无超出 1.5×IQR 边界的极端离群省份。"
                  : outliers
                      .map(
                        (o) =>
                          `${regionMap.get(o.g)?.short_zh}(${formatNum(o.v, decimals)})`
                      )
                      .join("、")}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-600">当前年份无省级分布数据。</p>
          )}
        </div>

        {/* Methodological Breaks & Limitations */}
        <div className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f2942]">
            <Info className="h-4 w-4 text-[#b83a2d]" />
            统计公式、口径变更与局限说明
          </h2>
          <dl className="mt-3 space-y-2.5 text-xs">
            <div>
              <dt className="font-semibold text-slate-700">计算/采集口径</dt>
              <dd className="mt-0.5 leading-relaxed text-slate-600">{meta.formula_note}</dd>
            </div>
            <div>
              <dt className="font-semibold text-amber-900">历史口径断层与修订</dt>
              <dd className="mt-0.5 leading-relaxed text-slate-600">{meta.methodological_breaks}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">解读局限性</dt>
              <dd className="mt-0.5 leading-relaxed text-slate-600">{meta.limitations_zh}</dd>
            </div>
          </dl>
        </div>

        {/* Academic Citation Copy Box */}
        <div className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#0f2942]">规范引用 (Citation)</h2>
            <div className="inline-flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setCitationStyle("gbt7714")}
                className={`rounded px-2 py-0.5 font-medium ${
                  citationStyle === "gbt7714" ? "bg-white text-[#0f2942] shadow-2xs" : "text-slate-600"
                }`}
              >
                GB/T 7714
              </button>
              <button
                type="button"
                onClick={() => setCitationStyle("apa")}
                className={`rounded px-2 py-0.5 font-medium ${
                  citationStyle === "apa" ? "bg-white text-[#0f2942] shadow-2xs" : "text-slate-600"
                }`}
              >
                APA 7th
              </button>
            </div>
          </div>

          <pre className="mt-3 whitespace-pre-wrap break-all rounded-lg border border-stone-200 bg-[#faf9f6] p-3 font-mono text-[11px] leading-relaxed text-slate-700">
            {citationText}
          </pre>
          <button
            type="button"
            onClick={handleCopyCitation}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#0f2942] bg-white px-3 py-2 text-xs font-semibold text-[#0f2942] hover:bg-stone-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#1e6b52]" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "已复制引用文本" : "复制引用格式"}
          </button>
        </div>
      </section>
    </div>
  );
}
