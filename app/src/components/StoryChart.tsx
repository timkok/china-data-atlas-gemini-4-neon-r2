"use client";

import React, { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import LazyChart from "./LazyChart";
import type { DataStory } from "@/lib/types";

export default function StoryChart({ story }: { story: DataStory }) {
  const option: EChartsCoreOption = useMemo(() => {
    const cd = story.chartData as Record<string, unknown>;

    if (story.chartType === "bar_diverging") {
      const items = (cd.items as { name_zh: string; pct_change: number; abs_change: number }[]) ?? [];
      const ordered = [...items].reverse();
      return {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params: { dataIndex: number }[]) => {
            const it = ordered[params[0]?.dataIndex ?? 0];
            if (!it) return "";
            return `<strong>${it.name_zh}</strong><br/>2005–2025 增速: ${it.pct_change > 0 ? "+" : ""}${it.pct_change}%<br/>20年净变动: ${it.abs_change > 0 ? "+" : ""}${it.abs_change} 万人`;
          },
        },
        grid: { top: 20, left: 68, right: 48, bottom: 32 },
        xAxis: { type: "value", name: "20年增速 (%)", splitLine: { lineStyle: { color: "#ECEAE4" } } },
        yAxis: { type: "category", data: ordered.map((x) => x.name_zh), axisLabel: { fontSize: 11 } },
        series: [
          {
            type: "bar",
            data: ordered.map((x) => ({
              value: x.pct_change,
              itemStyle: { color: x.pct_change >= 0 ? "#0F2942" : "#B83A2D" },
            })),
            label: { show: true, position: "right", fontSize: 10, formatter: "{c}%" },
          },
        ],
      };
    }

    if (story.chartType === "multi_line") {
      const years = (cd.years as number[]) ?? [];
      const seriesObj = (cd.series as Record<string, (number | null)[]>) ?? {};
      const unit = (cd.unit as string) ?? "";
      const colors = ["#0F2942", "#B83A2D", "#1E6B52"];
      return {
        tooltip: { trigger: "axis" },
        legend: { bottom: 0 },
        grid: { top: 36, left: 64, right: 24, bottom: 48 },
        xAxis: { type: "category", data: years.map(String) },
        yAxis: { type: "value", name: unit, scale: true, splitLine: { lineStyle: { color: "#ECEAE4" } } },
        series: Object.entries(seriesObj).map(([name, data], i) => ({
          name,
          type: "line",
          symbolSize: 5,
          lineStyle: { width: 2.5 },
          itemStyle: { color: colors[i % colors.length] },
          data,
        })),
      };
    }

    if (story.chartType === "dual_compare") {
      const years = (cd.years as number[]) ?? [];
      return {
        tooltip: { trigger: "axis" },
        legend: { bottom: 0 },
        grid: { top: 40, left: 68, right: 68, bottom: 52 },
        xAxis: { type: "category", data: years.map(String) },
        yAxis: [
          { type: "value", name: "GDP (亿元)", scale: true, splitLine: { lineStyle: { color: "#ECEAE4" } } },
          { type: "value", name: "人均可支配收入 (元)", scale: true, splitLine: { show: false } },
        ],
        series: [
          { name: "江苏 GDP", type: "bar", yAxisIndex: 0, itemStyle: { color: "rgba(15,41,66,0.35)" }, data: cd.gdp_js as number[] },
          { name: "浙江 GDP", type: "bar", yAxisIndex: 0, itemStyle: { color: "rgba(184,58,45,0.35)" }, data: cd.gdp_zj as number[] },
          { name: "江苏 人均可支配收入", type: "line", yAxisIndex: 1, lineStyle: { width: 3 }, itemStyle: { color: "#0F2942" }, data: cd.inc_js as number[] },
          { name: "浙江 人均可支配收入", type: "line", yAxisIndex: 1, lineStyle: { width: 3 }, itemStyle: { color: "#B83A2D" }, data: cd.inc_zj as number[] },
        ],
      };
    }

    if (story.chartType === "scatter_aging_health") {
      const pts = (cd.points as { name_zh: string; aging: number; physicians: number; beds: number }[]) ?? [];
      return {
        tooltip: {
          trigger: "item",
          formatter: (p: { data?: { name?: string; value?: number[] } }) => {
            const v = p.data?.value;
            if (!v) return "";
            return `<strong>${p.data?.name}</strong> (2024)<br/>65岁+占比: ${v[0]}%<br/>每千人医师: ${v[1]} 人<br/>每千人床位: ${v[2]} 张`;
          },
        },
        legend: { bottom: 0 },
        grid: { top: 36, left: 60, right: 28, bottom: 52 },
        xAxis: { type: "value", name: "65岁+人口占比 (%)", scale: true, splitLine: { lineStyle: { color: "#ECEAE4" } } },
        yAxis: { type: "value", name: "每千人医师 / 床位", scale: true, splitLine: { lineStyle: { color: "#ECEAE4" } } },
        series: [
          {
            name: "每千人执业(助理)医师",
            type: "scatter",
            symbolSize: 12,
            itemStyle: { color: "#B83A2D" },
            label: { show: true, position: "top", formatter: "{b}", fontSize: 10 },
            data: pts.map((p) => ({ name: p.name_zh, value: [p.aging, p.physicians, p.beds] })),
          },
          {
            name: "每千人医疗机构床位",
            type: "scatter",
            symbolSize: 10,
            itemStyle: { color: "#0F2942", opacity: 0.7 },
            data: pts.map((p) => ({ name: p.name_zh, value: [p.aging, p.beds, p.beds] })),
          },
        ],
      };
    }

    if (story.chartType === "bubble_urb_gdp") {
      const pts = (cd.points as { name_zh: string; urbanization: number; gdp_per_capita: number; population: number }[]) ?? [];
      const maxPop = Math.max(...pts.map((p) => p.population), 1);
      return {
        tooltip: {
          trigger: "item",
          formatter: (p: { data?: { name?: string; value?: number[] } }) => {
            const v = p.data?.value;
            if (!v) return "";
            return `<strong>${p.data?.name}</strong> (2024)<br/>城镇化率: ${v[0]}%<br/>人均GDP: ${v[1].toLocaleString()} 元<br/>常住人口: ${v[2]} 万人`;
          },
        },
        grid: { top: 36, left: 72, right: 30, bottom: 48 },
        xAxis: { type: "value", name: "城镇化率 (%)", scale: true, splitLine: { lineStyle: { color: "#ECEAE4" } } },
        yAxis: { type: "value", name: "人均GDP (元)", scale: true, splitLine: { lineStyle: { color: "#ECEAE4" } } },
        series: [
          {
            name: "31省 (2024)",
            type: "scatter",
            itemStyle: { color: "#0F2942", opacity: 0.8 },
            label: { show: true, position: "top", formatter: "{b}", fontSize: 10 },
            symbolSize: (val: number[]) => 10 + Math.sqrt((val[2] ?? 1) / maxPop) * 28,
            data: pts.map((p) => ({ name: p.name_zh, value: [p.urbanization, p.gdp_per_capita, p.population] })),
          },
        ],
      };
    }

    // gap_trend_and_rank
    const years = (cd.years as number[]) ?? [];
    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0 },
      grid: { top: 36, left: 60, right: 24, bottom: 48 },
      xAxis: { type: "category", data: years.map(String) },
      yAxis: { type: "value", name: "城乡收入比 (倍)", scale: true, splitLine: { lineStyle: { color: "#ECEAE4" } } },
      series: [
        { name: "全国平均", type: "line", lineStyle: { width: 3 }, itemStyle: { color: "#0F2942" }, data: cd.national as number[] },
        { name: "浙江 (沿海低差距代表)", type: "line", lineStyle: { width: 2.5 }, itemStyle: { color: "#1E6B52" }, data: cd.zhejiang as number[] },
        { name: "贵州 (西部快速收窄代表)", type: "line", lineStyle: { width: 2.5 }, itemStyle: { color: "#B83A2D" }, data: cd.guizhou as number[] },
      ],
    };
  }, [story]);

  return (
    <LazyChart
      option={option}
      height={story.chartType === "bar_diverging" ? 680 : 400}
      eager
    />
  );
}
