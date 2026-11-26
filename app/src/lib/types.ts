export type EvidenceLevel = "E0" | "E1" | "E2" | "E3" | "E4";
export type ExtractionMethod = "API" | "HTML" | "Derived" | "PDF" | "OCR" | "Manual";

export interface RegionMeta {
  geo_code: string;
  name_zh: string;
  name_en: string;
  short_zh: string;
  geo_level: "national" | "province" | "prefecture";
  macro_region_zh: string;
  macro_region_en: string;
  nbs_economic_zone_zh: string;
  nbs_economic_zone_en: string;
  capital_zh: string;
  capital_en: string;
  iso_3166_2: string;
  in_mainland_nbs_scope: string;
  scope_note: string;
}

export interface ProvinceCard {
  geo_code: string;
  name_zh: string;
  short_zh: string;
  name_en: string;
  macro_region_zh: string;
  nbs_economic_zone_zh: string;
  population: number | null;
  population_year: number | null;
  gdp: number | null;
  gdp_year: number | null;
  disposable_income: number | null;
  aging_65plus: number | null;
}

export interface IndicatorMeta {
  indicator_id: string;
  is_core_r1: string;
  domain_id: string;
  domain_zh: string;
  domain_en: string;
  name_zh: string;
  name_en: string;
  short_zh: string;
  unit_zh: string;
  unit_en: string;
  display_decimals: string;
  geo_coverage_scope: string;
  time_coverage_note: string;
  higher_is_better: string;
  definition_zh: string;
  definition_en: string;
  formula_note: string;
  methodological_breaks: string;
  limitations_zh: string;
  primary_source_id: string;
}

export interface IndicatorSummary extends IndicatorMeta {
  total_rows: number;
  year_min: number;
  year_max: number;
  complete_comparable_year: number;
  national_latest_year: number | null;
  national_latest_value: number | null;
  top_province: { geo_code: string; name_zh: string; value: number } | null;
  vintages_archived: number;
  sparkline: [number, number][];
}

export interface SourceMeta {
  source_id: string;
  source_name_zh: string;
  source_name_en: string;
  publisher_zh: string;
  publisher_en: string;
  url: string;
  access_method: string;
  update_cadence: string;
  license_status: string;
  redistribution_policy: string;
  notes: string;
}

export interface SummaryData {
  generated_at_utc: string;
  version: string;
  stats: {
    total_observations: number;
    total_indicators: number;
    core_r1_indicators: number;
    expansion_r2_indicators: number;
    total_regions: number;
    provinces_count: number;
    year_min: number;
    year_max: number;
    evidence_levels: Record<string, number>;
    extraction_methods: Record<string, number>;
    vintages_count: number;
    resolved_conflicts_count: number;
    r1_models_audited: number;
    validation_samples_audited?: number;
    validation_samples_passed?: number;
  };
  regions: RegionMeta[];
  provinceCards: ProvinceCard[];
  indicators: IndicatorSummary[];
  sources: SourceMeta[];
}

export interface CompactObsRow {
  g: string; // geo_code
  y: number; // year
  v: number; // value
  ov: string; // original_value
  ou: string; // original_unit
  el: EvidenceLevel;
  em: ExtractionMethod;
  rf: string; // revision_flag
  st: number; // sourceTables index
  vid: string; // vintage_id
}

export interface CompactVintage {
  g: string;
  y: number;
  vid: string;
  lbl: string;
  v: number;
  curr: boolean;
  d: number | string;
  src: string;
  pub: string;
  n: string;
}

export interface IndicatorSlice {
  meta: IndicatorMeta;
  coverage: {
    indicator_id: string;
    total_rows: number;
    national_rows: number;
    provincial_rows: number;
    provinces_covered: number;
    year_min: number;
    year_max: number;
    complete_comparable_year: number;
    distinct_years: number;
    coverage_pct_over_active_years: number;
    e1_count: number;
    e2_count: number;
    e3_count: number;
    e4_count: number;
    vintages_archived: number;
  };
  sourceTables: string[];
  rows: CompactObsRow[];
  vintages: CompactVintage[];
  totalVintageRecords: number;
}

export interface ProvinceMetric {
  indicator_id: string;
  domain_id: string;
  name_zh: string;
  short_zh: string;
  unit_zh: string;
  is_core_r1: boolean;
  latest_year: number;
  value: number;
  yoy_pct: number | null;
  chg10_pct: number | null;
  national_value: number | null;
  rank: number | null;
  rank_of: number | null;
  evidence_level: EvidenceLevel;
  series: [number, number][];
}

export interface ProvinceProfile {
  region: RegionMeta;
  metricsCount: number;
  metrics: ProvinceMetric[];
}

export interface ExploreData {
  series: Record<string, Record<string, [number, number][]>>;
}

export interface AuditData {
  inventory: Record<string, string>[];
  comparison: Record<string, string>[];
  overlap: Record<string, string>[];
  findings: Record<string, string>[];
  conflictSummary: {
    total: number;
    unresolved: number;
    byCategory: Record<string, number>;
    byIndicator: Record<string, number>;
  };
  conflictSamples: Record<string, string | number>[];
}

export interface DataStory {
  slug: string;
  title_zh: string;
  title_en: string;
  tag: string;
  reading_minutes: number;
  research_question: string;
  summary_zh: string;
  kpis: { label: string; value: string; detail: string }[];
  formula: string;
  chartType: string;
  chartData: Record<string, unknown>;
  facts: string[];
  inferences: string[];
  sources: string[];
  limitations: string;
  relatedIndicators: string[];
}
