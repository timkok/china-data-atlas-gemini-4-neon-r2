"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([
  LineChart,
  BarChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  TitleComponent,
  CanvasRenderer,
]);

export interface EChartCanvasProps {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
  onReady?: (exportPng: () => string | null) => void;
}

export default function EChartCanvas({
  option,
  height = 380,
  className = "",
  onReady,
}: EChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const instance = echarts.init(el, undefined, { renderer: "canvas" });
    chartRef.current = instance;

    if (onReady) {
      onReady(() => {
        if (!chartRef.current) return null;
        return chartRef.current.getDataURL({
          type: "png",
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });
      });
    }

    const ro = new ResizeObserver(() => {
      instance.resize();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      instance.dispose();
      chartRef.current = null;
    };
  }, [onReady]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setOption(option, { notMerge: true });
    }
  }, [option]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px`, width: "100%" }}
      className={className}
      role="img"
      aria-label="数据可视化图表"
    />
  );
}
