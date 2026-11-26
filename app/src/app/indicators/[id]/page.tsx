import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllIndicatorIds, getIndicatorSlice, getSummary } from "@/lib/data";
import IndicatorWorkbench from "@/components/IndicatorWorkbench";

export function generateStaticParams() {
  return getAllIndicatorIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const slice = getIndicatorSlice(id);
  if (!slice) return { title: "指标未找到" };
  return {
    title: `${slice.meta.name_zh} (${slice.coverage.year_min}–${slice.coverage.year_max})`,
    description: `${slice.meta.definition_zh} 覆盖 ${slice.coverage.total_rows} 条官方统计观测与历史修订版本。`,
  };
}

export default async function IndicatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slice = getIndicatorSlice(id);
  if (!slice) notFound();
  const summary = getSummary();
  return <IndicatorWorkbench slice={slice} regions={summary.regions} />;
}
