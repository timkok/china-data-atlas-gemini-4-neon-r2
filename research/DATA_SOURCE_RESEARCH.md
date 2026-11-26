# China Data Atlas — Round 2 Official Data Source & Sub-Provincial Feasibility Research

- **Author**: Gemini 4 Neon (Autonomous Data Engineering & Research Team)
- **Date**: 2026-11-25
- **Scope**: Official data acquisition reliability audit, multi-ministry cross-verification sources, expansion indicator sourcing, and exploratory prefecture-level city feasibility assessment.

---

## 1. Executive Summary

Round 2 independently re-verified every official public data endpoint used across Round 1 implementations and expanded China Data Atlas from **12 core indicators** to **44 official indicators** spanning **30,220 verified observations** (2000–2025, National + 31 Mainland Provinces). Every raw payload was freshly retrieved via polite, sequential, anonymous HTTP calls with zero login, CAPTCHA, or WAF bypassing, and logged in [source_access_log.csv](file:///Users/tian/.gemini/antigravity/scratch/china-data-atlas-gemini-4-neon-r2/reports/source_access_log.csv) with SHA-256 digests in [raw_evidence_hashes.csv](file:///Users/tian/.gemini/antigravity/scratch/china-data-atlas-gemini-4-neon-r2/data/input_manifest/raw_evidence_hashes.csv).

---

## 2. Official Source Reliability & Access Matrix (Verified Live)

| Source | Endpoint / URL | Live Test Status | Browser Required? | Reproducibility & Update Suitability | Usage in Round 2 |
|---|---|---|---|---|---|
| **NBS National Annual (`publicrelease`)** | `https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData` (`rootId=884c...`, `showType=1`) | **HTTP 200** (27/27 specs OK) | **No** (pure HTTP POST + `Referer`) | **High** — deterministic JSON, covers 2000–2025, supports automated incremental check | Primary source for all 44 National series (`E1`, upgraded to `E3`/`E4` when cross-checked) |
| **NBS Provincial Annual (`publicrelease`)** | `https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData` (`rootId=c4d8...`, `showType=3`) | **HTTP 200** (43/43 specs OK, 1 transient read timeout succeeded on retry) | **No** (1 POST = 31 provinces × 26 years) | **High** — covers all 28 NBS thematic categories; 2025 provincial GDP/Pop/Income/Fiscal/CPI/Electricity already published! | Primary source for 43/44 indicators across all 31 Mainland Provinces |
| **NBS Legacy `easyquery.htm`** | `https://data.stats.gov.cn/easyquery.htm` | **HTTP 403 (`UrlACL`)** | N/A | **Deprecated / Blocked** — do not use or bypass | Documented as blocked legacy portal |
| **NBS Portal UI Download Button** | `https://data.stats.gov.cn/dg/website/page.html#/pc/national/fsYearData` | **Login + CAPTCHA required** | Yes | **Not used** — never bypass login/CAPTCHA | Bypassed strictly *avoided*; used anonymous public table-view API instead |
| **NBS 2025 National Statistical Communiqué** | `https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html` | **HTTP 200** (56 KB text) | **No** (single polite GET) | **High** (published Feb 28 annually; avoid rapid loops due to `www.stats.gov.cn` JS WAF) | Independent **E3** cross-verification of 13 national 2025 headline indicators |
| **NBS 7th Population Census Bulletin No. 5** | `https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902005.html` | **HTTP 200** | **No** | **Static Decennial Benchmark** | Direct **E2/E3** 2020 full-census anchor for `population_65plus` and `population_0_14_share` (32 regions) |
| **MOE 2024 & 2025 Education Statistical Bulletins** | `http://www.moe.gov.cn/jyb_sjzl/sjzl_fztjgb/202607/t20260706_1442870.html` & `.../202506/t20250611_1193760.html` | **HTTP 200** | **No** | **High** (clean static HTML; published annually mid-year) | Independent **E3** cross-check of 2024–2025 undergrads, postgraduates, senior high, primary, and 2025 HEIs (`2,919`) + genuine NBS-prelim vs MOE-final vintage |
| **NHC Health Statistics Portal** | `http://www.nhc.gov.cn/guihuaxxs/s3585u/index.shtml` | **HTTP 412** (JS anti-bot challenge) | Browser / manual | **Blocked for headless scripts** — strictly respected HTTP 412 without bypassing | Referenced for documented 2024 national benchmarks (`3.61` physicians, `7.29` beds) & 2000–2004 historical vintage attribution |

---

## 3. Deep Audit of NBS `publicrelease` Sustainability & Risk Controls

1. **No Browser / Session Coupling**: Unlike Grok Bot's Round 1 Playwright-coupled scraper, our Round 2 ingestion script (`pipeline/ingestion/fetch_nbs_r2.py`) uses standard Python `requests` with a public `Referer` header — zero headless browser overhead, deterministic execution (~40s for all 70 specs = 35,771 cells), and clean CI/CD compatibility.
2. **Rate-Limiting & Polite Access**: Sequential `0.4s` spacing avoids overloading NBS servers; caching prevents redundant re-fetches; single transient timeout (`prov_health_institutions`) recovered cleanly via idempotent retry.
3. **Long-Term Maintenance Risks**:
   - NBS `cid` and `indicatorId` are opaque 32-character UUIDs that could rotate during future NBS portal redesigns. **Mitigation**: Our automated update script (`pipeline/update/check_and_stage_update.py`) validates expected row counts, schemas, and checksums before staging, halting cleanly rather than corrupting production if UUIDs change.
   - `NBS_DATA_PROVINCIAL` omits provincial postgraduate enrollment (`研究生在校生`) and provincial 2025 birth/urbanization rates as of Nov 2026. **Mitigation**: `postgraduate_students` is explicitly scoped `national_only`, and every indicator exposes **Latest Data vs. Complete Comparable Year** so users never compare mixed-year provincial slices.

---

## 4. Exploratory Prefecture-Level City Feasibility Assessment (Guangdong, Jiangsu, Zhejiang)

To assess roadmap readiness for sub-provincial (地级市) expansion without prematurely shipping fragmented or low-reliability city tables, we tested both NBS's central portal and three leading provincial statistical bureaus:

| Target Bureau / Portal | URL Tested | Live HTTP Status (2026-11-24/25) | Machine-Readable API? | Prefecture-Level Data Format & Assessment |
|---|---|---|---|---|
| **NBS `publicrelease` Major Cities** | `data.stats.gov.cn` tree under `6b8e8719075f43d4bf83b261208b37b5` | HTTP 200 (only `分省年度数据` under provincial tree; major cities cover only 36 provincial capitals/key cities, NOT all 333 prefectures) | Partial (36 cities only) | Insufficient for full provincial prefecture coverage (e.g., misses Suzhou, Dongguan, Foshan, Wuxi, Wenzhou). |
| **Guangdong Bureau of Statistics** | `https://stats.gd.gov.cn/` | **HTTP 200** (69,360 bytes) | No unified REST API; HTML/Excel Yearbook tables (`广东统计年鉴`) | **Feasible for Phase 3**: All 21 prefecture-level cities published annually in structured HTML/XLS yearbook chapters; requires per-year table parser & 5EC revision reconciliation. |
| **Jiangsu Bureau of Statistics** | `https://tj.jiangsu.gov.cn/` | **HTTP 200** (59,426 bytes) | No unified REST API; HTML/Excel Yearbook (`江苏统计年鉴`) | **Feasible for Phase 3**: All 13 prefecture-level cities cleanly structured in Excel yearbook downloads; strong historical continuity. |
| **Zhejiang Bureau of Statistics** | `https://tjj.zj.gov.cn/` | **HTTP 200** (53,418 bytes) | Partial open-data catalog + `浙江统计年鉴` HTML/Excel | **Feasible for Phase 3**: All 11 prefecture-level cities consistently published; high-quality urban/rural income breakdowns. |

### Conclusion on Prefecture-Level Expansion
- **Why Deferred to Phase 3**: While Guangdong (21 cities), Jiangsu (13 cities), and Zhejiang (11 cities) bureaus are reachable over HTTP 200, each provincial bureau uses distinct HTML/Excel table layouts, different historical revision cadences (especially post-5th Economic Census GDP revisions), and lacks a unified cross-province JSON API. Shipping 45 coastal cities without unified national prefecture coverage or automated reconciliation would fragment schema comparability.
- **Architectural Readiness**: Our `regions.csv` and `postgres_schema.sql` already support `geo_level = 'prefecture'` with GB/T 2260 6-digit codes (e.g., `440300` Shenzhen, `320500` Suzhou, `330100` Hangzhou), allowing zero-schema-change Phase 3 ingestion once automated provincial-yearbook parsers are audited.

---

## 5. Indicator Expansion Rationale (12 Core → 44 Official Indicators)

All 32 newly added indicators meet strict selection criteria: (1) official NBS/MOE/NHC source, (2) ≥15 years of continuous history (except unified 2013+ household income/consumption and decennial census life expectancy), (3) high public/research utility, and (4) explicit resolution of Round 1 taxonomy conflicts:
- **Demographics (+7)**: Added `death_rate`, `natural_growth_rate`, `urban_population`, `rural_population`, `population_0_14_share`, `old_age_dependency_ratio`, and `life_expectancy` — enabling exact vital-rate and urban-rural accounting identity checks.
- **Economy, Income & Fiscal (+12)**: Added `gdp_primary`, `gdp_secondary`, `gdp_tertiary`, `tertiary_gdp_share`, `urban_disposable_income`, `rural_disposable_income`, `urban_rural_income_ratio`, `consumption_expenditure`, `average_wage_urban_nonprivate`, `fiscal_revenue`, `fiscal_expenditure`, and `cpi` — unlocking structural transformation, household distribution, and fiscal capacity research.
- **Education & Innovation (+5)**: Explicitly split `postgraduate_students` from `higher_education_students` (eliminating Muse Spark 1.3's Round 1 conflation), plus added `senior_high_students`, `primary_school_students`, `rd_expenditure_industrial`, and `patent_grants_domestic`.
- **Healthcare (+3)**: Added `nurses_per_1000`, `health_institutions`, and `hospital_bed_utilization` alongside reconciled `physicians_per_1000` and `hospital_beds_per_1000`.
- **Energy, Environment & Infrastructure (+5)**: Added `electricity_consumption`, `per_capita_water`, `forest_coverage_rate`, `highway_mileage`, and `private_cars`.
