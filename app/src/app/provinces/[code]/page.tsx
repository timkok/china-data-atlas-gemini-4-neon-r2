import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllProvinceCodes, getProvinceProfile, getSummary } from "@/lib/data";
import ProvinceProfileClient from "@/components/ProvinceProfileClient";

export function generateStaticParams() {
  return getAllProvinceCodes().map((code) => ({ code }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const profile = getProvinceProfile(code);
  if (!profile) return { title: "省份未找到" };
  return {
    title: `${profile.region.name_zh} (${profile.region.name_en}) 统计数据档案`,
    description: `${profile.region.name_zh}人口、GDP、人均可支配收入、教育科创、医疗卫生与能源环境全指标历史数据与全国排名。`,
  };
}

export default async function ProvinceDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const profile = getProvinceProfile(code);
  if (!profile) notFound();
  const summary = getSummary();
  return <ProvinceProfileClient profile={profile} allRegions={summary.regions} />;
}
