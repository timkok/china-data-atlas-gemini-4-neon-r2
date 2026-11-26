import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Code2, Lightbulb } from "lucide-react";
import { getStories, getStoryBySlug } from "@/lib/data";
import StoryChart from "@/components/StoryChart";

export function generateStaticParams() {
  return getStories().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const st = getStoryBySlug(slug);
  if (!st) return { title: "数据故事未找到" };
  return {
    title: st.title_zh,
    description: st.summary_zh,
  };
}

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = getStoryBySlug(slug);
  if (!story) notFound();

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <Link href="/stories" className="hover:text-[#0f2942] hover:underline">
          可复现数据故事
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#1e6b52]">{story.tag}</span>
      </div>

      <header className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs sm:p-8">
        <h1 className="text-2xl font-extrabold leading-tight text-[#0f2942] sm:text-3xl">
          {story.title_zh}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">{story.title_en}</p>

        <div className="mt-4 rounded-xl border border-stone-200 bg-[#faf9f6] p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#b83a2d]">
            研究问题 (Research Question)
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">{story.research_question}</p>
        </div>

        <p className="mt-4 text-base leading-relaxed text-slate-700">{story.summary_zh}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {story.kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-stone-200 bg-white p-3.5">
              <div className="text-xs text-slate-600">{k.label}</div>
              <div className="mt-1 text-lg font-extrabold tabular-nums text-[#0f2942]">{k.value}</div>
              <div className="mt-0.5 text-[11px] text-slate-600">{k.detail}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Interactive Reproducible Chart */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs">
        <h2 className="mb-3 text-base font-bold text-[#0f2942]">交互式统计图表</h2>
        <StoryChart story={story} />

        <div className="mt-4 rounded-xl border border-stone-200 bg-[#faf9f6] p-3.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#0f2942]">
            <Code2 className="h-4 w-4 text-[#1e6b52]" />
            可复现计算公式与样本定义
          </div>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-slate-700">
            {story.formula}
          </p>
        </div>
      </section>

      {/* Strict Fact vs Inference Separation */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-950">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            核验统计事实（Direct Data Facts）
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-slate-800">
            {story.facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-sky-950">
            <Lightbulb className="h-4 w-4 text-sky-700" />
            结构解读与推断（Analytical Inferences）
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-slate-800">
            {story.inferences.map((inf, i) => (
              <li key={i}>{inf}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sources, Limitations & Related Indicators */}
      <footer className="rounded-2xl border border-[#e2dfd7] bg-white p-5 text-xs shadow-2xs space-y-3">
        <div>
          <div className="font-bold text-[#0f2942]">官方数据来源</div>
          <ul className="mt-1 list-disc pl-4 text-slate-600">
            {story.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <strong>统计口径与局限声明：</strong>
            {story.limitations}
          </div>
        </div>
        <div>
          <div className="mb-2 font-bold text-[#0f2942]">深入探索相关指标</div>
          <div className="flex flex-wrap gap-2">
            {story.relatedIndicators.map((id) => (
              <Link
                key={id}
                href={`/indicators/${id}`}
                className="rounded-lg border border-stone-300 bg-[#faf9f6] px-3 py-1.5 font-semibold text-[#0f2942] hover:bg-[#0f2942] hover:text-white"
              >
                {id} →
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </article>
  );
}
