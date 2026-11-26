"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Download, GitCompare, TrendingUp } from "lucide-react";
import type { EChartsCoreOption } from "echarts/core";
import LazyChart from "./LazyChart";
import {
  DOMAIN_LABELS,
  EVIDENCE_META,
  buildCsv,
  downloadTextFile,
  formatNum,
} from "@/lib/analytics";
import type { ProvinceProfile, RegionMeta } from "@/lib/types";

const HERO_IDS = ["population", "gdp", "gdp_per_capita", "disposable_income", "urbanization_rate", "population_65plus"];

export default function ProvinceProfileClient({
  profile,
  allRegions,
}: {
  profile: ProvinceProfile;
  allRegions: RegionMeta[];
}) {
  const { region, metrics } = profile;
  const [selectedMetricId, setSelectedMetricId] = useState<string>("gdp");
  const [activeDomain, setActiveDomain] = useState<string>("all");

  const metricById = useMemo(
    () => new Map(metrics.map((m) => [m.indicator_id, m])),
    [metrics]
  );

  const selectedMetric = metricById.get(selectedMetricId) ?? metrics[0];

  const chartOption: EChartsCoreOption = useMemo(() => {
    if (!selectedMetric) return {};
    return {
      tooltip: { trigger: "axis" },
      grid: { top: 32, left: 64, right: 24, bottom: 36 },
      xAxis: {
        type: "category",
        data: selectedMetric.series.map(([y]) => String(y)),
      },
      yAxis: {
        type: "value",
        name: selectedMetric.unit_zh,
        scale: true,
        splitLine: { lineStyle: { color: "#ECEAE4" } },
      },
      series: [
        {
          name: `${region.short_zh} · ${selectedMetric.short_zh}`,
          type: "line",
          smooth: false,
          symbolSize: 6,
          lineStyle: { width: 2.5, color: "#0F2942" },
          itemStyle: { color: "#B83A2D" },
          areaStyle: { color: "rgba(15, 41, 66, 0.08)" },
          data: selectedMetric.series.map(([, v]) => v),
        },
      ],
    };
  }, [selectedMetric, region.short_zh]);

  const filteredMetrics = useMemo(
    () =>
      activeDomain === "all"
        ? metrics
        : metrics.filter((m) => m.domain_id === activeDomain),
    [metrics, activeDomain]
  );

  const handleDownloadProvinceCsv = () => {
    const headers = [
      "geo_code",
      "geo_name_zh",
      "indicator_id",
      "indicator_name_zh",
      "domain_id",
      "latest_year",
      "value",
      "unit",
      "national_rank",
      "rank_of",
      "yoy_pct",
      "chg10_pct",
      "national_value",
      "evidence_level",
    ];
    const rows = metrics.map((m) => [
      region.geo_code,
      region.name_zh,
      m.indicator_id,
      m.name_zh,
      m.domain_id,
      m.latest_year,
      m.value,
      m.unit_zh,
      m.rank ?? "",
      m.rank_of ?? "",
      m.yoy_pct ?? "",
      m.chg10_pct ?? "",
      m.national_value ?? "",
      m.evidence_level,
    ]);
    downloadTextFile(
      `china-data-atlas_province_${region.geo_code}_${region.short_zh}.csv`,
      buildCsv(headers, rows)
    );
  };

  const peers = allRegions.filter(
    (r) => r.geo_code !== "000000" && r.geo_code !== region.geo_code && r.macro_region_zh === region.macro_region_zh
  );

  return (
    <div className="space-y-6">
      {/* Province Hero Card */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href="/provinces" className="text-slate-600 hover:text-[#0f2942] hover:underline">
            31 省份档案库
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-[#b83a2d]">{region.macro_region_zh}</span>
          <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
            GB/T 2260: {region.geo_code}
          </span>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-slate-600">
            NBS {region.nbs_economic_zone_zh}地区
          </span>
        </div>

        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
              {region.name_zh}{" "}
              <span className="text-lg font-normal text-slate-600">{region.name_en}</span>
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              省会/驻地：{region.capital_zh} ({region.capital_en}) · ISO 代码：{region.iso_3166_2} · 共收录{" "}
              <strong>{metrics.length}</strong> 项跨领域官方指标
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/compare?provs=${region.geo_code},${region.geo_code === "440000" ? "320000,330000" : "440000,320000"}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2942] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#193d60]"
            >
              <GitCompare className="h-3.5 w-3.5" />
              与其他省份对比
            </Link>
            <button
              type="button"
              onClick={handleDownloadProvinceCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-stone-50"
            >
              <Download className="h-3.5 w-3.5" />
              导出本省指标 CSV
            </button>
          </div>
        </div>

        {/* 6 Core Headline KPI Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-100 pt-5 md:grid-cols-3 lg:grid-cols-6">
          {HERO_IDS.map((id) => {
            const m = metricById.get(id);
            if (!m) return null;
            const dec = id === "population" || id === "gdp_per_capita" || id === "disposable_income" ? 0 : id === "gdp" ? 1 : 2;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedMetricId(id)}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedMetricId === id
                    ? "border-[#0f2942] bg-[#0f2942]/5 ring-1 ring-[#0f2942]"
                    : "border-stone-200 bg-[#faf9f6] hover:border-stone-400"
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-600">
                  <span className="truncate">{m.short_zh}</span>
                  {m.rank && (
                    <span className="shrink-0 rounded bg-[#0f2942] px-1.5 py-0.2 text-[10px] font-bold text-white tabular-nums">
                      #{m.rank}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-base font-bold tabular-nums text-[#0f2942]">
                  {formatNum(m.value, dec)}
                  <span className="ml-0.5 text-[10px] font-normal text-slate-600">{m.unit_zh}</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-600 tabular-nums">
                  {m.latest_year}年
                  {m.yoy_pct !== null && (
                    <span className={m.yoy_pct >= 0 ? "ml-1 text-emerald-700" : "ml-1 text-rose-700"}>
                      {m.yoy_pct >= 0 ? "+" : ""}
                      {m.yoy_pct}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Interactive Trend Viewer for Selected Metric */}
      {selectedMetric && (
        <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
          <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-[#0f2942]">
                <TrendingUp className="h-4 w-4 text-[#b83a2d]" />
                {region.short_zh} · {selectedMetric.name_zh} 历史走势
              </h2>
              <p className="text-xs text-slate-600">
                最新值 ({selectedMetric.latest_year})：{selectedMetric.value} {selectedMetric.unit_zh}
                {selectedMetric.rank ? ` · 全国第 ${selectedMetric.rank} / ${selectedMetric.rank_of} 位` : ""}
                {selectedMetric.chg10_pct !== null ? ` · 近十年变动 ${selectedMetric.chg10_pct >= 0 ? "+" : ""}${selectedMetric.chg10_pct}%` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="切换趋势指标"
                value={selectedMetricId}
                onChange={(e) => setSelectedMetricId(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
              >
                {metrics.map((m) => (
                  <option key={m.indicator_id} value={m.indicator_id}>
                    {m.name_zh} ({m.unit_zh})
                  </option>
                ))}
              </select>
              <Link
                href={`/indicators/${selectedMetric.indicator_id}`}
                className="shrink-0 rounded-lg border border-[#0f2942] px-2.5 py-1.5 text-xs font-semibold text-[#0f2942] hover:bg-stone-50"
              >
                指标详情 →
              </Link>
            </div>
          </div>

          <LazyChart option={chartOption} height={320} />
        </section>
      )}

      {/* Full Cross-Domain Scorecard Table */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#0f2942]">
            {region.name_zh} 跨领域全指标记分卡（{filteredMetrics.length} 项）
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveDomain("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeDomain === "all" ? "bg-[#0f2942] text-white" : "bg-stone-100 text-slate-700"
              }`}
            >
              全部
            </button>
            {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setActiveDomain(k)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  activeDomain === k ? "bg-[#0f2942] text-white" : "bg-stone-100 text-slate-700"
                }`}
              >
                {v.zh}
              </button>
            ))}
          </div>
        </div>

        <div className="atlas-scroll overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[#f4f2ec] text-slate-700">
              <tr>
                <th className="px-3 py-2.5">指标名称</th>
                <th className="px-3 py-2.5">领域</th>
                <th className="px-3 py-2.5">最新年</th>
                <th className="px-3 py-2.5 text-right">本省数值</th>
                <th className="px-3 py-2.5 text-right">全国排名</th>
                <th className="px-3 py-2.5 text-right">同比</th>
                <th className="px-3 py-2.5 text-right">十年变动</th>
                <th className="px-3 py-2.5 text-right">同年全国参考</th>
                <th className="px-3 py-2.5">证据级</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {filteredMetrics.map((m) => {
                const ev = EVIDENCE_META[m.evidence_level];
                return (
                  <tr
                    key={m.indicator_id}
                    onClick={() => setSelectedMetricId(m.indicator_id)}
                    className={`cursor-pointer transition hover:bg-stone-50 ${
                      selectedMetricId === m.indicator_id ? "bg-[#0f2942]/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-[#0f2942]">
                      <Link
                        href={`/indicators/${m.indicator_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {m.name_zh}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {DOMAIN_LABELS[m.domain_id]?.zh ?? m.domain_id}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{m.latest_year}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">
                      {m.value.toLocaleString("zh-CN")} <span className="font-normal text-slate-600">{m.unit_zh}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {m.rank ? (
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-bold text-[#0f2942]">
                          #{m.rank} / {m.rank_of}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {m.yoy_pct !== null ? (
                        <span className={m.yoy_pct >= 0 ? "text-emerald-700" : "text-rose-700"}>
                          {m.yoy_pct >= 0 ? "+" : ""}
                          {m.yoy_pct}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {m.chg10_pct !== null ? `${m.chg10_pct >= 0 ? "+" : ""}${m.chg10_pct}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {m.national_value !== null ? m.national_value.toLocaleString("zh-CN") : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${ev.colorClass}`}>
                        {m.evidence_level}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Peer Provinces in Same Geographic Region */}
      {peers.length > 0 && (
        <section className="rounded-2xl border border-[#e2dfd7] bg-[#faf9f6] p-5">
          <div className="text-xs font-bold text-[#0f2942]">
            同属 {region.macro_region_zh} 的兄弟省份档案
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {peers.map((p) => (
              <Link
                key={p.geo_code}
                href={`/provinces/${p.geo_code}`}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-[#0f2942] hover:text-[#0f2942]"
              >
                {p.name_zh} ({p.geo_code}) →
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
