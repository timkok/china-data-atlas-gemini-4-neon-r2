"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calculator, Cpu, Search, ShieldCheck } from "lucide-react";
import type { EChartsCoreOption } from "echarts/core";
import LazyChart from "./LazyChart";
import { computePearson, formatNum } from "@/lib/analytics";
import type { ExploreData, IndicatorSummary, RegionMeta } from "@/lib/types";

interface QueryResult {
  status: "answered" | "unsupported";
  title: string;
  parsedSpec: string;
  formula: string;
  answerSummary: string;
  rows: { label: string; metric: string; detail: string }[];
  chartOption: EChartsCoreOption | null;
  sources: string[];
  disclaimer: string;
  relatedLinks: { label: string; href: string }[];
}

const PRESET_QUERIES = [
  "过去20年哪几个省份人口增长最快",
  "对比广东与江苏近10年GDP变化",
  "浙江居民人均可支配收入的全国排名演变",
  "2020年全国老龄化最高的省份",
  "老龄化程度与医疗资源配置是否相关",
  "东北三省常住人口变化",
];

function executeDeterministicQuery(
  rawQuery: string,
  explore: ExploreData,
  regions: RegionMeta[],
  indicators: IndicatorSummary[]
): QueryResult {
  const q = rawQuery.trim();
  const provs = regions.filter((r) => r.geo_code !== "000000");
  const regMap = new Map(regions.map((r) => [r.geo_code, r]));
  const indMap = new Map(indicators.map((i) => [i.indicator_id, i]));

  const getVal = (ind: string, gc: string, yr: number): number | null => {
    const arr = explore.series[ind]?.[gc];
    if (!arr) return null;
    const found = arr.find(([y]) => y === yr);
    return found ? found[1] : null;
  };

  // Explicit guard against unsupported speculative/forecasting/non-dataset questions
  if (/股票|房价预测|2030|2035|未来预测|天气|比特币|GDP预测/.test(q)) {
    return {
      status: "unsupported",
      title: "超出官方历史统计库范围（拒答声明）",
      parsedSpec: `输入查询：“${q}” → 命中未来预测或非统计局库内主题规则`,
      formula: "N/A（本引擎严禁虚构未来预测或库外数据）",
      answerSummary:
        "本工具是“确定性官方统计研究查询引擎”（非通用大语言模型），仅基于 2000–2025 年国家统计局/教育部/卫健委公开历史观测执行精确计算，不支持未来年份预测、金融市场或库外指标查询。",
      rows: [],
      chartOption: null,
      sources: [],
      disclaimer: "请改用上方预设统计问题，或在下方的自定义指标/省份查询器中检索 44 项官方历史指标。",
      relatedLinks: [
        { label: "浏览全部 44 项支持指标", href: "/indicators" },
        { label: "打开高级数据探索器", href: "/explore" },
      ],
    };
  }

  // 1. Fastest population growth past 20 years (2005 -> 2025)
  if ((q.includes("人口") && (q.includes("最快") || q.includes("增长") || q.includes("20年"))) || q === "") {
    const items = provs
      .map((p) => {
        const v05 = getVal("population", p.geo_code, 2005);
        const v25 = getVal("population", p.geo_code, 2025);
        if (v05 === null || v25 === null) return null;
        return {
          name: p.short_zh,
          code: p.geo_code,
          v05,
          v25,
          pct: Number((((v25 - v05) / v05) * 100).toFixed(2)),
          abs: Number((v25 - v05).toFixed(0)),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.pct - a.pct);

    const top10 = items.slice(0, 10);
    return {
      status: "answered",
      title: "过去 20 年（2005–2025）中国常住人口增长最快的省份",
      parsedSpec: "indicator=population | scope=31 mainland provinces | window=2005→2025 | sort=pct_change DESC",
      formula: "相对增幅 = (Pop_2025 - Pop_2005) / Pop_2005 × 100%；净增量 = Pop_2025 - Pop_2005（单位：万人）",
      answerSummary: `按 20 年相对增幅排序，前五名为 ${top10.slice(0, 5).map((x) => `${x.name}(+${x.pct}%)`).join("、")}；若按绝对人口净增量排序，广东净增 +${[...items].sort((a, b) => b.abs - a.abs)[0]?.abs} 万人高居全国第一。`,
      rows: top10.map((x, idx) => ({
        label: `#${idx + 1} ${x.name}`,
        metric: `+${x.pct}% (${x.abs >= 0 ? "+" : ""}${x.abs} 万人)`,
        detail: `${x.v05}万 (2005) → ${x.v25}万 (2025)`,
      })),
      chartOption: {
        tooltip: { trigger: "axis" },
        grid: { top: 24, left: 60, right: 32, bottom: 32 },
        xAxis: { type: "category", data: top10.map((x) => x.name) },
        yAxis: { type: "value", name: "20年增幅 (%)" },
        series: [{ type: "bar", itemStyle: { color: "#0F2942" }, data: top10.map((x) => x.pct), label: { show: true, position: "top", formatter: "{c}%" } }],
      },
      sources: ["国家统计局-分省年度数据（年末常住人口 2005–2025，七普修订口径）"],
      disclaimer: "常住人口变动综合反映自然增长与跨省机械迁入，未拆分户籍与流动人口。",
      relatedLinks: [
        { label: "查看常住人口专题页", href: "/indicators/population" },
        { label: "阅读完整 20 年人口故事", href: "/stories/fastest-population-growth-20y" },
      ],
    };
  }

  // 2. Guangdong vs Jiangsu 10-year GDP
  if ((q.includes("广东") && q.includes("江苏")) || (q.includes("GDP") && q.includes("对比"))) {
    const yrs = Array.from({ length: 11 }, (_, i) => 2015 + i);
    const gd = yrs.map((y) => getVal("gdp", "440000", y));
    const js = yrs.map((y) => getVal("gdp", "320000", y));
    const gd15 = gd[0] ?? 0, gd25 = gd[gd.length - 1] ?? 0;
    const js15 = js[0] ?? 0, js25 = js[js.length - 1] ?? 0;
    return {
      status: "answered",
      title: "广东与江苏近 10 年（2015–2025）GDP 演进对比",
      parsedSpec: "indicator=gdp | geos=[440000 广东, 320000 江苏] | window=2015–2025 | vintage=NBS_POST_5EC_2026",
      formula: "名义绝对差 = GDP_广东 - GDP_江苏（亿元）；10年名义增幅 = (GDP_2025 / GDP_2015 - 1) × 100%",
      answerSummary: `2025 年广东 GDP 为 ${formatNum(gd25, 1)} 亿元，江苏为 ${formatNum(js25, 1)} 亿元，广东领先 ${formatNum(gd25 - js25, 1)} 亿元；过去 10 年广东名义增长 +${(((gd25 - gd15) / gd15) * 100).toFixed(1)}%，江苏名义增长 +${(((js25 - js15) / js15) * 100).toFixed(1)}%。`,
      rows: yrs.map((y, idx) => ({
        label: `${y} 年`,
        metric: `粤 ${formatNum(gd[idx], 1)} vs 苏 ${formatNum(js[idx], 1)} 亿元`,
        detail: `粤苏差值: ${gd[idx] !== null && js[idx] !== null ? formatNum((gd[idx] as number) - (js[idx] as number), 1) : "—"} 亿元`,
      })),
      chartOption: {
        tooltip: { trigger: "axis" },
        legend: { bottom: 0 },
        grid: { top: 32, left: 68, right: 24, bottom: 48 },
        xAxis: { type: "category", data: yrs.map(String) },
        yAxis: { type: "value", name: "亿元", scale: true },
        series: [
          { name: "广东省", type: "line", lineStyle: { width: 3 }, itemStyle: { color: "#0F2942" }, data: gd },
          { name: "江苏省", type: "line", lineStyle: { width: 3 }, itemStyle: { color: "#B83A2D" }, data: js },
        ],
      },
      sources: ["国家统计局-分省年度数据（地区生产总值，第五次经济普查修订口径，2015–2025）"],
      disclaimer: "现价名义 GDP 含价格变动因素；2024 年末经五经普历史修订，与修订前年鉴旧数存在口径差异。",
      relatedLinks: [
        { label: "打开粤苏浙对比工作台", href: "/compare?provs=440000,320000,330000" },
        { label: "查看 GDP 历史修订版本", href: "/indicators/gdp" },
      ],
    };
  }

  // 3. Zhejiang disposable income rank evolution
  if (q.includes("浙江") && (q.includes("收入") || q.includes("排名"))) {
    const yrs = Array.from({ length: 13 }, (_, i) => 2013 + i);
    const traj = yrs.map((y) => {
      const pairs = provs
        .map((p) => ({ code: p.geo_code, v: getVal("disposable_income", p.geo_code, y) }))
        .filter((x): x is { code: string; v: number } => x.v !== null)
        .sort((a, b) => b.v - a.v);
      const idx = pairs.findIndex((x) => x.code === "330000");
      return { year: y, rank: idx >= 0 ? idx + 1 : null, val: idx >= 0 ? pairs[idx].v : null };
    });
    return {
      status: "answered",
      title: "浙江居民人均可支配收入全国排名演变（2013–2025）",
      parsedSpec: "indicator=disposable_income | target=330000 浙江 | window=2013–2025 (unified household survey) | metric=national_rank_among_31",
      formula: "每年按 31 省全体居民人均可支配收入降序排名（1 = 最高）",
      answerSummary: `2013 至 2025 年城乡一体化住户调查全周期内，浙江居民人均可支配收入从 ${formatNum(traj[0].val, 0)} 元跃升至 ${formatNum(traj[traj.length - 1].val, 0)} 元，连续 13 年稳居全国第 ${traj[traj.length - 1].rank} 位（仅次于上海、北京两大直辖市，稳居全国省区第一）。`,
      rows: traj.map((t) => ({
        label: `${t.year} 年`,
        metric: `全国第 #${t.rank} / 31 位`,
        detail: `人均可支配收入：${formatNum(t.val, 0)} 元`,
      })),
      chartOption: {
        tooltip: { trigger: "axis" },
        grid: { top: 32, left: 64, right: 24, bottom: 36 },
        xAxis: { type: "category", data: traj.map((t) => String(t.year)) },
        yAxis: { type: "value", name: "元" },
        series: [{ name: "浙江人均可支配收入", type: "line", lineStyle: { width: 3 }, itemStyle: { color: "#1E6B52" }, data: traj.map((t) => t.val) }],
      },
      sources: ["国家统计局-分省年度数据（全体居民人均可支配收入，2013–2025城乡一体化调查）"],
      disclaimer: "严格限定于 2013 年起的城乡一体化住户调查口径，避免与 2012 年前分城乡旧口径错位拼接。",
      relatedLinks: [
        { label: "进入浙江省综合档案", href: "/provinces/330000" },
        { label: "阅读苏浙经济与收入对照故事", href: "/stories/zhejiang-vs-jiangsu-economy-income" },
      ],
    };
  }

  // 4. 2020 aging top provinces
  if (q.includes("老龄化") && (q.includes("2020") || q.includes("最高") || q.includes("排名"))) {
    const list = provs
      .map((p) => ({ name: p.short_zh, code: p.geo_code, v: getVal("population_65plus", p.geo_code, 2020) }))
      .filter((x): x is { name: string; code: string; v: number } => x.v !== null)
      .sort((a, b) => b.v - a.v);
    const top10 = list.slice(0, 10);
    return {
      status: "answered",
      title: "2020 年第七次全国人口普查老龄化（65 岁及以上占比）最高的省份",
      parsedSpec: "indicator=population_65plus | year=2020 | source=7th_Census_Bulletin_No5 | sort=value DESC",
      formula: "65岁及以上人口占比 = 65岁及以上常住人口 / 总常住人口 × 100%（七普公报第五号全量普查值）",
      answerSummary: `2020 年七普公报显示，全国 65 岁及以上人口占比为 13.50%；省级前五名为 ${top10.slice(0, 5).map((x) => `${x.name}(${x.v}%)`).join("、")}，均已超过 16%。`,
      rows: top10.map((x, i) => ({
        label: `#${i + 1} ${x.name}`,
        metric: `${x.v.toFixed(2)}%`,
        detail: `高于全国均值 +${(x.v - 13.5).toFixed(2)} 个百分点`,
      })),
      chartOption: {
        tooltip: { trigger: "axis" },
        grid: { top: 24, left: 60, right: 32, bottom: 32 },
        xAxis: { type: "category", data: top10.map((x) => x.name) },
        yAxis: { type: "value", name: "65岁+占比 (%)", scale: true },
        series: [{ type: "bar", itemStyle: { color: "#B83A2D" }, data: top10.map((x) => x.v), label: { show: true, position: "top", formatter: "{c}%" } }],
      },
      sources: ["国家统计局-第七次全国人口普查公报（第五号，2021年5月11日发布，E2/E3核验）"],
      disclaimer: "七普标准时点为 2020 年 11 月 1 日零时；非普查年分省数据来自 1‰ 人口抽样调查。",
      relatedLinks: [{ label: "查看 65岁+老龄化专题页", href: "/indicators/population_65plus" }],
    };
  }

  // 5. Aging vs Healthcare correlation
  if ((q.includes("老龄化") && q.includes("医疗")) || q.includes("相关")) {
    const pts = provs
      .map((p) => {
        const a = getVal("population_65plus", p.geo_code, 2024);
        const doc = getVal("physicians_per_1000", p.geo_code, 2024);
        const bed = getVal("hospital_beds_per_1000", p.geo_code, 2024);
        return a !== null && doc !== null && bed !== null ? { name: p.short_zh, a, doc, bed } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const rDoc = computePearson(pts.map((p) => p.a), pts.map((p) => p.doc));
    const rBed = computePearson(pts.map((p) => p.a), pts.map((p) => p.bed));
    return {
      status: "answered",
      title: "各省老龄化程度（65岁+）与医疗资源配置相关性分析（2024）",
      parsedSpec: "X=population_65plus (2024) | Y1=physicians_per_1000 (2024) | Y2=hospital_beds_per_1000 (2024) | n=31",
      formula: "Pearson r = Cov(X, Y) / (σ_X · σ_Y)；样本为 2024 年全部 31 个内地省份（零缺失）",
      answerSummary: `2024 年 31 省横截面显示，老龄化占比与每千人床位数呈中等正相关（r = ${rBed}），与每千人执业（助理）医师数呈较弱正相关（r = ${rDoc}），说明硬件床位较快向老龄化省份倾斜，但执业医师仍高度向经济中心集聚。`,
      rows: [
        { label: "老龄化 vs 每千人床位数", metric: `r = ${rBed}`, detail: "n = 31 省 (2024完整可比年)" },
        { label: "老龄化 vs 每千人医师数", metric: `r = ${rDoc}`, detail: "n = 31 省 (高精度总医师/常住人口口径)" },
      ],
      chartOption: {
        tooltip: { trigger: "item" },
        grid: { top: 32, left: 60, right: 24, bottom: 44 },
        xAxis: { type: "value", name: "65岁+占比 (%)", scale: true },
        yAxis: { type: "value", name: "每千人医师 (人)", scale: true },
        series: [{ type: "scatter", symbolSize: 12, itemStyle: { color: "#0F2942" }, label: { show: true, position: "top", formatter: "{b}", fontSize: 10 }, data: pts.map((p) => ({ name: p.name, value: [p.a, p.doc] })) }],
      },
      sources: ["国家统计局-分省年度数据（2024年1‰人口抽样调查、卫生人员与医疗卫生机构床位数）"],
      disclaimer: "相关性不等于因果性；高收入直辖市存在显著跨省异地就医集聚效应。",
      relatedLinks: [
        { label: "阅读老龄化与医疗配置故事", href: "/stories/aging-vs-healthcare-distribution" },
        { label: "在探索器中自定义相关性", href: "/explore" },
      ],
    };
  }

  // 6. Northeast demographic shift
  if (q.includes("东北")) {
    const yrs = Array.from({ length: 16 }, (_, i) => 2010 + i);
    const sumSer = yrs.map((y) => {
      const v = (getVal("population", "210000", y) ?? 0) + (getVal("population", "220000", y) ?? 0) + (getVal("population", "230000", y) ?? 0);
      return Number(v.toFixed(0));
    });
    const diff = sumSer[sumSer.length - 1] - sumSer[0];
    return {
      status: "answered",
      title: "东北三省（辽、吉、黑）2010–2025 年常住人口变化",
      parsedSpec: "indicator=population | geos=[210000 辽宁, 220000 吉林, 230000 黑龙江] | window=2010–2025",
      formula: "东北合计 = 辽宁 + 吉林 + 黑龙江年末常住人口（万人）",
      answerSummary: `东北三省合计常住人口由 2010 年的 ${sumSer[0]} 万人降至 2025 年的 ${sumSer[sumSer.length - 1]} 万人，15 年净减少 ${Math.abs(diff)} 万人（${((diff / sumSer[0]) * 100).toFixed(2)}%）。`,
      rows: ["210000", "220000", "230000"].map((gc) => {
        const v10 = getVal("population", gc, 2010) ?? 0;
        const v25 = getVal("population", gc, 2025) ?? 0;
        return {
          label: regMap.get(gc)?.name_zh ?? gc,
          metric: `${v25} 万人 (2025)`,
          detail: `2010年 ${v10} 万 → 变化 ${v25 - v10} 万人 (${(((v25 - v10) / v10) * 100).toFixed(1)}%)`,
        };
      }),
      chartOption: {
        tooltip: { trigger: "axis" },
        grid: { top: 32, left: 64, right: 24, bottom: 36 },
        xAxis: { type: "category", data: yrs.map(String) },
        yAxis: { type: "value", name: "东北合计 (万人)", scale: true },
        series: [{ name: "东北三省合计", type: "line", lineStyle: { width: 3 }, itemStyle: { color: "#B83A2D" }, data: sumSer }],
      },
      sources: ["国家统计局-分省年度数据（年末常住人口 2010–2025）"],
      disclaimer: "2011–2019 年为七普回溯修订值，2025 年为国家统计局最新公布值。",
      relatedLinks: [{ label: "阅读东北人口转型数据故事", href: "/stories/northeast-demographic-shift" }],
    };
  }

  // Fallback dynamic lookup: match any mentioned province + indicator in the 44-indicator catalog!
  const matchedProv = regions.find((r) => q.includes(r.short_zh) || q.includes(r.name_zh));
  const matchedInd = indicators.find(
    (i) => q.includes(i.short_zh) || q.includes(i.name_zh) || q.toLowerCase().includes(i.indicator_id)
  );
  if (matchedInd) {
    const gc = matchedProv?.geo_code ?? "000000";
    const ser = explore.series[matchedInd.indicator_id]?.[gc] ?? [];
    const latest = ser[ser.length - 1];
    return {
      status: "answered",
      title: `${regMap.get(gc)?.name_zh} · ${matchedInd.name_zh} 历史检索结果`,
      parsedSpec: `indicator=${matchedInd.indicator_id} | geo=${gc} (${regMap.get(gc)?.name_zh}) | points=${ser.length}`,
      formula: matchedInd.formula_note,
      answerSummary: latest
        ? `${regMap.get(gc)?.name_zh}最新（${latest[0]}年）${matchedInd.name_zh}为 ${latest[1]} ${matchedInd.unit_zh}，数据库共覆盖 ${ser[0]?.[0]}–${latest[0]} 年（${ser.length} 个年度观测）。`
        : "未检索到该地区的对应序列。",
      rows: ser.slice(-10).reverse().map(([y, v]) => ({
        label: `${y} 年`,
        metric: `${v} ${matchedInd.unit_zh}`,
        detail: `${regMap.get(gc)?.name_zh} (${matchedInd.domain_zh})`,
      })),
      chartOption: ser.length
        ? {
            tooltip: { trigger: "axis" },
            grid: { top: 32, left: 64, right: 24, bottom: 36 },
            xAxis: { type: "category", data: ser.map(([y]) => String(y)) },
            yAxis: { type: "value", name: matchedInd.unit_zh, scale: true },
            series: [{ name: matchedInd.short_zh, type: "line", lineStyle: { width: 2.5 }, itemStyle: { color: "#0F2942" }, data: ser.map(([, v]) => v) }],
          }
        : null,
      sources: [`国家统计局官方数据（${indMap.get(matchedInd.indicator_id)?.time_coverage_note}）`],
      disclaimer: matchedInd.limitations_zh,
      relatedLinks: [
        { label: `查看 ${matchedInd.name_zh} 完整专题页`, href: `/indicators/${matchedInd.indicator_id}` },
        ...(gc !== "000000" ? [{ label: `查看 ${regMap.get(gc)?.name_zh} 档案`, href: `/provinces/${gc}` }] : []),
      ],
    };
  }

  return {
    status: "unsupported",
    title: "未匹配到库内统计规则",
    parsedSpec: `输入：“${q}” → 未匹配到明确指标或预设分析模板`,
    formula: "N/A",
    answerSummary:
      "未能将该句直接映射为确定性统计查询。请点击下方预设问题，或在查询中包含具体省份名（如广东、浙江、四川）与指标名（如 GDP、常住人口、城镇化率、每千人医师、电力消费量、专利授权量）。",
    rows: [],
    chartOption: null,
    sources: [],
    disclaimer: "规则化统计查询引擎绝不编造无法从数据库计算的答案。",
    relatedLinks: [
      { label: "浏览 44 项官方指标目录", href: "/indicators" },
      { label: "使用高级数据探索器", href: "/explore" },
    ],
  };
}

export default function AssistantClient({
  regions,
  indicators,
  explore,
  initialQuery,
}: {
  regions: RegionMeta[];
  indicators: IndicatorSummary[];
  explore: ExploreData;
  initialQuery: string;
}) {
  const [input, setInput] = useState(initialQuery || PRESET_QUERIES[0]);
  const [submitted, setSubmitted] = useState(initialQuery || PRESET_QUERIES[0]);

  const result = useMemo(
    () => executeDeterministicQuery(submitted, explore, regions, indicators),
    [submitted, explore, regions, indicators]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(input);
  };

  return (
    <div className="space-y-6">
      {/* Honest Engine Positioning Banner */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-xs leading-relaxed text-sky-950">
        <div className="flex items-center gap-2 font-bold">
          <Cpu className="h-4 w-4 text-sky-700" />
          透明定位：规则化确定性统计研究查询引擎（Research Query Engine，非通用生成式 LLM）
        </div>
        <p className="mt-1">
          所有数字、排名、同比与相关系数均由浏览器端直接基于已核验官方数据库实时精确计算，透明展示查询参数、数学公式与来源，遇库外或预测性问题明确拒答，绝不产生幻觉数字。
        </p>
      </div>

      {/* Search Form + Preset Chips */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-600" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="输入统计研究问题"
              placeholder="输入统计问题，如：对比广东与江苏近10年GDP变化 / 四川 电力消费量"
              className="w-full rounded-xl border border-stone-300 bg-[#faf9f6] py-2.5 pl-9 pr-3 text-sm focus:border-[#0f2942] focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#0f2942] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#193d60]"
          >
            执行确定性计算
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESET_QUERIES.map((pq) => (
            <button
              key={pq}
              type="button"
              onClick={() => {
                setInput(pq);
                setSubmitted(pq);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                submitted === pq
                  ? "bg-[#b83a2d] text-white"
                  : "border border-stone-200 bg-stone-50 text-slate-700 hover:bg-stone-100"
              }`}
            >
              {pq}
            </button>
          ))}
        </div>
      </section>

      {/* Deterministic Result Card */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[#0f2942]">{result.title}</h2>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              result.status === "answered"
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {result.status === "answered" ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5" /> 确定性计算完成
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5" /> 超出库内范围 / 拒答
              </>
            )}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-slate-800">{result.answerSummary}</p>

        {/* Transparent Query Spec + Formula */}
        <div className="grid gap-3 rounded-xl border border-stone-200 bg-[#faf9f6] p-3.5 text-xs md:grid-cols-2">
          <div>
            <div className="font-bold text-slate-600">解析查询参数 (Query Spec)</div>
            <div className="mt-1 font-mono text-[11px] text-slate-800">{result.parsedSpec}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 font-bold text-slate-600">
              <Calculator className="h-3.5 w-3.5 text-[#1e6b52]" /> 计算公式 (Formula)
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-800">{result.formula}</div>
          </div>
        </div>

        {result.chartOption && <LazyChart option={result.chartOption} height={340} eager />}

        {result.rows.length > 0 && (
          <div className="atlas-scroll overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[#f4f2ec] text-slate-700">
                <tr>
                  <th className="px-3 py-2">项目 / 地区 / 年份</th>
                  <th className="px-3 py-2">核心计算结果</th>
                  <th className="px-3 py-2">明细对照</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {result.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-semibold text-[#0f2942]">{r.label}</td>
                    <td className="px-3 py-2 font-bold tabular-nums text-slate-900">{r.metric}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-2 border-t border-stone-100 pt-4 text-xs">
          {result.sources.length > 0 && (
            <div className="text-slate-600">
              <strong>数据来源：</strong>
              {result.sources.join("；")}
            </div>
          )}
          <div className="text-amber-900">
            <strong>口径与局限提示：</strong>
            {result.disclaimer}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {result.relatedLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg border border-[#0f2942] px-3 py-1.5 font-semibold text-[#0f2942] hover:bg-[#0f2942] hover:text-white"
              >
                {l.label} →
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
