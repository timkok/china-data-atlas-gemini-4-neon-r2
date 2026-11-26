# Known Limitations & Honest Disclosure — China Data Atlas (Round 2)

In line with Round 2 transparency principles, every unresolved constraint, external access limitation, statistical caveat, and unexecuted verification check is disclosed explicitly below:

## 1. Geographic & Map Limitations
- **Standard Interactive Choropleth Map Deferred (`map_status: "deferred_with_pluggable_provider_interface"`)**: From our overseas execution environment (tested 2026-11-24), MNR Standard Map Service (`bzdt.ch.mnr.gov.cn`) failed DNS resolution, `www.tianditu.gov.cn` returned HTTP 418 WAF block, and `lbs.tianditu.gov.cn` timed out. Furthermore, publishing dynamic Chinese thematic maps legally requires compliant reviewed basemaps/审图号 under《地图管理条例》and《公开地图内容表示规范（2023）》. We intentionally did **not** load unreviewed third-party GeoJSON files or fabricate approval numbers; instead, we ship a compliant 7-Region Quantile Spatial Matrix + Ranking Bar + formal `SpatialViewAdapter` contract.
- **Mainland 31-Province Scope**: NBS provincial annual series cover Mainland China's 31 provinces, autonomous regions, and municipalities. Hong Kong SAR, Macao SAR, and Taiwan Province publish under separate statistical bureaus and are intentionally not mixed into mainland provincial rankings (this is purely a statistical scope boundary, not a geographic determination).
- **Prefecture-Level Cities Deferred to Phase 3**: Live reachability checks confirmed Guangdong, Jiangsu, and Zhejiang statistical bureaus are accessible (HTTP 200), but each publishes distinct HTML/Excel yearbook schemas without a unified cross-province JSON API. Our database schema (`regions.csv` and `postgres_schema.sql`) already supports `geo_level = 'prefecture'` with GB/T 2260 codes for Phase 3.

## 2. Statistical & Official Data Coverage Limitations
- **`postgraduate_students` Is National-Only**: NBS `publicrelease` does not publish a continuous 31-province postgraduate enrollment time series; rather than fabricating or scraping incomplete media tables, this indicator is transparently scoped `national_only` (2000–2025, cross-checked against official MOE 2024 & 2025 Education Bulletins).
- **Mixed 2025 Provincial Publication Cadence**: As of Nov 2026, NBS `publicrelease` has published 2025 provincial figures for population, GDP, GDP sectors, GDP per capita, disposable income, consumption, retail sales, fiscal revenue/expenditure, CPI, and electricity, whereas 2025 provincial birth rate, urbanization, education, and healthcare remain at 2024 (with 2025 national totals published). Every indicator page exposes a **Complete Comparable Year vs. Latest Data** toggle to prevent accidental mixed-year provincial comparisons.
- **NHC Portal HTTP 412 Challenge**: Direct automated requests to `http://www.nhc.gov.cn/guihuaxxs/s3585u/index.shtml` returned HTTP 412 (anti-bot JS challenge). We respected HTTP 412 strictly without bypassing; 2024 national healthcare benchmarks and 2000–2004 NHC direct historical vintages are cited transparently in metadata and `vintages.csv`.
- **Known Historical Methodological Breaks** (all documented in `indicators.csv` and UI warnings):
  - `physicians_per_1000`: 2002 statutory switch under《执业医师法》.
  - `health_institutions`: 2009 inclusion of village clinics (`村卫生室`).
  - `highway_mileage`: 2005 inclusion of village roads (`村道`).
  - `rd_expenditure_industrial`: 2011 threshold change from 5M to 20M RMB main business revenue.
  - `disposable_income` & `urban_rural_income_ratio`: Restricted cleanly to 2013+ unified urban-rural household survey.
  - `fiscal_revenue` / `fiscal_expenditure`: National rows cover Central + Local combined budgets; provincial rows cover Local budgets only (tax-sharing scope).
  - `life_expectancy`: Published only in decennial census benchmark years (2000, 2010, 2020 for provinces); inter-census years remain null without interpolation.

## 3. Verification & Test Scope Limitations (`tests_not_run`)
- **Mainland China Direct Network Access (`mainland_access_status: "not_verified_overseas_host"`)**: Deployment verification was conducted from an overseas US host; latency and CDN routing from inside Mainland China (e.g., China Telecom/Unicom/Mobile) were **not** directly tested and are counted honestly under `tests_not_run`, never as passed.
- **WeChat In-App WebView (`wechat_browser_status: "not_verified_overseas_host"`)**: Mobile responsiveness was verified at 390×844 in Chromium Playwright, but rendering inside the live WeChat iOS/Android embedded WebView could not be executed in this headless sandbox and is honestly recorded under `tests_not_run`.
- **Evidence Depth Transparency**: Out of 30,220 canonical observations, 28,673 bulk official NBS API cells remain honestly graded `E1` (`single_official_api`) because they were not individually audited against a second publication; 167 rows are `E2` (official HTML parses + 105 newly audited stratified raw-file samples), 23 rows are `E3` (dual-official-source cross-checked), and 1,357 rows are `E4` (multi-model adjudicated with official raw evidence).
