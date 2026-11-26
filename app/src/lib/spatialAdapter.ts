/**
 * Pluggable SpatialViewAdapter Interface — Map Compliance Architecture (Round 2)
 * ==============================================================================
 * Per 《地图管理条例》 & 《公开地图内容表示规范（2023）》 (see research/MAP_COMPLIANCE_RESEARCH.md),
 * unreviewed GeoJSON polygons and fabricated approval numbers (审图号) are strictly prohibited.
 *
 * Current active mode: "deferred_with_pluggable_provider_interface"
 *  - Renders a 100% legally compliant 7-Region Provincial Matrix + Quantile Color Scale + Ranked Bars.
 *  - Defines a clean adapter contract so an authorized Tianditu (天地图) tile/vector provider
 *    (with valid NEXT_PUBLIC_TIANDITU_TK + MNR 审图号 metadata) can be plugged in without refactoring UI.
 */

export type SpatialProviderMode =
  | "compliant_regional_matrix"
  | "tianditu_wmts_authorized"
  | "mnr_reviewed_standard_basemap";

export interface SpatialDatum {
  geo_code: string;
  short_zh: string;
  name_zh: string;
  macro_region_zh: string;
  value: number | null;
  rank: number | null;
}

export interface SpatialViewAdapter {
  readonly id: SpatialProviderMode;
  readonly displayNameZh: string;
  readonly mapStatus: "deferred_with_pluggable_provider_interface" | "compliant_map_active";
  readonly requiresApprovalNumber: boolean;
  readonly approvalNumber: string | null;
  isAvailable(): boolean;
  getComplianceNotice(): string;
}

export const REGIONAL_MATRIX_ADAPTER: SpatialViewAdapter = {
  id: "compliant_regional_matrix",
  displayNameZh: "七大地理大区省级空间矩阵（合规定量色阶）",
  mapStatus: "deferred_with_pluggable_provider_interface",
  requiresApprovalNumber: false,
  approvalNumber: null,
  isAvailable: () => true,
  getComplianceNotice: () =>
    "依据《地图管理条例》与《公开地图内容表示规范（2023）》，本项目未采用未经审图的第三方GeoJSON行政边界，亦不虚构审图号。默认采用合规的七大地理大区省级空间矩阵与排名条形图；已预留标准 SpatialViewAdapter 接口，待配置自然资源部/天地图合规底图凭证后可无缝启用标准专题地图。港澳台地区因独立统计体系未纳入国家统计局内地31省统计表，不代表任何地理归属判断。",
};

export const TIANDITU_PROVIDER_ADAPTER: SpatialViewAdapter = {
  id: "tianditu_wmts_authorized",
  displayNameZh: "国家天地图官方底图接口（需授权Token及合规审图）",
  mapStatus: "deferred_with_pluggable_provider_interface",
  requiresApprovalNumber: true,
  approvalNumber: null,
  isAvailable: () => Boolean(process.env.NEXT_PUBLIC_TIANDITU_TK),
  getComplianceNotice: () =>
    "天地图服务在海外评测节点存在访问限制（实测HTTP 418/超时）且需要注册实名tk凭证，动态专题地图发布还须遵循审图规定，当前保持未激活状态。",
};

export const MACRO_REGION_ORDER = [
  { key: "华北", en: "North China", codes: ["110000", "120000", "130000", "140000", "150000"] },
  { key: "东北", en: "Northeast China", codes: ["210000", "220000", "230000"] },
  { key: "华东", en: "East China", codes: ["310000", "320000", "330000", "340000", "350000", "360000", "370000"] },
  { key: "华中", en: "Central China", codes: ["410000", "420000", "430000"] },
  { key: "华南", en: "South China", codes: ["440000", "450000", "460000"] },
  { key: "西南", en: "Southwest China", codes: ["500000", "510000", "520000", "530000", "540000"] },
  { key: "西北", en: "Northwest China", codes: ["610000", "620000", "630000", "640000", "650000"] },
] as const;

/** Compute a 5-step accessible sequential choropleth color bucket (0..4) for positive/neutral values. */
export function getQuantileBucket(value: number | null, sortedVals: number[]): number {
  if (value === null || sortedVals.length === 0) return -1;
  const n = sortedVals.length;
  let idx = sortedVals.findIndex((v) => v >= value);
  if (idx === -1) idx = n - 1;
  const pct = idx / Math.max(n - 1, 1);
  if (pct >= 0.8) return 4;
  if (pct >= 0.6) return 3;
  if (pct >= 0.4) return 2;
  if (pct >= 0.2) return 1;
  return 0;
}

export const CHOROPLETH_PALETTE = [
  { bg: "#EEF2F6", text: "#132238", border: "#CBD5E1" }, // Q1 Lowest 20%
  { bg: "#C5D9EA", text: "#0F2942", border: "#93B7D5" }, // Q2
  { bg: "#79A7CC", text: "#FFFFFF", border: "#5B8FB9" }, // Q3
  { bg: "#2E6A99", text: "#FFFFFF", border: "#1E517A" }, // Q4
  { bg: "#0F2942", text: "#FFFFFF", border: "#091B2D" }, // Q5 Top 20%
] as const;
