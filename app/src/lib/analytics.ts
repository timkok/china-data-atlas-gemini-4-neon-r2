import type { EvidenceLevel } from "./types";

export interface SeriesPoint {
  year: number;
  value: number;
}

export function formatNum(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || Number.isNaN(val)) return "—";
  return val.toLocaleString("zh-CN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompact(val: number | null | undefined, unit = "", decimals = 1): string {
  if (val === null || val === undefined || Number.isNaN(val)) return "—";
  if (Math.abs(val) >= 10000000 && unit === "人") {
    return `${(val / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 万人`;
  }
  return `${formatNum(val, decimals)}${unit ? ` ${unit}` : ""}`;
}

/** Year-over-Year growth rate (%) strictly between consecutive calendar years (t and t-1). */
export function computeYoY(points: SeriesPoint[]): SeriesPoint[] {
  const byYr = new Map(points.map((p) => [p.year, p.value]));
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const out: SeriesPoint[] = [];
  for (const pt of sorted) {
    const prev = byYr.get(pt.year - 1);
    if (prev !== undefined && Math.abs(prev) > 1e-9) {
      out.push({
        year: pt.year,
        value: Number((((pt.value - prev) / Math.abs(prev)) * 100).toFixed(2)),
      });
    }
  }
  return out;
}

/** Rebase time series so baseYear = 100 (falls back to earliest positive year if baseYear missing). */
export function computeIndexed(
  points: SeriesPoint[],
  baseYear?: number
): { baseYearUsed: number | null; series: SeriesPoint[] } {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  if (sorted.length === 0) return { baseYearUsed: null, series: [] };
  const basePt =
    (baseYear !== undefined ? sorted.find((p) => p.year === baseYear && p.value > 0) : undefined) ??
    sorted.find((p) => p.value > 0);
  if (!basePt) return { baseYearUsed: null, series: [] };
  return {
    baseYearUsed: basePt.year,
    series: sorted.map((p) => ({
      year: p.year,
      value: Number(((p.value / basePt.value) * 100).toFixed(2)),
    })),
  };
}

/** Compound Annual Growth Rate (%) between startVal (startYear) and endVal (endYear). */
export function computeCAGR(
  startVal: number,
  endVal: number,
  startYear: number,
  endYear: number
): number | null {
  const n = endYear - startYear;
  if (n <= 0 || startVal <= 0 || endVal <= 0) return null;
  return Number(((Math.pow(endVal / startVal, 1 / n) - 1) * 100).toFixed(2));
}

/** Sample Pearson correlation coefficient r. Returns null if n < 3 or zero variance. */
export function computePearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return Number((num / Math.sqrt(dx2 * dy2)).toFixed(4));
}

export interface DistributionSummary {
  n: number;
  min: number;
  q1: number;
  median: number;
  mean: number;
  q3: number;
  max: number;
  iqr: number;
  upperFence: number;
  lowerFence: number;
}

export function computeDistribution(values: number[]): DistributionSummary | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const q = (p: number) => {
    const pos = (n - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
  };
  const q1 = q(0.25);
  const median = q(0.5);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  return {
    n,
    min: s[0],
    q1: Number(q1.toFixed(2)),
    median: Number(median.toFixed(2)),
    mean: Number(mean.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    max: s[n - 1],
    iqr: Number(iqr.toFixed(2)),
    lowerFence: Number((q1 - 1.5 * iqr).toFixed(2)),
    upperFence: Number((q3 + 1.5 * iqr).toFixed(2)),
  };
}

/** RFC-4180 CSV serialization with UTF-8 BOM for clean Excel opening in Chinese environments. */
export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (cell: string | number | null | undefined) => {
    const s = cell === null || cell === undefined ? "" : String(cell);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  return "\uFEFF" + lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatCitation(
  indicatorNameZh: string,
  indicatorNameEn: string,
  sourceName: string,
  yearSpan: string,
  style: "gbt7714" | "apa",
  urlPath: string
): string {
  const accessDate = "2026-11-25";
  const fullUrl = `https://china-data-atlas-gemini-4-neon-r2.vercel.app${urlPath}`;
  if (style === "gbt7714") {
    return `中国数据地图 (China Data Atlas). ${indicatorNameZh} (${yearSpan}) [DS/OL]. 原始来源: ${sourceName}. (${accessDate}). ${fullUrl}.`;
  }
  return `China Data Atlas. (2026). ${indicatorNameEn} (${yearSpan}) [Dataset]. Original source: ${sourceName}. Retrieved ${accessDate}, from ${fullUrl}`;
}

export const EVIDENCE_META: Record<
  EvidenceLevel,
  { label: string; short: string; colorClass: string; desc: string }
> = {
  E4: {
    label: "E4 · 多模型复核裁决",
    short: "E4",
    colorClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
    desc: "经Round 1多AI模型交叉比对冲突，并由官方原始数据裁决确认（含版本归档）。",
  },
  E3: {
    label: "E3 · 双官方源交叉核验",
    short: "E3",
    colorClass: "bg-teal-100 text-teal-900 border-teal-300",
    desc: "经国家统计局数据库与统计公报/教育部/卫健委两个独立官方源交叉核验一致。",
  },
  E2: {
    label: "E2 · 原始文件/抽样审计",
    short: "E2",
    colorClass: "bg-sky-100 text-sky-900 border-sky-300",
    desc: "来自官方公报HTML直接解析，或经Round 2分层抽样与原始文件逐项核验一致。",
  },
  E1: {
    label: "E1 · 单一官方API来源",
    short: "E1",
    colorClass: "bg-stone-100 text-stone-800 border-stone-300",
    desc: "直接自动采集自国家统计局公开数据接口，保留原始值与单位，未单独逐条抽检。",
  },
  E0: {
    label: "E0 · 待核验（禁入权威库）",
    short: "E0",
    colorClass: "bg-red-100 text-red-900 border-red-300",
    desc: "未核验草稿级别，严禁进入正式权威候选库。",
  },
};

export const DOMAIN_LABELS: Record<string, { zh: string; en: string; accent: string }> = {
  demographics: { zh: "人口与社会", en: "Demographics & Society", accent: "#0F4C81" },
  economy: { zh: "经济与财政", en: "Economy & Fiscal", accent: "#B83A2D" },
  education_rd: { zh: "教育与科创", en: "Education & Innovation", accent: "#6B46C1" },
  healthcare: { zh: "医疗卫生", en: "Healthcare", accent: "#1E6B52" },
  energy_env_infra: { zh: "能源、环境与基建", en: "Energy, Env & Infra", accent: "#B45309" },
};
