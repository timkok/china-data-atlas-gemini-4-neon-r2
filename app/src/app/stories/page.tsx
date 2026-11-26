import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { getStories } from "@/lib/data";

export const metadata: Metadata = {
  title: "可复现数据故事专栏",
  description: "基于中国官方统计数据管道实时计算的 6 篇深度数据故事，严格区分统计事实与分析推断。",
};

export default function StoriesIndexPage() {
  const stories = getStories();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
          <BookOpen className="h-7 w-7 text-[#1e6b52]" />
          可复现数据故事（{stories.length} 篇）
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          所有文章中的排名、增速、相关系数与图表均直接由规范化官方数据库在构建期实时计算生成，零手工硬编码，每篇均公开计算公式、数据来源、口径局限，并严格区隔“统计事实”与“分析推断”。
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {stories.map((st) => (
          <Link
            key={st.slug}
            href={`/stories/${st.slug}`}
            className="group flex flex-col justify-between rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs transition hover:border-[#0f2942]"
          >
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full bg-[#1e6b52]/10 px-3 py-0.5 font-semibold text-[#1e6b52]">
                  {st.tag}
                </span>
                <span className="text-slate-600">阅读约 {st.reading_minutes} 分钟</span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-[#0f2942] group-hover:text-[#b83a2d]">
                {st.title_zh}
              </h2>
              <div className="mt-1 text-xs text-slate-600">{st.title_en}</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{st.summary_zh}</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-xs">
              {st.kpis.map((k) => (
                <div key={k.label} className="rounded-lg bg-[#faf9f6] p-2">
                  <div className="truncate text-[10px] text-slate-600">{k.label}</div>
                  <div className="mt-0.5 truncate font-bold text-[#0f2942]">{k.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-1 text-xs font-semibold text-[#0f2942] group-hover:text-[#b83a2d]">
              进入深度分析与交互图表
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
