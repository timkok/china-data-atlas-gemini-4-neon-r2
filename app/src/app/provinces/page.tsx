import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getSummary } from "@/lib/data";
import { MACRO_REGION_ORDER } from "@/lib/spatialAdapter";
import { formatNum } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "31 省级行政区综合数据档案库",
  description: "中国内地 31 个省、自治区、直辖市跨领域统计档案，覆盖人口、GDP、人均可支配收入、教育科创、医疗卫生与能源环境。",
};

export default function ProvincesDirectoryPage() {
  const summary = getSummary();
  const cardByCode = new Map(summary.provinceCards.map((c) => [c.geo_code, c]));

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
            31 省级行政区综合数据档案
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            按七大地理大区索引（GB/T 2260 标准行政区划代码）。点击任一省份查看全部 43 项省级指标的全国排名、10 年变化与可追溯原始来源。
          </p>
        </div>
        <Link
          href="/compare"
          className="shrink-0 rounded-xl bg-[#0f2942] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#193d60]"
        >
          打开多省横向对比工具 →
        </Link>
      </div>

      <div className="space-y-6">
        {MACRO_REGION_ORDER.map((group) => (
          <section key={group.key} className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
            <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-2.5">
              <h2 className="text-base font-bold text-[#0f2942]">
                {group.key} · <span className="font-normal text-slate-600">{group.en}</span>
              </h2>
              <span className="text-xs text-slate-600">{group.codes.length} 省区市</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.codes.map((gc) => {
                const p = cardByCode.get(gc);
                if (!p) return null;
                return (
                  <Link
                    key={gc}
                    href={`/provinces/${gc}`}
                    className="group rounded-xl border border-stone-200 bg-[#faf9f6]/60 p-4 transition hover:border-[#0f2942] hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-bold text-[#0f2942] group-hover:text-[#b83a2d]">
                          {p.name_zh}
                        </div>
                        <div className="text-xs text-slate-600">
                          {p.name_en} · <span className="font-mono">{gc}</span> · {p.nbs_economic_zone_zh}
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:text-[#0f2942]" />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-200/70 pt-3 text-xs">
                      <div>
                        <div className="text-[11px] text-slate-600">常住人口 ({p.population_year})</div>
                        <div className="font-bold tabular-nums text-slate-900">
                          {formatNum(p.population, 0)} 万人
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-600">GDP ({p.gdp_year})</div>
                        <div className="font-bold tabular-nums text-slate-900">
                          {formatNum(p.gdp, 1)} 亿元
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-600">人均可支配收入</div>
                        <div className="font-semibold tabular-nums text-slate-800">
                          {formatNum(p.disposable_income, 0)} 元
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-600">65岁+老龄化占比</div>
                        <div className="font-semibold tabular-nums text-slate-800">
                          {formatNum(p.aging_65plus, 2)}%
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-slate-600">
        <strong>口径提示：</strong>国家统计局分省年度数据库覆盖中国内地 31 个省、自治区、直辖市。香港、澳门特别行政区与台湾省采用各自独立的统计局发布体系，未混入内地分省横向榜单。
      </div>
    </div>
  );
}
