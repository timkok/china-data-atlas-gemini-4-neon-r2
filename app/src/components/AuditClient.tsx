"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Scale, Search } from "lucide-react";
import type { AuditData } from "@/lib/types";

export default function AuditClient({ audit }: { audit: AuditData }) {
  const [catFilter, setCatFilter] = useState("ALL");
  const [indFilter, setIndFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("ALL");

  const categories = Object.entries(audit.conflictSummary.byCategory);
  const inds = Object.entries(audit.conflictSummary.byIndicator);

  const filteredFindings = useMemo(() => {
    return audit.findings.filter((f) => {
      if (sevFilter !== "ALL" && f.severity !== sevFilter) return false;
      return true;
    });
  }, [audit.findings, sevFilter]);

  const filteredConflicts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return audit.conflictSamples.filter((c) => {
      if (catFilter !== "ALL" && String(c.classification) !== catFilter) return false;
      if (indFilter !== "ALL" && String(c.indicator_id) !== indFilter) return false;
      if (q) {
        const hay = `${c.indicator_id} ${c.geo_code} ${c.year} ${c.values_by_model} ${c.resolution_rationale}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [audit.conflictSamples, catFilter, indFilter, search]);

  return (
    <div className="space-y-8">
      {/* KPI Summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#e2dfd7] bg-white p-4">
          <div className="text-xs text-slate-600">已审计 Round 1 目录</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-[#0f2942]">
            {audit.inventory.length} <span className="text-xs font-normal text-slate-600">个</span>
          </div>
          <div className="text-[11px] text-slate-600">含 2 个空目录（Codex）如实记录</div>
        </div>
        <div className="rounded-xl border border-[#e2dfd7] bg-white p-4">
          <div className="text-xs text-slate-600">跨模型分歧记录总数</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-[#b83a2d]">
            {audit.conflictSummary.total.toLocaleString("zh-CN")}
          </div>
          <div className="text-[11px] text-slate-600">0 条采用投票或取平均裁决</div>
        </div>
        <div className="rounded-xl border border-[#e2dfd7] bg-white p-4">
          <div className="text-xs text-slate-600">官方原始证据裁决率</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-[#1e6b52]">100%</div>
          <div className="text-[11px] text-slate-600">未裁决数：{audit.conflictSummary.unresolved}</div>
        </div>
        <div className="rounded-xl border border-[#e2dfd7] bg-white p-4">
          <div className="text-xs text-slate-600">证据化审计发现 (P1/P2)</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-[#0f2942]">
            {audit.findings.length} <span className="text-xs font-normal text-slate-600">项</span>
          </div>
          <div className="text-[11px] text-slate-600">含对 Gemini 4 Neon R1 的自我审计</div>
        </div>
      </section>

      {/* Round 1 Model Inventory & Recomputed Comparison */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <h2 className="mb-3 text-base font-bold text-[#0f2942]">
          Round 1 全部 {audit.inventory.length} 个模型交付盘点与重算对比
        </h2>
        <div className="atlas-scroll overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[#f4f2ec] text-slate-700">
              <tr>
                <th className="px-3 py-2.5">模型标识</th>
                <th className="px-3 py-2.5">访问/交付状态</th>
                <th className="px-3 py-2.5 text-right">独立重算观测数</th>
                <th className="px-3 py-2.5 text-right">核心/扩展指标</th>
                <th className="px-3 py-2.5">部署与公开可达性</th>
                <th className="px-3 py-2.5">主要局限与审计结论</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {audit.inventory.map((row, idx) => (
                <tr key={idx} className="hover:bg-stone-50">
                  <td className="px-3 py-2.5 font-bold text-[#0f2942]">
                    <div>{row.model_identity || row.model_slug}</div>
                    <div className="font-mono text-[10px] font-normal text-slate-600">{row.model_slug}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                        String(row.access_status).includes("empty")
                          ? "bg-stone-200 text-stone-700"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      {row.access_status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">
                    {Number(row.unique_valid_observations || 0).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {row.core_indicators_delivered || 0} 核心 / +{row.additional_indicators_delivered || 0} 扩展
                  </td>
                  <td className="max-w-xs px-3 py-2.5 text-slate-600">
                    {row.deployment_status || "—"}
                  </td>
                  <td className="max-w-md px-3 py-2.5 text-slate-600">
                    {row.primary_limitations || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Evidence-Backed Audit Findings */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#0f2942]">
            <AlertTriangle className="h-4 w-4 text-[#b83a2d]" />
            证据化缺陷与关键发现台账（{filteredFindings.length} 项）
          </h2>
          <div className="flex gap-1.5">
            {["ALL", "P0", "P1", "P2"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSevFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  sevFilter === s ? "bg-[#0f2942] text-white" : "bg-stone-100 text-slate-700"
                }`}
              >
                {s === "ALL" ? "全部级别" : s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredFindings.map((f, idx) => (
            <div
              key={f.finding_id || idx}
              className="rounded-xl border border-stone-200 bg-[#faf9f6]/60 p-4 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    f.severity === "P0"
                      ? "bg-red-700 text-white"
                      : f.severity === "P1"
                      ? "bg-rose-100 text-rose-900"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {f.severity}
                </span>
                <span className="font-mono font-bold text-slate-700">{f.finding_id}</span>
                <span className="rounded bg-[#0f2942]/10 px-2 py-0.5 font-semibold text-[#0f2942]">
                  {f.audited_model}
                </span>
                <span className="rounded bg-stone-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                  {f.category}
                </span>
                {f.indicator_id && (
                  <span className="font-mono text-[11px] text-slate-600">
                    {f.indicator_id} {f.year ? `(${f.year})` : ""}
                  </span>
                )}
              </div>
              <p className="mt-2 leading-relaxed text-slate-800">{f.description}</p>
              {f.evidence_locator && (
                <div className="mt-1.5 font-mono text-[11px] text-slate-600">
                  证据定位：{f.evidence_locator}
                </div>
              )}
              {f.recommended_fix && (
                <div className="mt-2 flex items-start gap-1.5 text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                  <span>
                    <strong>Round 2 修正方案：</strong>
                    {f.recommended_fix}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Searchable Conflict Adjudication Explorer */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#0f2942]">
              <Scale className="h-4 w-4 text-[#1e6b52]" />
              跨模型数值冲突裁决检索器（共 {audit.conflictSummary.total.toLocaleString("zh-CN")} 条已裁决）
            </h2>
            <p className="text-xs text-slate-600">
              展示跨模型代表性冲突样本（支持按冲突类别、指标或省份年份检索），全部保留原始分歧值与官方证据裁决理由。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              aria-label="按冲突类别筛选"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="ALL">全部冲突类别</option>
              {categories.map(([cat, cnt]) => (
                <option key={cat} value={cat}>
                  {cat} ({cnt})
                </option>
              ))}
            </select>
            <select
              aria-label="按指标筛选冲突"
              value={indFilter}
              onChange={(e) => setIndFilter(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="ALL">全部指标</option>
              {inds.map(([ind, cnt]) => (
                <option key={ind} value={ind}>
                  {ind} ({cnt})
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-600" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜年份/地区/模型…"
                className="rounded-lg border border-stone-300 py-1.5 pl-8 pr-3 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="atlas-scroll max-h-[520px] overflow-auto rounded-xl border border-stone-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[#f4f2ec] text-slate-700">
              <tr>
                <th className="px-3 py-2">指标 / 地区 / 年份</th>
                <th className="px-3 py-2">冲突分类</th>
                <th className="px-3 py-2 text-right">最大分歧</th>
                <th className="px-3 py-2 text-right">官方裁决值</th>
                <th className="px-3 py-2">各模型申报值对比</th>
                <th className="px-3 py-2">裁决依据</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {filteredConflicts.slice(0, 120).map((c, idx) => (
                <tr key={String(c.conflict_id || idx)} className="hover:bg-stone-50">
                  <td className="px-3 py-2 font-semibold text-[#0f2942] whitespace-nowrap">
                    {String(c.indicator_id)} · {String(c.geo_code).padStart(6, "0")} · {String(c.year)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                      {String(c.classification)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[#b83a2d]">
                    {String(c.rel_spread_pct)}%
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[#1e6b52]">
                    {String(c.official_nbs_value)}
                  </td>
                  <td className="max-w-xs px-3 py-2 font-mono text-[11px] text-slate-600">
                    {String(c.values_by_model)}
                  </td>
                  <td className="max-w-sm px-3 py-2 text-slate-600">
                    {String(c.resolution_rationale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
