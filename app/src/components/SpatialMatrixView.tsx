"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Map as MapIcon, ArrowUpRight, Info } from "lucide-react";
import {
  CHOROPLETH_PALETTE,
  MACRO_REGION_ORDER,
  REGIONAL_MATRIX_ADAPTER,
  TIANDITU_PROVIDER_ADAPTER,
  getQuantileBucket,
} from "@/lib/spatialAdapter";
import { formatNum } from "@/lib/analytics";
import type { RegionMeta } from "@/lib/types";

interface SpatialMatrixViewProps {
  year: number;
  unit: string;
  decimals: number;
  regions: RegionMeta[];
  valuesByGeo: Record<string, number>;
  selectedGeo?: string;
  onSelectGeo?: (geoCode: string) => void;
}

export default function SpatialMatrixView({
  year,
  unit,
  decimals,
  regions,
  valuesByGeo,
  selectedGeo,
  onSelectGeo,
}: SpatialMatrixViewProps) {
  const [showCompliance, setShowCompliance] = useState(false);

  const regionByCode = useMemo(
    () => new Map(regions.map((r) => [r.geo_code, r])),
    [regions]
  );

  const { sortedVals, rankMap } = useMemo(() => {
    const entries = Object.entries(valuesByGeo)
      .filter(([gc]) => gc !== "000000")
      .sort((a, b) => b[1] - a[1]);
    const rMap = new Map<string, number>();
    entries.forEach(([gc], i) => rMap.set(gc, i + 1));
    const asc = entries.map(([, v]) => v).sort((a, b) => a - b);
    return { sortedVals: asc, rankMap: rMap };
  }, [valuesByGeo]);

  const countValid = sortedVals.length;

  return (
    <div className="space-y-4">
      {/* Header & Quantile Legend */}
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-[#e2dfd7] bg-[#faf9f6] p-3.5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0f2942]">
            <MapIcon className="h-4 w-4 text-[#b83a2d]" />
            <span>{year} 年 · 七大地理大区省级空间矩阵（n = {countValid} 省）</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            按五分位定量色阶编码，点击任意省份查看趋势高亮或进入省份综合档案。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-600">低</span>
          {CHOROPLETH_PALETTE.map((swatch, idx) => (
            <span
              key={idx}
              style={{ backgroundColor: swatch.bg, borderColor: swatch.border }}
              className="h-4 w-6 rounded border"
              title={`分位档 Q${idx + 1}`}
            />
          ))}
          <span className="text-[11px] font-medium text-slate-600">高 ({unit})</span>
          <button
            type="button"
            onClick={() => setShowCompliance((v) => !v)}
            className="ml-2 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            地图合规与插件接口说明
          </button>
        </div>
      </div>

      {showCompliance && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950">
          <div className="font-semibold text-amber-950">
            SpatialViewAdapter 状态：{REGIONAL_MATRIX_ADAPTER.mapStatus}
          </div>
          <p className="mt-1">{REGIONAL_MATRIX_ADAPTER.getComplianceNotice()}</p>
          <p className="mt-1.5 text-amber-900/90">
            <strong>天地图插件状态：</strong>
            {TIANDITU_PROVIDER_ADAPTER.isAvailable()
              ? "已检测到 NEXT_PUBLIC_TIANDITU_TK"
              : TIANDITU_PROVIDER_ADAPTER.getComplianceNotice()}
          </p>
          <Link href="/methodology#map-compliance" className="mt-2 inline-block font-semibold underline">
            阅读完整《中国地图合规研究报告》 →
          </Link>
        </div>
      )}

      {/* 7-Region Responsive Spatial Tile Matrix */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MACRO_REGION_ORDER.map((group) => (
          <div
            key={group.key}
            className="rounded-xl border border-[#e2dfd7] bg-white p-3.5 shadow-2xs"
          >
            <div className="mb-2.5 flex items-center justify-between border-b border-stone-100 pb-1.5">
              <span className="text-xs font-bold tracking-wide text-[#0f2942]">
                {group.key} · <span className="font-normal text-slate-600">{group.en}</span>
              </span>
              <span className="text-[11px] text-slate-600">{group.codes.length} 省区市</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.codes.map((gc) => {
                const reg = regionByCode.get(gc);
                const val = valuesByGeo[gc] ?? null;
                const rank = rankMap.get(gc) ?? null;
                const bucket = getQuantileBucket(val, sortedVals);
                const style =
                  bucket >= 0
                    ? CHOROPLETH_PALETTE[bucket]
                    : { bg: "#F5F5F4", text: "#78716C", border: "#E7E5E4" };
                const isSelected = selectedGeo === gc;
                return (
                  <div
                    key={gc}
                    style={{
                      backgroundColor: style.bg,
                      color: style.text,
                      borderColor: isSelected ? "#B83A2D" : style.border,
                    }}
                    onClick={() => onSelectGeo?.(gc)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelectGeo?.(gc);
                    }}
                    className={`group relative cursor-pointer rounded-lg border p-2.5 transition hover:scale-[1.01] ${
                      isSelected ? "ring-2 ring-[#b83a2d]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold">{reg?.short_zh ?? gc}</span>
                      {rank !== null && (
                        <span className="rounded bg-black/15 px-1.5 py-0.2 text-[10px] font-semibold tabular-nums">
                          #{rank}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm font-bold tabular-nums">
                      {val !== null ? formatNum(val, decimals) : "暂无"}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] opacity-80">
                      <span className="truncate">{unit}</span>
                      <Link
                        href={`/provinces/${gc}`}
                        onClick={(e) => e.stopPropagation()}
                        title={`查看${reg?.name_zh}综合档案`}
                        className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
                      >
                        档案
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Explicit Mainland 31-Province Scope Footnote */}
      <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
        <span>
          <strong>统计口径说明：</strong>本视图覆盖国家统计局内地31个省、自治区、直辖市（GB/T 2260编码）。香港特别行政区、澳门特别行政区与台湾省采用独立统计发布体系，未纳入内地分省统计表，本展示不涉及任何行政区划边界绘制或地理归属判断。
        </span>
      </div>
    </div>
  );
}
