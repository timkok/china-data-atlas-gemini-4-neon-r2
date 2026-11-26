import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Database, GitBranch, Map as MapIcon, Scale, ShieldCheck } from "lucide-react";
import { getSummary } from "@/lib/data";
import { EVIDENCE_META } from "@/lib/analytics";
import { REGIONAL_MATRIX_ADAPTER, TIANDITU_PROVIDER_ADAPTER } from "@/lib/spatialAdapter";

export const metadata: Metadata = {
  title: "方法论、证据分级、地图合规与数据权利",
  description: "中国数据地图 Round 2 统计方法论、E0–E4 证据分级标准、中国地图合规决策、更新回滚机制与数据权利声明。",
};

export default function MethodologyPage() {
  const summary = getSummary();
  const { stats, sources } = summary;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold text-[#0f2942] sm:text-3xl">
          方法论、证据分级、地图合规与数据治理
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          公开说明本平台三层数据架构、证据分级与提取方式分离规则、中国地图合规策略、自动化更新回滚管道及非 CC0 官方数据权利政策。
        </p>
      </header>

      {/* 1. Evidence Grading vs Extraction Method */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#0f2942]">
          <ShieldCheck className="h-5 w-5 text-[#1e6b52]" />
          1. 证据分级体系（E0–E4）与提取方式严格分离
        </h2>
        <p className="text-sm leading-relaxed text-slate-700">
          Round 1 自我审计发现，将全量单一 API 抓取记录批量标记为 <code>verified</code> 会掩盖真实复核深度。Round 2 严格将 <strong>evidence_level（证据强度 E0–E4）</strong> 与 <strong>extraction_method（提取方式 API / HTML / Derived）</strong> 拆分记录，严禁自动升级未抽检记录，严禁 E0 进入权威候选库：
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(["E4", "E3", "E2", "E1", "E0"] as const).map((lv) => {
            const meta = EVIDENCE_META[lv];
            const cnt = stats.evidence_levels[lv] ?? 0;
            return (
              <div key={lv} className="rounded-xl border border-stone-200 bg-[#faf9f6] p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className={`rounded border px-1.5 py-0.5 font-bold ${meta.colorClass}`}>
                    {lv}
                  </span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {cnt.toLocaleString("zh-CN")} 条
                  </span>
                </div>
                <div className="mt-2 font-semibold text-[#0f2942]">{meta.label}</div>
                <p className="mt-1 leading-relaxed text-slate-600">{meta.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Map Compliance Research Summary */}
      <section
        id="map-compliance"
        className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs space-y-3"
      >
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#0f2942]">
          <MapIcon className="h-5 w-5 text-[#b83a2d]" />
          2. 中国地图合规研究与可插拔 SpatialViewAdapter 架构
        </h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950">
          <div>
            <strong>当前地图状态：</strong>
            <code>map_status = &quot;{REGIONAL_MATRIX_ADAPTER.mapStatus}&quot;</code>
          </div>
          <p className="mt-1.5">{REGIONAL_MATRIX_ADAPTER.getComplianceNotice()}</p>
          <p className="mt-1.5">
            <strong>海外实测连通性（2026-11-24）：</strong>
            <code>bzdt.ch.mnr.gov.cn</code> DNS 无法解析；<code>www.tianditu.gov.cn</code> 返回 HTTP 418；
            <code>lbs.tianditu.gov.cn</code> TCP 超时。{TIANDITU_PROVIDER_ADAPTER.getComplianceNotice()}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">
          因此，我们在未获正式合规底图授权前，拒绝使用未经审图的第三方 GeoJSON 边界，亦不伪造审图号，默认采用清晰的<strong>七大地理大区省级空间矩阵 + 排名条形图</strong>，并在代码层定义标准 <code>SpatialViewAdapter</code> 接口，待未来配置自然资源部/天地图合法凭证后即可平滑启用标准专题地图。
        </p>
      </section>

      {/* 3. Automated Update, Revision Preservation & Rollback */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#0f2942]">
          <GitBranch className="h-5 w-5 text-[#0f2942]" />
          3. 自动化更新、修订版本保留与隔离回滚机制
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
          <li>
            <strong>只读探测 + 人工审批门禁：</strong>定时工作流（<code>scheduled-data-check.yml</code>）仅对国家数据公开发布库执行只读最新年份探测并输出审查工件，<strong>绝不未经审核自动发布到生产环境</strong>。
          </li>
          <li>
            <strong>历史修订双轨归档：</strong>当国家统计局（如五经普、七普或最终核实）修订历史年份数据时，管道自动将旧值归档至 <code>vintages.csv</code>（保留差异百分比与发布期），严禁静默覆盖历史数字。
          </li>
          <li>
            <strong>异常批次硬阻断：</strong>任何缺少必填字段、非法 GB/T 2260 编码、越界数值、E0 未核验记录或未经覆盖授权的 &gt;25% 突变批次均会被完整阻断。
          </li>
          <li>
            <strong>隔离更新演练已通过：</strong><code>tests/data/test_update_pipeline.py</code> 已在独立临时沙盒验证全部 5 项场景（含 SHA-256 逐字节一致回滚），生产数据零触碰，报告见 <code>reports/update_test_report.json</code>。
          </li>
        </ul>
      </section>

      {/* 4. Data Rights & Attribution */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#0f2942]">
          <Scale className="h-5 w-5 text-[#1e6b52]" />
          4. 数据权利与合理使用声明（严格不声明 CC0）
        </h2>
        <p className="text-xs leading-relaxed text-slate-700">
          本平台<strong>应用程序代码与数据处理脚本</strong>采用 MIT 开源协议；但底层官方统计数据归属中华人民共和国国家统计局、教育部、国家卫生健康委员会等原发布机构，<strong>绝不声明为 CC0 公共领域放弃版权</strong>。本平台遵循：
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
          <li>不绕过任何官网登录、验证码或反爬机制，仅请求匿名公开统计接口并实施礼貌限速；</li>
          <li>不在公开 Git 仓库或网盘中再分发国家统计局/教育部原始网页 HTML 模板与页面版权素材，仅保留 SHA-256 哈希清单与规范化事实数值；</li>
          <li>每条下载与展示数据均强制携带原始来源机构、来源表名、统计口径说明与规范引用格式。</li>
        </ul>
      </section>

      {/* 5. Official Data Sources Table */}
      <section className="rounded-2xl border border-[#e2dfd7] bg-white p-6 shadow-2xs space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#0f2942]">
          <Database className="h-5 w-5 text-[#0f2942]" />
          5. 权威官方数据源总清单（{sources.length} 项）
        </h2>
        <div className="atlas-scroll overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[#f4f2ec] text-slate-700">
              <tr>
                <th className="px-3 py-2">Source ID</th>
                <th className="px-3 py-2">官方来源名称</th>
                <th className="px-3 py-2">访问方式</th>
                <th className="px-3 py-2">更新频率</th>
                <th className="px-3 py-2">权利说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {sources.map((s) => (
                <tr key={s.source_id}>
                  <td className="px-3 py-2 font-mono font-semibold text-[#0f2942]">{s.source_id}</td>
                  <td className="px-3 py-2">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#0f2942] underline"
                    >
                      {s.source_name_zh}
                    </a>
                    <div className="text-[11px] text-slate-600">{s.publisher_zh}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{s.access_method}</td>
                  <td className="px-3 py-2 text-slate-600">{s.update_cadence}</td>
                  <td className="max-w-xs px-3 py-2 text-slate-600">{s.license_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pt-2">
          <Link href="/audit" className="text-xs font-semibold text-[#b83a2d] hover:underline">
            查看完整 Round 1 跨模型审计与 {stats.resolved_conflicts_count.toLocaleString("zh-CN")} 条冲突裁决 →
          </Link>
        </div>
      </section>
    </div>
  );
}
