"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";

const DynamicEChartCanvas = dynamic(() => import("./EChartCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-stone-200 bg-stone-50/70 text-xs text-stone-500">
      正在加载交互式图表引擎…
    </div>
  ),
});

interface LazyChartProps {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
  eager?: boolean;
  onReady?: (exportPng: () => string | null) => void;
}

export default function LazyChart({
  option,
  height = 380,
  className = "",
  eager = false,
  onReady,
}: LazyChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (visible) return;
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={hostRef} style={{ minHeight: `${height}px` }} className={`w-full ${className}`}>
      {visible ? (
        <DynamicEChartCanvas option={option} height={height} onReady={onReady} />
      ) : (
        <div
          style={{ height: `${height}px` }}
          className="flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50/70 text-xs text-stone-500"
        >
          滚动到此处自动加载交互式图表
        </div>
      )}
    </div>
  );
}
