import React from "react";
import type { Metadata } from "next";
import { getAuditData } from "@/lib/data";
import AuditClient from "@/components/AuditClient";

export const metadata: Metadata = {
  title: "Round 1 跨模型审计与冲突裁决中心",
  description: "独立盘点 9 个 Round 1 AI 模型交付目录、18 项 P0/P1/P2 审计发现与 1,911 条跨模型冲突的官方原始证据裁决记录。",
};

export default function AuditPage() {
  const audit = getAuditData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
          Round 1 跨模型交叉审计与冲突裁决中心
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-600">
          基于对 Google Drive 总目录全部 9 个 Round 1 模型子文件夹的独立只读审计，逐项重算覆盖率、核查异常分歧并完成官方原始证据裁决（包括对 Gemini 4 Neon 自身 Round 1 版本过度标记 verified 的公开自我纠偏）。
        </p>
      </div>
      <AuditClient audit={audit} />
    </div>
  );
}
