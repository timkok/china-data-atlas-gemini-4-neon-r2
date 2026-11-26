"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, X, BarChart3, MapPin, BookOpen, ShieldCheck } from "lucide-react";

export interface SearchIndexItem {
  type: "indicator" | "province" | "story";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/indicators", label: "指标目录" },
  { href: "/provinces", label: "省份档案" },
  { href: "/compare", label: "省份对比" },
  { href: "/explore", label: "数据探索" },
  { href: "/stories", label: "数据故事" },
  { href: "/assistant", label: "研究查询" },
  { href: "/audit", label: "跨模型审计" },
  { href: "/methodology", label: "方法与口径" },
];

export default function Header({ searchIndex }: { searchIndex: SearchIndexItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchIndex.slice(0, 8);
    return searchIndex
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.keywords.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, searchIndex]);

  const handleSelect = (href: string) => {
    setSearchOpen(false);
    setMobileOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#e2dfd7] bg-[#faf9f6]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#0f2942] text-sm font-bold text-white">
            图
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-base font-bold tracking-tight text-[#0f2942]">
              中国数据地图 <span className="hidden text-xs font-medium text-[#b83a2d] sm:inline">R2</span>
            </div>
            <div className="hidden truncate text-[11px] text-slate-600 md:block">
              China Data Atlas · 权威公开统计研究平台
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="主导航" className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#0f2942] text-white"
                    : "text-slate-700 hover:bg-stone-200/70 hover:text-[#0f2942]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="全局搜索指标、省份或数据故事"
            className="flex items-center gap-2 rounded-lg border border-[#d6d2c8] bg-white px-3 py-1.5 text-sm text-slate-600 shadow-xs transition hover:border-[#0f2942] hover:text-[#0f2942]"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">搜索 44 指标 / 31 省…</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d6d2c8] bg-white text-slate-800 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <nav
          aria-label="移动端导航"
          className="border-t border-[#e2dfd7] bg-white px-4 py-3 lg:hidden"
        >
          <div className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active
                      ? "bg-[#0f2942] text-white"
                      : "bg-stone-100 text-slate-800 hover:bg-stone-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Instant Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 px-4 pt-16 backdrop-blur-xs"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
              <Search className="h-5 w-5 text-slate-600" />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入关键词：如 GDP、广东、老龄化、每千人医师、浙江、电力、研究生…"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="关闭搜索框"
                className="rounded p-1 text-slate-600 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {results.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-600">
                  未找到匹配“{query}”的指标、省份或故事。可尝试前往{" "}
                  <Link
                    href="/assistant"
                    onClick={() => setSearchOpen(false)}
                    className="font-medium text-[#b83a2d] underline"
                  >
                    统计研究查询引擎
                  </Link>
                  。
                </div>
              ) : (
                results.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => handleSelect(item.href)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-stone-100"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {item.type === "indicator" && <BarChart3 className="h-4 w-4 shrink-0 text-[#0f2942]" />}
                      {item.type === "province" && <MapPin className="h-4 w-4 shrink-0 text-[#b83a2d]" />}
                      {item.type === "story" && <BookOpen className="h-4 w-4 shrink-0 text-[#1e6b52]" />}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{item.title}</div>
                        <div className="truncate text-xs text-slate-600">{item.subtitle}</div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded bg-stone-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {item.type === "indicator" ? "指标" : item.type === "province" ? "省份档案" : "数据故事"}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-2 text-[11px] text-slate-600">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1e6b52]" />
                全部数据来自国家统计局 / 教育部 / 国家卫健委公开官方统计
              </span>
              <span>ESC 或点击背景关闭</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
