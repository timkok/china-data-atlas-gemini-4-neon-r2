# China Data Atlas | 中国数据地图 (Round 2)

> **Make China's Data Accessible, Understandable, Traceable and Explorable.**

China Data Atlas (Round 2) is an independent, evidence-graded, open-access statistical research platform for China's national and 31-province official datasets (`2000–2025`), built by **Gemini 4 Neon** following a complete cross-model audit of all 9 Round 1 AI submissions.

---

## Core Upgrades in Round 2

- **Cross-Model Audit & Official Adjudication (`/audit`)**: Audited all 9 Round 1 Drive directories (`grok_bot`, `gemini_4_neon`, `claude_opus_5_5`, `gpt6_astra_pro`, `gemini_unavail`, `muse_spark_1_3`, `gpt6_2`, and 2 empty Codex folders), documented **18 P0/P1/P2 findings** (including an honest self-audit of Gemini 4 Neon R1), and adjudicated **1,911 cross-model value conflicts** strictly via official raw evidence (zero majority voting or averaging).
- **Indicator Expansion (12 → 44 Official Indicators)**: Expanded to **30,220 verified official observations** across 5 themes (Demographics, Economy & Fiscal, Education & Innovation, Healthcare, Energy/Environment/Infrastructure), cleanly splitting regular/vocational undergraduates (`higher_education_students`) from postgraduates (`postgraduate_students`).
- **3-Layer Architecture & Multi-Vintage History**:
  - **Layer 1 (Raw Evidence)**: Freshly ingested NBS `publicrelease` JSON payloads + SHA-256 hash manifest (`data/input_manifest/raw_evidence_hashes.csv`) + full request log (`reports/source_access_log.csv`).
  - **Layer 2 (Canonical Candidate + Vintages)**: Strict separation of `evidence_level` (`E1`–`E4`; `E0` barred from canonical) and `extraction_method` (`API`, `HTML`, `Derived`), plus **2,807 multi-vintage archive records** (`data/canonical_candidate/vintages.csv`) preserving Pre-5EC GDP/retail, Pre-7th-Census demographics, NHC 2000–2004 direct physicians, NBS integer per-10k÷10 physicians, and MOE July 2026 vs NBS Feb 2026 revisions.
  - **Layer 3 (Analytical & Web Exports)**: DuckDB (`china_data_atlas_r2.duckdb`), ZSTD Parquet (`observations.parquet`), SQLite (`china_data_atlas_r2.sqlite`), PostgreSQL DDL (`pipeline/transformations/postgres_schema.sql`), and slim route-scoped Next.js JSON slices.
- **Major Product & UX Upgrade**:
  - **31 Province Profile Pages (`/provinces/[code]`)** with national ranks, YoY/10-year change, and province CSV exports.
  - **Multi-Province Comparison (`/compare`)** aligned strictly on common comparable years.
  - **Unified Data Explorer (`/explore`)** with live Pearson `r` bubble scatter + multi-province × multi-indicator CAGR & synchronized CSV export.
  - **6 Pipeline-Computed Data Stories (`/stories/[slug]`)** separating Direct Statistical Facts from Analytical Inferences.
  - **Deterministic Research Query Engine (`/assistant`)** explicitly marked non-LLM, outputting exact query specs, formulas, charts, and honest refusal on unsupported/speculative prompts.
  - **Map Compliance & Pluggable `SpatialViewAdapter`**: Compliant 7-region quantile spatial matrix + ranking bars with formal `SpatialViewAdapter` provider interface (`map_status: "deferred_with_pluggable_provider_interface"`).
  - **Automated Update, Staging & Rollback Pipeline**: Isolated sandbox update test (`reports/update_test_report.json`) verifying new-year detection, revision preservation, invalid-batch blocking, human-review gate (`auto_published: false`), and byte-identical SHA-256 rollback.

---

## Repository Layout

```text
├── audit/                  # Cross-model audit report, inventory, comparison, overlap, 18 findings, reuse attribution
├── research/               # PRODUCT_RESEARCH.md, DATA_SOURCE_RESEARCH.md, MAP_COMPLIANCE_RESEARCH.md, DATA_RIGHTS_REVIEW.md
├── data/
│   ├── input_manifest/     # Read-only Round 1 manifest & Layer-1 SHA-256 raw evidence hashes
│   ├── metadata/           # regions.csv (GB/T 2260), indicators.csv (44), sources.csv, indicator_crosswalk.csv
│   ├── raw/nbs_r2/         # 70 freshly fetched NBS publicrelease JSON payloads
│   ├── reconciliation/     # conflicts.csv, resolved_conflicts.csv, unresolved_conflicts.csv
│   ├── canonical_candidate/# observations.csv (30,220 rows) + vintages.csv (2,807 rows)
│   └── processed/          # DuckDB, Parquet, SQLite databases
├── pipeline/               # ingestion/, reconciliation/, transformations/, validation/, update/
├── app/                    # Next.js 15 + React 19 + TypeScript + Tailwind 4 + Tree-shaken ECharts 5
├── tests/                  # pytest data & update tests + Playwright 20-task E2E suite + Vitest unit tests
├── reports/                # data_quality_report.json, coverage_matrix.csv, data_validation_samples.csv, update_test_report.json, lighthouse/
├── screenshots/            # 8 Desktop & Mobile visual verification captures
└── deployment/             # DEPLOYMENT_INFO.md
```

---

## Quick Start (Reproducible Local Execution)

```bash
# 1. Data pipeline & tests (Python 3.12+)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python pipeline/transformations/build_canonical_candidate.py
python pipeline/validation/quality_gate_r2.py
pytest -v tests/data/

# 2. Web application (Node 20+)
cd app
npm ci
npm run typecheck
npm run test:unit
npm run build
npm run start
```

---

## Licensing & Data Attribution Notice

- **Software & Pipeline Code**: MIT License.
- **Underlying Official Statistical Data**: Owned and published by the National Bureau of Statistics of China (NBS), Ministry of Education (MOE), and National Health Commission (NHC). **Underlying official statistical datasets are NOT declared CC0.** Please preserve official source attribution and revision vintage notes when citing or reusing.
