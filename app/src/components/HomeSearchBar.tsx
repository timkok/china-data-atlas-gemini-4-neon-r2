"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";

interface QuickItem {
  type: "indicator" | "province" | "story";
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

export default function HomeSearchBar({ items }: { items: QuickItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return items
      .filter(
        (i) =>
          i.title.toLowerCase().includes(s) ||
          i.subtitle.toLowerCase().includes(s) ||
          i.keywords.toLowerCase().includes(s)
      )
      .slice(0, 8);
  }, [q, items]);

  return (
    <div className="relative w-full max-w-2xl">
      <div className="flex items-center rounded-xl border border-[#cfc9be] bg-white px-3.5 py-2.5 shadow-sm focus-within:border-[#0f2942] focus-within:ring-2 focus-within:ring-[#0f2942]/15">
        <Search className="mr-2.5 h-5 w-5 shrink-0 text-slate-600" />
        <input
          type="search"
          value={q}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          aria-label="首页搜索指标、省份或数据故事"
          placeholder="搜索 44 项指标、31 省档案或数据故事（如：广东、GDP、老龄化、每千人医师、研究生）"
          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-600 focus:outline-none"
        />
      </div>

      {open && q.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
          {matches.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-600">
              未找到直接匹配项，试试前往{" "}
              <button
                type="button"
                onMouseDown={() => router.push(`/assistant?q=${encodeURIComponent(q)}`)}
                className="font-semibold text-[#b83a2d] underline"
              >
                研究查询引擎检索“{q}”
              </button>
            </div>
          ) : (
            matches.map((m) => (
              <button
                key={`${m.type}-${m.href}`}
                type="button"
                onMouseDown={() => router.push(m.href)}
                className="flex w-full items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5 text-left last:border-0 hover:bg-stone-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[#0f2942]">{m.title}</div>
                  <div className="truncate text-xs text-slate-600">{m.subtitle}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-600" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
