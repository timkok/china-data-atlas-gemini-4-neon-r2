import { describe, expect, it } from "vitest";
import {
  buildCsv,
  computeCAGR,
  computeDistribution,
  computeIndexed,
  computePearson,
  computeYoY,
  formatCitation,
} from "../analytics";
import { getQuantileBucket, REGIONAL_MATRIX_ADAPTER } from "../spatialAdapter";

describe("Round 2 Statistical Analytics Engine", () => {
  it("computes YoY strictly for consecutive calendar years", () => {
    const res = computeYoY([
      { year: 2020, value: 100 },
      { year: 2021, value: 110 },
      { year: 2023, value: 132 }, // gap in 2022 -> must NOT compute fake YoY!
    ]);
    expect(res).toEqual([{ year: 2021, value: 10 }]);
  });

  it("rebases series cleanly to baseYear = 100", () => {
    const { baseYearUsed, series } = computeIndexed(
      [
        { year: 2014, value: 80 },
        { year: 2015, value: 100 },
        { year: 2020, value: 150 },
      ],
      2015
    );
    expect(baseYearUsed).toBe(2015);
    expect(series.find((p) => p.year === 2015)?.value).toBe(100);
    expect(series.find((p) => p.year === 2020)?.value).toBe(150);
  });

  it("computes exact CAGR and guards non-positive inputs", () => {
    expect(computeCAGR(100, 121, 2020, 2022)).toBe(10);
    expect(computeCAGR(-5, 10, 2020, 2022)).toBeNull();
    expect(computeCAGR(100, 120, 2022, 2022)).toBeNull();
  });

  it("computes Pearson r accurately and refuses small samples", () => {
    expect(computePearson([1, 2, 3, 4], [2, 4, 6, 8])).toBe(1);
    expect(computePearson([1, 2, 3, 4], [8, 6, 4, 2])).toBe(-1);
    expect(computePearson([1, 2], [2, 4])).toBeNull();
  });

  it("computes quartile distribution & IQR fences", () => {
    const d = computeDistribution([10, 20, 30, 40, 50]);
    expect(d).not.toBeNull();
    expect(d?.median).toBe(30);
    expect(d?.q1).toBe(20);
    expect(d?.q3).toBe(40);
    expect(d?.iqr).toBe(20);
  });

  it("serializes RFC-4180 CSV with UTF-8 BOM and proper quoting", () => {
    const csv = buildCsv(["name", "note"], [["广东", '含逗号,与"引号"']]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"含逗号,与""引号"""');
  });

  it("generates GB/T 7714 and APA citations", () => {
    const gbt = formatCitation("年末常住人口", "Population", "国家统计局", "2000–2025", "gbt7714", "/indicators/population");
    const apa = formatCitation("年末常住人口", "Population", "NBS", "2000–2025", "apa", "/indicators/population");
    expect(gbt).toContain("[DS/OL]");
    expect(apa).toContain("[Dataset]");
  });

  it("exposes compliant SpatialViewAdapter metadata & quantile bucketing", () => {
    expect(REGIONAL_MATRIX_ADAPTER.mapStatus).toBe("deferred_with_pluggable_provider_interface");
    expect(REGIONAL_MATRIX_ADAPTER.approvalNumber).toBeNull();
    expect(getQuantileBucket(100, [10, 20, 30, 40, 100])).toBe(4);
    expect(getQuantileBucket(null, [10, 20])).toBe(-1);
  });
});
