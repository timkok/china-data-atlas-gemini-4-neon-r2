# Changelog — China Data Atlas

## Round 2 (`R2-v2.0` · 2026-11-26)

### Data & Statistical Governance
- **Cross-Model Audit & Reconciliation**: Audited all 9 Round 1 Drive folders; documented 18 evidence-backed P0/P1/P2 findings (`audit/findings.csv`) including honest self-audit of `gemini_4_neon` R1; resolved 1,911 cross-model value conflicts via official raw sources (`data/reconciliation/resolved_conflicts.csv`).
- **Fixed Round 1 Verification Inflation**: Replaced R1's uniform `verified` label with strict `evidence_level` (`E1`–`E4`; `E0` barred from canonical) separated from `extraction_method` (`API`, `HTML`, `Derived`). Bulk single-source NBS API rows remain honestly graded `E1` (28,673 rows); only directly audited/HTML rows = `E2` (167), dual-official-source cross-checks = `E3` (23), and reconciled multi-model conflicts = `E4` (1,357).
- **Indicator Expansion (12 → 44)**: Expanded from 9,110 observations (12 indicators) to **30,220 observations across 44 official indicators** (2000–2025, including newly released 2025 provincial GDP, population, income, retail sales, fiscal, CPI, and electricity data).
- **Higher Education Split**: Formally separated `postgraduate_students` (National 2000–2025, NBS + MOE cross-checked) from `higher_education_students` (regular & vocational undergrad/college, eliminating R1 cross-model conflation).
- **Multi-Vintage Archive (`vintages.csv`)**: Preserved **2,807 multi-vintage records** across 1,401 cells (Pre-5EC vs Post-5EC GDP/GDP per capita/retail, Pre-7th-Census vs Post-7th-Census demographics, NHC 2000–2004 direct physicians, NBS integer per-10k÷10 physicians, and MOE July 2026 final vs NBS Feb 2026 preliminary).
- **Multi-Format Storage**: Added DuckDB (`china_data_atlas_r2.duckdb`), ZSTD Parquet (`observations.parquet`), SQLite (`china_data_atlas_r2.sqlite`), and PostgreSQL DDL (`pipeline/transformations/postgres_schema.sql`).
- **Automated Update & Rollback Pipeline**: Built `pipeline/update/check_and_stage_update.py`, GitHub Actions CI & weekly read-only check workflows, and passed an isolated 5-scenario update & rollback simulation (`reports/update_test_report.json`).

### Product, Performance & UX
- **Performance Architecture Overhaul**: Replaced monolithic eager ECharts import with tree-shaken `echarts/core` + `next/dynamic(..., { ssr: false })` lazy hydration + palette-deduplicated indicator JSON slices.
- **31 Province Profile Pages (`/provinces/[code]`)**: Full cross-domain scorecards with national rank badges, YoY/10-year change, trend viewer, and per-province CSV export.
- **Multi-Province Comparison (`/compare`)**: Side-by-side 2–5 province comparison strictly aligned on common comparable years with presets and `Indexed (2015=100)` trends.
- **Unified Explorer (`/explore`)**: Live Pearson `r` cross-indicator bubble scatter with causation disclaimer + multi-province × multi-indicator CAGR & synchronized CSV export.
- **6 Pipeline-Computed Data Stories (`/stories/[slug]`)**: Dynamic pipeline computation separating Direct Statistical Facts from Analytical Inferences.
- **Deterministic Research Query Engine (`/assistant`)**: Explicitly positioned non-LLM statistical query tool with transparent query specs, formulas, charts, and speculative refusal.
- **Cross-Model Audit Center (`/audit`)**: Interactive R1 model inventory, P0/P1/P2 findings ledger, and searchable conflict adjudication explorer.
- **Pluggable `SpatialViewAdapter` Interface**: Formal compliance contract (`map_status: "deferred_with_pluggable_provider_interface"`) backed by `research/MAP_COMPLIANCE_RESEARCH.md`.

## Round 1 (`R1-v1.0` · 2026-11-24)
- Initial independent delivery with 12 core indicators (9,110 observations), NBS `publicrelease` discovery, Next.js 16 + ECharts 6 web app, and live Vercel deployment. Remains archived untouched in its original repository, deployment, and Drive folder.
