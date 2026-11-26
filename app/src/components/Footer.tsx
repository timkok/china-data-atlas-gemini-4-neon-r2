import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#e2dfd7] bg-[#f4f2ec] text-slate-700">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="text-base font-bold text-[#0f2942]">
              中国数据地图 · China Data Atlas (R2)
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Make China&apos;s Data Accessible, Understandable, Traceable and Explorable.
              基于国家统计局、教育部、国家卫健委等公开官方数据构建，提供可追溯证据分级（E1–E4）、多版本历史修订归档与跨模型审计透明度。
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              快速入口
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <li><Link href="/indicators" className="inline-block py-1 hover:text-[#0f2942] hover:underline">44项权威指标目录</Link></li>
              <li><Link href="/provinces" className="inline-block py-1 hover:text-[#0f2942] hover:underline">31省份综合档案</Link></li>
              <li><Link href="/compare" className="inline-block py-1 hover:text-[#0f2942] hover:underline">多省横向对比</Link></li>
              <li><Link href="/explore" className="inline-block py-1 hover:text-[#0f2942] hover:underline">多指标探索与导出</Link></li>
              <li><Link href="/stories" className="inline-block py-1 hover:text-[#0f2942] hover:underline">可复现数据故事</Link></li>
              <li><Link href="/assistant" className="inline-block py-1 hover:text-[#0f2942] hover:underline">统计研究查询引擎</Link></li>
              <li><Link href="/audit" className="inline-block py-1 hover:text-[#0f2942] hover:underline">Round 1 跨模型审计</Link></li>
              <li><Link href="/methodology" className="inline-block py-1 hover:text-[#0f2942] hover:underline">方法论、合规与版权</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              统计口径、地图合规与数据权利声明
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              本平台软件源码采用 MIT 许可；底层官方统计事实归属原发布机构（国家统计局、教育部、国家卫健委等），<strong>不声明为 CC0</strong>，引用须标注原始机构与版本。分省序列遵循国家统计局中国内地31省（区、市）统计口径，港澳台因独立统计体系未混入内地分省表，不代表任何地理归属判断。
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <a href="/data/observations.csv" download className="font-medium text-[#0f2942] underline">
                下载完整 CSV (30,220条)
              </a>
              <a href="/data/vintages.csv" download className="font-medium text-[#0f2942] underline">
                下载修订版本库 CSV
              </a>
              <a href="/data/data-dictionary.json" download className="font-medium text-[#0f2942] underline">
                数据字典 JSON
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col justify-between gap-2 border-t border-[#e2dfd7] pt-4 text-[11px] text-slate-600 sm:flex-row">
          <span>Round 2 Independent Delivery · Built by Gemini 4 Neon · 2026-11-25</span>
          <span>Map Status: deferred_with_pluggable_provider_interface (SpatialViewAdapter Compliant)</span>
        </div>
      </div>
    </footer>
  );
}
