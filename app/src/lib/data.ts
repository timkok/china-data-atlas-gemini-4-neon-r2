import fs from "node:fs";
import path from "node:path";
import type {
  AuditData,
  DataStory,
  ExploreData,
  IndicatorSlice,
  ProvinceProfile,
  SummaryData,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "src", "data");

function readJson<T>(relPath: string): T {
  const full = path.join(DATA_DIR, relPath);
  return JSON.parse(fs.readFileSync(full, "utf-8")) as T;
}

let _summaryCache: SummaryData | null = null;
export function getSummary(): SummaryData {
  if (!_summaryCache) _summaryCache = readJson<SummaryData>("summary.json");
  return _summaryCache;
}

export function getIndicatorSlice(indicatorId: string): IndicatorSlice | null {
  const p = path.join(DATA_DIR, "indicators", `${indicatorId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as IndicatorSlice;
}

export function getAllIndicatorIds(): string[] {
  return getSummary().indicators.map((i) => i.indicator_id);
}

export function getProvinceProfile(geoCode: string): ProvinceProfile | null {
  const p = path.join(DATA_DIR, "provinces", `${geoCode}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as ProvinceProfile;
}

export function getAllProvinceCodes(): string[] {
  return getSummary()
    .regions.filter((r) => r.geo_code !== "000000")
    .map((r) => r.geo_code);
}

export function getExploreData(): ExploreData {
  return readJson<ExploreData>("explore.json");
}

export function getAuditData(): AuditData {
  return readJson<AuditData>("audit.json");
}

export function getStories(): DataStory[] {
  return readJson<DataStory[]>("stories.json");
}

export function getStoryBySlug(slug: string): DataStory | null {
  return getStories().find((s) => s.slug === slug) ?? null;
}
