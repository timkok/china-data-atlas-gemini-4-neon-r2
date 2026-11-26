import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Database,
  GitCompare,
  HelpCircle,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { getStories, getSummary } from "@/lib/data";
import { DOMAIN_LABELS, formatNum } from "@/lib/analytics";
import { MACRO_REGION_ORDER } from "@/lib/spatialAdapter";
import HomeSearchBar from "@/components/HomeSearchBar";

function MiniSparkline({ points, color }: { points: [number, number][]; color: string }) {
  if (!points || points.length < 2) return null;
  const vals = points.map((p) => p[1]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 96;
  const h = 28;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - 3 - ((p[1] - min) / span) * (h - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const POPULAR_QUESTIONS = [
  { label: "过去20年哪几个省份人口增长最快？", q: "过去20年哪几个省份人口增长最快" },
  { label: "对比广东与江苏近10年GDP变化", q: "对比广东与江苏近10年GDP变化" },
  { label: "浙江居民人均可支配收入的全国排名演变", q: "浙江居民人均可支配收入的全国排名演变" },
  { label: "2020年全国老龄化（65岁+）最高的5个省份", q: "2020年全国老龄化最高的省份" },
  { label: "老龄化程度与医疗资源配置是否相关？", q: "老龄化程度与医疗资源配置是否相关" },
  { label: "东北三省2010年以来常住人口减少了多少？", q: "东北三省常住人口变化" },
];

export default function HomePage() {
  const summary = getSummary();
  const stories = getStories();
  const { stats } = summary;

  const searchItems = [
    ...summary.indicators.map((ind) => ({
      type: "indicator" as const,
      title: ind.name_zh,
      subtitle: `${ind.domain_zh} · ${ind.unit_zh} · ${ind.year_min}–${ind.year_max}`,
      href: `/indicators/${ind.indicator_id}`,
      keywords: `${ind.indicator_id} ${ind.name_en} ${ind.short_zh}`,
    })),
    ...summary.regions
      .filter((r) => r.geo_code !== "000000")
      .map((reg) => ({
        type: "province" as const,
        title: `${reg.name_zh}（省份档案）`,
        subtitle: `${reg.macro_region_zh} · ${reg.nbs_economic_zone_zh} · GB/T 2260 ${reg.geo_code}`,
        href: `/provinces/${reg.geo_code}`,
        keywords: `${reg.short_zh} ${reg.name_en} ${reg.capital_zh}`,
      })),
    ...stories.map((st) => ({
      type: "story" as const,
      title: st.title_zh,
      subtitle: `数据故事 · ${st.tag}`,
      href: `/stories/${st.slug}`,
      keywords: `${st.tag} ${st.title_en}`,
    })),
  ];

  const domainKeys = ["demographics", "economy", "education_rd", "healthcare", "energy_env_infra"];
  const provByCode = new Map(summary.provinceCards.map((p) => [p.geo_code, p]));

  return (
    <div className="space-y-12">
      {/* Editorial Discovery Masthead */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-xs sm:p-9">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-[#0f2942] px-3 py-1 text-white">
            Round 2 · 跨模型核验升级版
          </span>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-emerald-900">
            官方直采 · 零虚构 · E1–E4 证据分级
          </span>
          <span className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-slate-700">
            覆盖 {stats.year_min}–{stats.year_max} 年
          </span>
        </div>

        <h1 className="mt-4 max-w-4xl text-3xl font-extrabold tracking-tight text-[#0f2942] sm:text-4xl">
          中国数据地图 <span className="font-normal text-slate-600">|</span> China Data Atlas
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
          <strong>Make China&apos;s Data Accessible, Understandable, Traceable and Explorable.</strong>{" "}
          将国家统计局、教育部、国家卫健委等公开官方统计数据，整合为可追溯、可对比、保留历史修订版本（五经普/七普/卫健委口径）并可一键导出 CSV 的开放研究平台。
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <HomeSearchBar items={searchItems} />
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f2942] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#193d60]"
            >
              <Compass className="h-4 w-4" />
              数据探索器
            </Link>
            <Link
              href="/compare"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#0f2942] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f2942] transition hover:bg-stone-50"
            >
              <GitCompare className="h-4 w-4" />
              多省对比
            </Link>
          </div>
        </div>

        {/* Live Platform KPI Strip */}
        <div className="mt-8 grid grid-cols-2 gap-3 border-t border-stone-100 pt-6 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl bg-[#faf9f6] p-3.5">
            <div className="text-xs text-slate-600">权威统计指标</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#0f2942]">
              {stats.total_indicators} <span className="text-xs font-normal text-slate-600">项</span>
            </div>
            <div className="text-[11px] text-slate-600">12核心 + 32扩展</div>
          </div>
          <div className="rounded-xl bg-[#faf9f6] p-3.5">
            <div className="text-xs text-slate-600">官方观测记录</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#0f2942]">
              {stats.total_observations.toLocaleString("zh-CN")}
            </div>
            <div className="text-[11px] text-slate-600">0 条未核验 E0 数据</div>
          </div>
          <div className="rounded-xl bg-[#faf9f6] p-3.5">
            <div className="text-xs text-slate-600">多版本历史归档</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#1e6b52]">
              {stats.vintages_count.toLocaleString("zh-CN")}
            </div>
            <div className="text-[11px] text-slate-600">五经普/七普/卫健委对照</div>
          </div>
          <div className="rounded-xl bg-[#faf9f6] p-3.5">
            <div className="text-xs text-slate-600">跨模型冲突裁决</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#b83a2d]">
              {stats.resolved_conflicts_count.toLocaleString("zh-CN")}
            </div>
            <div className="text-[11px] text-slate-600">审计全部 9 个 R1 交付目录</div>
          </div>
          <div className="col-span-2 rounded-xl bg-[#faf9f6] p-3.5 sm:col-span-1">
            <div className="text-xs text-slate-600">空间覆盖</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#0f2942]">
              全国 + 31 <span className="text-xs font-normal text-slate-600">省</span>
            </div>
            <div className="text-[11px] text-slate-600">GB/T 2260 标准编码</div>
          </div>
        </div>
      </section>

      {/* Popular Research Questions -> Deterministic Query Engine */}
      <section aria-labelledby="questions-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="questions-heading" className="flex items-center gap-2 text-xl font-bold text-[#0f2942]">
              <HelpCircle className="h-5 w-5 text-[#b83a2d]" />
              热门统计研究问题
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              点击任意问题直接调用规则化统计研究查询引擎，输出可复现公式、交互图表与官方溯源。
            </p>
          </div>
          <Link href="/assistant" className="shrink-0 text-sm font-semibold text-[#0f2942] hover:underline">
            打开研究查询引擎 →
          </Link>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR_QUESTIONS.map((pq) => (
            <Link
              key={pq.label}
              href={`/assistant?q=${encodeURIComponent(pq.q)}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[#e2dfd7] bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-2xs transition hover:border-[#0f2942] hover:bg-stone-50"
            >
              <span>{pq.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-[#0f2942]" />
            </Link>
          ))}
        </div>
      </section>

      {/* 5 Thematic Domain Hubs */}
      <section aria-labelledby="domains-heading" className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="domains-heading" className="text-xl font-bold text-[#0f2942]">
              五大主题数据枢纽（44 项官方指标）
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              每个专题页均提供合规省级空间矩阵、多省趋势（原始值 / 同比增速 / 定基指数 / 对数坐标）、历史修订版本抽屉与同步 CSV 下载。
            </p>
          </div>
          <Link href="/indicators" className="shrink-0 text-sm font-semibold text-[#0f2942] hover:underline">
            浏览全部 44 项指标 →
          </Link>
        </div>

        <div className="space-y-6">
          {domainKeys.map((dk) => {
            const dmeta = DOMAIN_LABELS[dk];
            const inds = summary.indicators.filter((i) => i.domain_id === dk);
            // Display up to 4 highlighted indicators per domain on homepage (prioritizing core R1)
            const featured = [...inds]
              .sort((a, b) => (b.is_core_r1 === "true" ? 1 : 0) - (a.is_core_r1 === "true" ? 1 : 0))
              .slice(0, 4);
            return (
              <div key={dk} className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{ backgroundColor: dmeta.accent }}
                      className="h-3 w-3 rounded-full"
                    />
                    <h3 className="text-base font-bold text-[#0f2942]">
                      {dmeta.zh} <span className="text-xs font-normal text-slate-600">{dmeta.en}</span>
                    </h3>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {inds.length} 项指标
                    </span>
                  </div>
                  <Link
                    href={`/indicators?domain=${dk}`}
                    className="text-xs font-semibold text-[#0f2942] hover:underline"
                  >
                    查看全部 {inds.length} 项 →
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {featured.map((ind) => {
                    const dec = Number(ind.display_decimals) || 0;
                    return (
                      <Link
                        key={ind.indicator_id}
                        href={`/indicators/${ind.indicator_id}`}
                        className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-[#faf9f6]/60 p-3.5 transition hover:border-[#0f2942] hover:bg-white"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-bold text-[#0f2942] group-hover:text-[#b83a2d]">
                              {ind.name_zh}
                            </span>
                            {ind.is_core_r1 === "true" && (
                              <span className="shrink-0 rounded bg-[#0f2942]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0f2942]">
                                核心
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-600">
                            {ind.year_min}–{ind.year_max} · {ind.unit_zh}
                          </div>
                        </div>

                        <div className="mt-3 flex items-end justify-between gap-2">
                          <div>
                            <div className="text-[10px] text-slate-600">
                              全国 ({ind.national_latest_year})
                            </div>
                            <div className="text-base font-bold tabular-nums text-slate-900">
                              {formatNum(ind.national_latest_value, dec)}
                            </div>
                          </div>
                          <MiniSparkline points={ind.sparkline} color={dmeta.accent} />
                        </div>

                        {ind.top_province && (
                          <div className="mt-2.5 border-t border-stone-200/70 pt-2 text-[11px] text-slate-600">
                            {ind.complete_comparable_year} 首位：
                            <strong className="text-slate-800">{ind.top_province.name_zh}</strong>（
                            <span className="tabular-nums">
                              {formatNum(ind.top_province.value, dec)}
                            </span>
                            ）
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Featured Reproducible Data Stories */}
      <section aria-labelledby="stories-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="stories-heading" className="flex items-center gap-2 text-xl font-bold text-[#0f2942]">
              <BookOpen className="h-5 w-5 text-[#1e6b52]" />
              精选可复现数据故事（6 篇）
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              全部由数据管道实时计算生成，严格区分“统计事实”与“分析推断”，附带计算公式与口径局限。
            </p>
          </div>
          <Link href="/stories" className="shrink-0 text-sm font-semibold text-[#0f2942] hover:underline">
            阅读全部故事 →
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stories.map((st) => (
            <Link
              key={st.slug}
              href={`/stories/${st.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs transition hover:border-[#0f2942]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="rounded-full bg-[#1e6b52]/10 px-2.5 py-0.5 font-semibold text-[#1e6b52]">
                    {st.tag}
                  </span>
                  <span className="text-slate-600">约 {st.reading_minutes} 分钟阅读</span>
                </div>
                <h3 className="mt-3 text-base font-bold leading-snug text-[#0f2942] group-hover:text-[#b83a2d]">
                  {st.title_zh}
                </h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">
                  {st.summary_zh}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-semibold text-[#0f2942]">
                <span>{st.kpis[0]?.value}</span>
                <span className="group-hover:translate-x-0.5 transition">阅读分析 →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 31 Provinces Quick Directory */}
      <section aria-labelledby="provinces-heading" className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="provinces-heading" className="text-xl font-bold text-[#0f2942]">
              31 省级行政区综合数据档案
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              按七大地理大区索引，进入单省档案查看全部指标全国排名、十年变化与多维趋势（GB/T 2260 标准编码）。
            </p>
          </div>
          <Link href="/provinces" className="text-sm font-semibold text-[#0f2942] hover:underline">
            进入完整省份档案库 →
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {MACRO_REGION_ORDER.map((grp) => (
            <div key={grp.key} className="rounded-xl border border-stone-200 bg-[#faf9f6] p-3.5">
              <div className="mb-2 text-xs font-bold text-[#0f2942]">
                {grp.key} <span className="font-normal text-slate-600">({grp.codes.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {grp.codes.map((gc) => {
                  const p = provByCode.get(gc);
                  return (
                    <Link
                      key={gc}
                      href={`/provinces/${gc}`}
                      className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 transition hover:border-[#0f2942] hover:bg-[#0f2942] hover:text-white"
                    >
                      {p?.short_zh ?? gc}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex flex-col justify-between rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-3.5 text-xs text-slate-600">
            <div>
              <div className="font-bold text-[#0f2942]">跨省横向对比</div>
              <p className="mt-1 leading-relaxed">
                同时对比 2–5 个省份的人口、GDP、人均可支配收入、城镇化、老龄化与医疗配置。
              </p>
            </div>
            <Link
              href="/compare"
              className="mt-3 inline-flex items-center gap-1 font-semibold text-[#b83a2d] hover:underline"
            >
              打开粤苏浙默认对比 →
            </Link>
          </div>
        </div>
      </section>

      {/* Audit Transparency & Open Data Bar */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#e2dfd7] bg-[#0f2942] p-6 text-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Scale className="h-4 w-4" />
            ROUND 1 → ROUND 2 跨模型交叉审计中心
          </div>
          <h2 className="mt-2 text-lg font-bold">
            公开审计全部 {stats.r1_models_audited} 个 Round 1 模型目录与 {stats.resolved_conflicts_count.toLocaleString("zh-CN")} 条分歧裁决
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            不采用少数服从多数或取平均，逐项依据国家统计局/教育部/卫健委原始证据裁决（包括彻底厘清 Grok 与 Gemini 4 Neon 每千人医师 125 条记录差异及自我审计 R1 缺陷）。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/audit"
              className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#0f2942] hover:bg-stone-100"
            >
              查看跨模型审计报告 →
            </Link>
            <Link
              href="/methodology"
              className="rounded-lg border border-white/30 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
            >
              证据分级与更新机制
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e2dfd7] bg-white p-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1e6b52]">
            <Database className="h-4 w-4" />
            开放数据下载与可追溯数据字典
          </div>
          <h2 className="mt-2 text-lg font-bold text-[#0f2942]">
            每条观测均保留原始值、原始单位、来源表与证据级别
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            底层官方统计事实归属原发布机构（不声明 CC0）；提供完整规范化 CSV、历史修订版本库 CSV 与 JSON 数据字典，支持一键导入 Excel / Python / DuckDB / R。
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5 text-xs">
            <a
              href="/data/observations.csv"
              download
              className="inline-flex items-center gap-1 rounded-lg bg-[#1e6b52] px-3.5 py-2 font-semibold text-white hover:bg-[#175541]"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              下载完整观测 CSV
            </a>
            <a
              href="/data/vintages.csv"
              download
              className="rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 font-semibold text-slate-800 hover:bg-stone-100"
            >
              下载历史修订版本 CSV
            </a>
            <a
              href="/data/data-dictionary.json"
              download
              className="rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 font-semibold text-slate-800 hover:bg-stone-100"
            >
              数据字典 JSON
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
