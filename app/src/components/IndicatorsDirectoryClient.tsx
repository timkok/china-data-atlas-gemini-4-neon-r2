"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Search, History } from "lucide-react";
import { DOMAIN_LABELS, formatNum } from "@/lib/analytics";
import type { IndicatorSummary } from "@/lib/types";

export default function IndicatorsDirectoryClient({
  indicators,
  initialDomain = "all",
}: {
  indicators: IndicatorSummary[];
  initialDomain?: string;
}) {
  const [domain, setDomain] = useState(initialDomain);
  const [tier, setTier] = useState<"all" | "core" | "expansion">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return indicators.filter((ind) => {
      if (domain !== "all" && ind.domain_id !== domain) return false;
      if (tier === "core" && ind.is_core_r1 !== "true") return false;
      if (tier === "expansion" && ind.is_core_r1 === "true") return false;
      if (
        q &&
        !(
          ind.name_zh.toLowerCase().includes(q) ||
          ind.name_en.toLowerCase().includes(q) ||
          ind.indicator_id.toLowerCase().includes(q) ||
          ind.definition_zh.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [indicators, domain, tier, query]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="筛选指标名称、英文名或定义…"
              className="w-full rounded-lg border border-stone-300 bg-[#faf9f6] py-2 pl-9 pr-3 text-sm focus:border-[#0f2942] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "core", "expansion"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tier === t
                    ? "bg-[#b83a2d] text-white"
                    : "border border-stone-200 bg-stone-50 text-slate-700 hover:bg-stone-100"
                }`}
              >
                {t === "all" ? "全部 (44)" : t === "core" ? "R1 核心 (12)" : "R2 新增扩展 (32)"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
          <button
            type="button"
            onClick={() => setDomain("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              domain === "all"
                ? "bg-[#0f2942] text-white"
                : "bg-stone-100 text-slate-700 hover:bg-stone-200"
            }`}
          >
            全部领域
          </button>
          {Object.entries(DOMAIN_LABELS).map(([k, info]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDomain(k)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                domain === k
                  ? "bg-[#0f2942] text-white"
                  : "bg-stone-100 text-slate-700 hover:bg-stone-200"
              }`}
            >
              {info.zh}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-600">
        当前显示 <strong className="text-slate-900">{filtered.length}</strong> / {indicators.length} 项权威指标
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((ind) => {
          const dec = Number(ind.display_decimals) || 0;
          const dom = DOMAIN_LABELS[ind.domain_id];
          return (
            <Link
              key={ind.indicator_id}
              href={`/indicators/${ind.indicator_id}`}
              className="group flex flex-col justify-between rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs transition hover:border-[#0f2942]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    style={{ color: dom?.accent }}
                    className="font-semibold"
                  >
                    {ind.domain_zh}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {ind.vintages_archived > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        <History className="h-3 w-3" />
                        含修订史
                      </span>
                    )}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        ind.is_core_r1 === "true"
                          ? "bg-[#0f2942] text-white"
                          : "bg-stone-100 text-slate-600"
                      }`}
                    >
                      {ind.is_core_r1 === "true" ? "核心 12" : "R2 扩展"}
                    </span>
                  </div>
                </div>

                <h2 className="mt-2 text-base font-bold text-[#0f2942] group-hover:text-[#b83a2d]">
                  {ind.name_zh}
                </h2>
                <div className="text-xs text-slate-600">{ind.name_en}</div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {ind.definition_zh}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3 text-xs">
                <div>
                  <div className="text-[11px] text-slate-600">
                    全国最新 ({ind.national_latest_year})
                  </div>
                  <div className="font-bold tabular-nums text-slate-900">
                    {formatNum(ind.national_latest_value, dec)} {ind.unit_zh}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-600">年份与样本</div>
                  <div className="font-semibold tabular-nums text-slate-700">
                    {ind.year_min}–{ind.year_max} · {ind.total_rows}条
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
