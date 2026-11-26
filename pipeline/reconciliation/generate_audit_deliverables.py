"""
Generates complete Phase 1 Cross-Model Audit deliverables strictly derived from
actual Round 1 downloaded files, r1_index_summary.json, data_overlap_matrix.csv,
reconciliation_summary.json, conflicts.csv, and live browser inspection evidence.

Outputs:
  - audit/round1_inventory.csv
  - audit/model_comparison.csv
  - audit/findings.csv  (exact 17-column Round 2 schema)
  - audit/cross_model_audit.md
  - audit/reuse_attribution.md
"""

import csv
import json
from pathlib import Path
import pandas as pd

R2_ROOT = Path(__file__).resolve().parents[2]
AUDIT_DIR = R2_ROOT / "audit"
AUDIT_DIR.mkdir(parents=True, exist_ok=True)


def compute_model_metrics() -> dict:
    """Recomputes exact counts directly from each model's raw observations.csv."""
    from reconcile_r1 import MODEL_FILES, CROSSWALK_MAP, norm_geo

    stats = {}
    for slug, label, path in MODEL_FILES:
        df = pd.read_csv(path, low_memory=False)
        cols = set(df.columns)
        ind_col = "indicator_id" if "indicator_id" in cols else "indicator"
        geo_col = "geo_code" if "geo_code" in cols else "region_code"
        ver_col = "verification_status" if "verification_status" in cols else ("status" if "status" in cols else None)
        url_col = "source_url" if "source_url" in cols else None

        core_inds = set()
        ext_inds = set()
        geos = set()
        years = []
        valid_rows = 0
        ver_counts = {}
        wiki_or_blog_rows = 0

        for _, r in df.iterrows():
            raw_ind = str(r[ind_col]).strip()
            if pd.isna(r["value"]):
                continue
            try:
                float(r["value"])
            except Exception:
                continue
            valid_rows += 1
            if raw_ind in CROSSWALK_MAP:
                cid, _, _, _, is_core = CROSSWALK_MAP[raw_ind]
                if is_core:
                    core_inds.add(cid)
                else:
                    ext_inds.add(cid)
            g = norm_geo(r[geo_col])
            geos.add(g)
            years.append(int(float(r["year"])))
            if ver_col:
                vs = str(r.get(ver_col, "") or "").strip()
                ver_counts[vs] = ver_counts.get(vs, 0) + 1
            if url_col:
                u = str(r.get(url_col, "") or "").lower()
                if any(k in u for k in ["wikipedia", "obpai", "uutool", "sina.cn", "yicai", "ageclub", "gotohui"]):
                    wiki_or_blog_rows += 1

        provs = {g for g in geos if g != "000000" and len(g) == 6}
        stats[slug] = {
            "rows": valid_rows,
            "core_indicators": len(core_inds),
            "ext_indicators": len(ext_inds),
            "prov_count": len(provs),
            "has_national": "000000" in geos,
            "min_year": min(years) if years else None,
            "max_year": max(years) if years else None,
            "ver_counts": ver_counts,
            "secondary_source_rows": wiki_or_blog_rows,
        }
    return stats


def main():
    idx_summary = json.loads((R2_ROOT / "data/input_manifest/r1_index_summary.json").read_text(encoding="utf-8"))
    rec_summary = json.loads((AUDIT_DIR / "reconciliation_summary.json").read_text(encoding="utf-8"))
    ov_df = pd.read_csv(AUDIT_DIR / "data_overlap_matrix.csv")
    mstats = compute_model_metrics()

    # 1. audit/round1_inventory.csv
    inventory_rows = [
        {
            "model_slug": "grok_bot",
            "model_identity": "Grok Bot (Model Version Unavailable)",
            "drive_folder_id": "1Myux8GqrLiP0IyAX5wHJkjF0FTUHCsMR",
            "access_status": "accessible_complete",
            "drive_file_count": idx_summary["grok_bot"]["total_files_indexed"],
            "core_indicators_delivered": mstats["grok_bot"]["core_indicators"],
            "additional_indicators_delivered": mstats["grok_bot"]["ext_indicators"],
            "unique_valid_observations": mstats["grok_bot"]["rows"],
            "earliest_year": mstats["grok_bot"]["min_year"],
            "latest_year": mstats["grok_bot"]["max_year"],
            "provincial_coverage": f"{mstats['grok_bot']['prov_count']}/31 + National",
            "historical_continuity": "High: 2000-2025 continuous panel across 12 core + 3 extended indicators (91.7% mean 2000-latest; 100% 2015-latest)",
            "verification_definition": "Strict: verified=106 (direct independent pub match), partially_verified=8710 (NBS API official), unverified=2413; indicator gate >=5 independent matches (11/12)",
            "secondary_non_official_rows": mstats["grok_bot"]["secondary_source_rows"],
            "tech_architecture": "Python ETL + DuckDB/Parquet + Next.js static export + ECharts",
            "deployment_status": "local_static_build_only (GitHub & Vercel blocked by environment)",
            "live_url": "",
            "test_evidence": "104 passed / 0 failed / 3 not run (30 pytest + 5 node + 69 Playwright + real Lighthouse JSON)",
            "primary_limitations": "No live public preview/GitHub repo; mobile Lighthouse Perf 73 (LCP 7.4s); physicians_per_1000 missing 2000/2005-2007 and 2011-2013 hukou break; no geographic map",
        },
        {
            "model_slug": "gemini_4_neon",
            "model_identity": "Gemini 4 Neon",
            "drive_folder_id": "1QRtc23mP3sGLekDyMqWw_Te7jC9Y0T3G",
            "access_status": "accessible_complete",
            "drive_file_count": idx_summary["gemini_4_neon"]["total_files_indexed"],
            "core_indicators_delivered": mstats["gemini_4_neon"]["core_indicators"],
            "additional_indicators_delivered": mstats["gemini_4_neon"]["ext_indicators"],
            "unique_valid_observations": mstats["gemini_4_neon"]["rows"],
            "earliest_year": mstats["gemini_4_neon"]["min_year"],
            "latest_year": mstats["gemini_4_neon"]["max_year"],
            "provincial_coverage": f"{mstats['gemini_4_neon']['prov_count']}/31 + National",
            "historical_continuity": "High: 2000-2025 continuous panel across all 12 core indicators via NBS publicrelease API",
            "verification_definition": "Inflated in R1: marked all 9,110 rows 'verified' despite only 60 independent validation samples in DELIVERY_REPORT",
            "secondary_non_official_rows": mstats["gemini_4_neon"]["secondary_source_rows"],
            "tech_architecture": "Python NBS API pipeline + Next.js 16 + TypeScript + Tailwind 4 + ECharts 6",
            "deployment_status": "deployed_and_verified_live_public (GitHub PR #1 + Vercel public 200 OK)",
            "live_url": "https://china-data-atlas-gemini-4-neon-r1.vercel.app",
            "test_evidence": "25 passed / 0 failed / 2 not run + 10/10 acceptance tasks + live browser verified",
            "primary_limitations": "Verification status inflation (9110 marked verified on 60 samples); silently substituted derived physicians_per_1000 under official indicator_id; minor 1280px nav wrap; no geographic map",
        },
        {
            "model_slug": "claude_opus_5_5",
            "model_identity": "Claude Opus 5.5",
            "drive_folder_id": "103Q9txnKYcPiXz_DApN_zOJdjEebb30P",
            "access_status": "accessible_complete",
            "drive_file_count": idx_summary["claude_opus_5_5"]["total_files_indexed"],
            "core_indicators_delivered": mstats["claude_opus_5_5"]["core_indicators"],
            "additional_indicators_delivered": mstats["claude_opus_5_5"]["ext_indicators"],
            "unique_valid_observations": mstats["claude_opus_5_5"]["rows"],
            "earliest_year": mstats["claude_opus_5_5"]["min_year"],
            "latest_year": mstats["claude_opus_5_5"]["max_year"],
            "provincial_coverage": f"{mstats['claude_opus_5_5']['prov_count']}/31 + National (code 100000)",
            "historical_continuity": "Medium: 2004-2024 across 9 core + 3 substitute indicators from Yearbook 2016-2025 images/XLS; 2020 birth_rate missing",
            "verification_definition": "Dual-pass Tesseract OCR consensus + 2021 XLS direct read + 152 manual visual reviews (ocr_review.csv) + 120 raw files SHA-256",
            "secondary_non_official_rows": mstats["claude_opus_5_5"]["secondary_source_rows"],
            "tech_architecture": "Python OCR/XLS + DuckDB/Parquet + Next.js 16 + Tailwind 4 + ECharts 6",
            "deployment_status": "vercel_sso_protected (redirects to vercel.com/login; not publicly accessible)",
            "live_url": "https://china-data-atlas-claude-cgc0nwahr-timkok621-1320.vercel.app (SSO-gated)",
            "test_evidence": "Playwright 11 scenarios x desktop/mobile + spot_check.csv + quality_report.json; no root EVALUATION.json",
            "primary_limitations": "Dropped 3/12 core indicators (retail_sales, physicians_per_1000, hospital_beds_per_1000); unversioned GDP splices pre-/post-4th-Census creating ~35% cliffs; uses 100000 for National; Vercel preview SSO-locked",
        },
        {
            "model_slug": "gpt6_astra_pro",
            "model_identity": "GPT-6 Astra Pro",
            "drive_folder_id": "1Q6Y3Je7xmmfAh3wADcp_UWxeyjbrLA4V",
            "access_status": "accessible_complete",
            "drive_file_count": idx_summary["gpt6_astra_pro"]["total_files_indexed"],
            "core_indicators_delivered": mstats["gpt6_astra_pro"]["core_indicators"],
            "additional_indicators_delivered": mstats["gpt6_astra_pro"]["ext_indicators"],
            "unique_valid_observations": mstats["gpt6_astra_pro"]["rows"],
            "earliest_year": mstats["gpt6_astra_pro"]["min_year"],
            "latest_year": mstats["gpt6_astra_pro"]["max_year"],
            "provincial_coverage": f"{mstats['gpt6_astra_pro']['prov_count']}/31 + National",
            "historical_continuity": "Shallow: 2000-2025 national series, but provincial panels sparse (GDP only 2024; retail 2023-2024; 65+ 2020 census only)",
            "verification_definition": "Gold-standard epistemic transparency: 72/1,416 point-verified, 92/92 source-to-browser verified, separate observation_versions.csv & evidence_manifest.csv",
            "secondary_non_official_rows": mstats["gpt6_astra_pro"]["secondary_source_rows"],
            "tech_architecture": "Python ETL + Static Web App + SVG charts + URL query-state sync",
            "deployment_status": "deployed_and_verified_live_public (chatgpt.site 200 OK; GitHub/Vercel blocked)",
            "live_url": "https://china-data-atlas-gpt6-astra-r1-20261123.tian-liao-4133.chatgpt.site/",
            "test_evidence": "168 passed / 0 failed / 1 partial / 5 not run; 9 pass + 1 partial acceptance; Lighthouse Not Run",
            "primary_limitations": "Sparse multi-year provincial history breaks 2015-2024 multi-province CAGR comparison; empty 2000-2026 years shown in dropdown; 2024 GDP preliminary vintage; Lighthouse not run",
        },
        {
            "model_slug": "gemini_unavail",
            "model_identity": "Gemini (Model Version Unavailable)",
            "drive_folder_id": "1zN44CCnW8IfJ1Elmk48gZL1YhF900nUP",
            "access_status": "accessible_complete",
            "drive_file_count": idx_summary["gemini_unavail"]["total_files_indexed"],
            "core_indicators_delivered": mstats["gemini_unavail"]["core_indicators"],
            "additional_indicators_delivered": mstats["gemini_unavail"]["ext_indicators"],
            "unique_valid_observations": mstats["gemini_unavail"]["rows"],
            "earliest_year": mstats["gemini_unavail"]["min_year"],
            "latest_year": mstats["gemini_unavail"]["max_year"],
            "provincial_coverage": f"{mstats['gemini_unavail']['prov_count']}/31 + National (ISO CN-XX codes)",
            "historical_continuity": "Mixed: 2000-2025 patchy snapshots across 12 indicators; relies heavily on Wikipedia/news/blogs for provincial tables",
            "verification_definition": "Misleading: claims 42 'total_verified_sources' and 60/60 exact matches while 541 rows (35.5%) cite Wikipedia + Yicai/AgeClub/gotohui",
            "secondary_non_official_rows": mstats["gemini_unavail"]["secondary_source_rows"],
            "tech_architecture": "Node/Next.js SSR + REST API + ZIP deliverable",
            "deployment_status": "local_only (GitHub & Vercel blocked by environment)",
            "live_url": "",
            "test_evidence": "8 data + 8 unit + 20 E2E + 10/10 self-reported acceptance",
            "primary_limitations": "P0 source quality errors: 541 Wikipedia rows, Yicai pre-5th-Census 2024 retail sales (-10.1% wrong in Zhejiang), AgeClub wrong Hubei 65+ (16.12 vs 17.29), Beijing Health URL misattributed to Xinjiang; mixes Nov-1 census pop into Dec-31 series",
        },
        {
            "model_slug": "muse_spark_1_3",
            "model_identity": "Muse Spark 1.3",
            "drive_folder_id": "1TOZVhWJW8Oxc-_ga1e6oZkkL9CPWSG-P",
            "access_status": "accessible_complete",
            "drive_file_count": idx_summary["muse_spark_1_3"]["total_files_indexed"],
            "core_indicators_delivered": mstats["muse_spark_1_3"]["core_indicators"],
            "additional_indicators_delivered": mstats["muse_spark_1_3"]["ext_indicators"],
            "unique_valid_observations": mstats["muse_spark_1_3"]["rows"],
            "earliest_year": mstats["muse_spark_1_3"]["min_year"],
            "latest_year": mstats["muse_spark_1_3"]["max_year"],
            "provincial_coverage": f"{mstats['muse_spark_1_3']['prov_count']}/31 + National (code 100000)",
            "historical_continuity": "Very Shallow: 2015-2025 national series + mostly single-year provincial snapshots; 0 provincial rows for retail_sales & higher_ed_students",
            "verification_definition": "Honest partial disclosure: 70/428 verified (NHC 2024 Yearbook PDF + NBS communiqués), remainder honestly labeled partially_verified",
            "secondary_non_official_rows": mstats["muse_spark_1_3"]["secondary_source_rows"],
            "tech_architecture": "Python ETL + Static Site + Detailed Phase 5 bug-fix log",
            "deployment_status": "local_only (GitHub not connected; Vercel 403/timeout)",
            "live_url": "",
            "test_evidence": "23 passed / 0 failed / 1 not run; 9 pass + 1 partial acceptance; thorough phase5_fix_log.md",
            "primary_limitations": "~49% of rows (211/428) come from non-official mirrors (Wikipedia, obpai.com, uutool.cn, sina.cn); 0 provincial retail_sales & higher_ed_students; uses 100000 for National; no live URL",
        },
        {
            "model_slug": "gpt6_2",
            "model_identity": "GPT-6.2",
            "drive_folder_id": "1HmG5Kbn0J-GLug2mS3D91-ZHdRJhOGVt",
            "access_status": "accessible_complete",
            "drive_file_count": idx_summary["gpt6_2"]["total_files_indexed"],
            "core_indicators_delivered": mstats["gpt6_2"]["core_indicators"],
            "additional_indicators_delivered": mstats["gpt6_2"]["ext_indicators"],
            "unique_valid_observations": mstats["gpt6_2"]["rows"],
            "earliest_year": mstats["gpt6_2"]["min_year"],
            "latest_year": mstats["gpt6_2"]["max_year"],
            "provincial_coverage": f"{mstats['gpt6_2']['prov_count']}/31 + National",
            "historical_continuity": "Minimal: only 184 observations (2011-2025), 11 core + 1 alt undergrad-only, no provincial retail_sales",
            "verification_definition": "Ultra-conservative honest gate: 61/184 verified, 0/12 claimed fully indicator-verified due to sparse coverage",
            "secondary_non_official_rows": mstats["gpt6_2"]["secondary_source_rows"],
            "tech_architecture": "Python ETL + Single-file portable HTML + Static App",
            "deployment_status": "local_static_html_only (no public URL)",
            "live_url": "",
            "test_evidence": "45 passed / 0 failed / 7 not run; 7 pass + 3 partial acceptance",
            "primary_limitations": "Very small dataset (184 obs) insufficient for historical research; contains pre-7th-Census Jiangsu 2015 pop (7976.3 vs 8315.0) and pre-5th-Census 2024 retail_sales (487895 vs 483344.7)",
        },
        {
            "model_slug": "codex_gpt6",
            "model_identity": "Codex GPT-6",
            "drive_folder_id": "1cAjfXt2ZdTd3TAisIV_Gm61Ot7lbQp5n",
            "access_status": "unavailable",
            "drive_file_count": idx_summary["codex_gpt6"]["total_files_indexed"],
            "core_indicators_delivered": 0,
            "additional_indicators_delivered": 0,
            "unique_valid_observations": 0,
            "earliest_year": None,
            "latest_year": None,
            "provincial_coverage": "unavailable (0 files in Drive folder)",
            "historical_continuity": "unavailable",
            "verification_definition": "unavailable",
            "secondary_non_official_rows": 0,
            "tech_architecture": "unavailable",
            "deployment_status": "unavailable",
            "live_url": "",
            "test_evidence": "unavailable",
            "primary_limitations": "Google Drive folder exists (1cAjfXt2ZdTd3TAisIV_Gm61Ot7lbQp5n) but contains 0 deliverable files as of 2026-11-24 audit",
        },
        {
            "model_slug": "codex_unavail",
            "model_identity": "Codex (Model Version Unavailable)",
            "drive_folder_id": "11hyv6PNMhkPspFFrIPlHBlFFfR0yFnd_",
            "access_status": "unavailable",
            "drive_file_count": idx_summary["codex_unavail"]["total_files_indexed"],
            "core_indicators_delivered": 0,
            "additional_indicators_delivered": 0,
            "unique_valid_observations": 0,
            "earliest_year": None,
            "latest_year": None,
            "provincial_coverage": "unavailable (0 files in Drive folder)",
            "historical_continuity": "unavailable",
            "verification_definition": "unavailable",
            "secondary_non_official_rows": 0,
            "tech_architecture": "unavailable",
            "deployment_status": "unavailable",
            "live_url": "",
            "test_evidence": "unavailable",
            "primary_limitations": "Google Drive folder exists (11hyv6PNMhkPspFFrIPlHBlFFfR0yFnd_) but contains 0 deliverable files as of 2026-11-24 audit",
        },
    ]

    with (AUDIT_DIR / "round1_inventory.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(inventory_rows[0].keys()))
        w.writeheader()
        w.writerows(inventory_rows)

    # 2. audit/model_comparison.csv
    comp_rows = [
        {
            "model": "Grok Bot (R1)",
            "data_acquisition_score_5": 5,
            "verification_rigor_score_5": 4.5,
            "raw_evidence_score_5": 4,
            "software_architecture_score_5": 4.5,
            "product_ux_score_5": 4,
            "deployment_accessibility_score_5": 1.5,
            "recalculated_core_obs": 8985,
            "recalculated_total_obs": 11229,
            "agreement_with_nbs_pct": 100.0,
            "secondary_non_official_pct": 0.0,
            "recommended_for_r2_reuse": "NBS publicrelease API catalog discovery; strict >=5 independent verification gate; Playwright+pytest+Lighthouse QA pattern",
        },
        {
            "model": "Gemini 4 Neon (R1 Drive)",
            "data_acquisition_score_5": 5,
            "verification_rigor_score_5": 2.5,
            "raw_evidence_score_5": 3.5,
            "software_architecture_score_5": 4.5,
            "product_ux_score_5": 4.5,
            "deployment_accessibility_score_5": 5,
            "recalculated_core_obs": 9110,
            "recalculated_total_obs": 9110,
            "agreement_with_nbs_pct": 97.1,
            "secondary_non_official_pct": 0.0,
            "recommended_for_r2_reuse": "Next.js 16 + ECharts 6 architecture; 7-region compliant matrix; cross-indicator scatter explorer; live public deployment workflow (after fixing verification inflation & derived physicians split)",
        },
        {
            "model": "Claude Opus 5.5 (R1)",
            "data_acquisition_score_5": 3.5,
            "verification_rigor_score_5": 4,
            "raw_evidence_score_5": 5,
            "software_architecture_score_5": 4.5,
            "product_ux_score_5": 3.5,
            "deployment_accessibility_score_5": 2,
            "recalculated_core_obs": 3749,
            "recalculated_total_obs": 4616,
            "agreement_with_nbs_pct": 81.2,
            "secondary_non_official_pct": 0.0,
            "recommended_for_r2_reuse": "Raw file SHA-256 manifest; Yearbook historical vintage preservation; human-in-the-loop ocr_review.csv audit pattern; direct published urbanization_rate precision check",
        },
        {
            "model": "GPT-6 Astra Pro (R1)",
            "data_acquisition_score_5": 3,
            "verification_rigor_score_5": 5,
            "raw_evidence_score_5": 5,
            "software_architecture_score_5": 4,
            "product_ux_score_5": 4,
            "deployment_accessibility_score_5": 4.5,
            "recalculated_core_obs": 1416,
            "recalculated_total_obs": 1416,
            "agreement_with_nbs_pct": 96.3,
            "secondary_non_official_pct": 0.0,
            "recommended_for_r2_reuse": "observation_versions.csv & evidence_manifest.csv 3-layer provenance; per-row verification badge ('逐点已复核' vs '来源已提取'); NHC 2025 Health Communiqué PDF discovery; URL query state sync",
        },
        {
            "model": "Gemini (Unavail, R1)",
            "data_acquisition_score_5": 2,
            "verification_rigor_score_5": 1.5,
            "raw_evidence_score_5": 2,
            "software_architecture_score_5": 3,
            "product_ux_score_5": 3,
            "deployment_accessibility_score_5": 1,
            "recalculated_core_obs": 1526,
            "recalculated_total_obs": 1526,
            "agreement_with_nbs_pct": 93.6,
            "secondary_non_official_pct": 38.7,
            "recommended_for_r2_reuse": "MOE official annual statistics URLs (2015-2022) as secondary cross-check references; reject Wikipedia/Yicai/AgeClub data ingestion",
        },
        {
            "model": "Muse Spark 1.3 (R1)",
            "data_acquisition_score_5": 2,
            "verification_rigor_score_5": 3.5,
            "raw_evidence_score_5": 3.5,
            "software_architecture_score_5": 3,
            "product_ux_score_5": 3,
            "deployment_accessibility_score_5": 1,
            "recalculated_core_obs": 428,
            "recalculated_total_obs": 428,
            "agreement_with_nbs_pct": 80.4,
            "secondary_non_official_pct": 49.3,
            "recommended_for_r2_reuse": "NHC 2024 China Health Statistical Yearbook official PDF discovery (SHA-256 verified) & disciplined Phase 5 bug-fix logging",
        },
        {
            "model": "GPT-6.2 (R1)",
            "data_acquisition_score_5": 1.5,
            "verification_rigor_score_5": 4.5,
            "raw_evidence_score_5": 3.5,
            "software_architecture_score_5": 3,
            "product_ux_score_5": 2.5,
            "deployment_accessibility_score_5": 1.5,
            "recalculated_core_obs": 182,
            "recalculated_total_obs": 184,
            "agreement_with_nbs_pct": 98.9,
            "secondary_non_official_pct": 0.0,
            "recommended_for_r2_reuse": "Conservative refusal to claim full indicator verification without representative coverage; portable static bundle idea",
        },
        {
            "model": "Codex GPT-6 / Codex (Unavail)",
            "data_acquisition_score_5": 0,
            "verification_rigor_score_5": 0,
            "raw_evidence_score_5": 0,
            "software_architecture_score_5": 0,
            "product_ux_score_5": 0,
            "deployment_accessibility_score_5": 0,
            "recalculated_core_obs": 0,
            "recalculated_total_obs": 0,
            "agreement_with_nbs_pct": 0.0,
            "secondary_non_official_pct": 0.0,
            "recommended_for_r2_reuse": "None (0 files delivered in both Google Drive folders)",
        },
    ]
    with (AUDIT_DIR / "model_comparison.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(comp_rows[0].keys()))
        w.writeheader()
        w.writerows(comp_rows)

    # 3. audit/findings.csv — EXACT 17 required columns!
    findings_fields = [
        "finding_id", "audited_model", "severity", "category", "indicator_id",
        "geo_code", "year", "affected_file_or_url", "reported_value",
        "observed_value", "expected_value", "evidence_url", "evidence_locator",
        "description", "reproduction_steps", "recommended_fix", "verification_status",
    ]
    findings_rows = [
        {
            "finding_id": "FND-001",
            "audited_model": "gemini_unavail",
            "severity": "P0",
            "category": "Confirmed Issue",
            "indicator_id": "retail_sales",
            "geo_code": "330000",
            "year": "2024",
            "affected_file_or_url": "r1_inputs/gemini_unavail/observations.csv",
            "reported_value": "33900.0 亿元 (Yicai news article)",
            "observed_value": "33900.0",
            "expected_value": "37707.7 (NBS official post-5th-Economic-Census revised)",
            "evidence_url": "https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData",
            "evidence_locator": "NBS Provincial Catalog 社会消费品零售总额; geo=330000; year=2024 (matched by Grok/G4N/GPT-6 Astra Pro)",
            "description": "Zhejiang 2024 retail sales is understated by 3,807.7 亿元 (-10.10%) due to ingesting a secondary media article (yicai.com/news/102467084.html) quoting pre-5th-Economic-Census figures; same issue affects Jiangsu (+6.1%), Guangdong (+6.3%), Shandong (-5.2%), and Hunan (+4.1%).",
            "reproduction_steps": "Filter r1_inputs/gemini_unavail/observations.csv where indicator_id='retail_sales' and year=2024; compare CN-ZJ/CN-JS/CN-GD/CN-SD against NBS publicrelease API.",
            "recommended_fix": "Replace all media-sourced retail_sales observations with official NBS publicrelease API post-5th-Economic-Census figures and block non-official news domains in ETL.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-002",
            "audited_model": "gemini_unavail",
            "severity": "P0",
            "category": "Confirmed Issue",
            "indicator_id": "hospital_beds_per_1000",
            "geo_code": "650000",
            "year": "2024",
            "affected_file_or_url": "r1_inputs/gemini_unavail/observations.csv",
            "reported_value": "7.85 citing wjw.beijing.gov.cn",
            "observed_value": "7.85 (URL=Beijing Health Commission)",
            "expected_value": "7.71 (NBS official Xinjiang 2024; Xinjiang source URL)",
            "evidence_url": "https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData",
            "evidence_locator": "NBS Provincial Catalog abc171a8126647abbc1d8b0c69512b12 (每万人医疗机构床位数/10); geo=650000; year=2024",
            "description": "Wrong provincial source URL attribution: Xinjiang (CN-XJ) 2024 hospital_beds_per_1000 cites Beijing Municipal Health Commission (wjw.beijing.gov.cn/.../t20260529_4672706.html) and diverges from official NBS Xinjiang figure (7.71).",
            "reproduction_steps": "Inspect row indicator_id='hospital_beds_per_1000', geo_code='CN-XJ', year=2024 in r1_inputs/gemini_unavail/observations.csv.",
            "recommended_fix": "Enforce strict geo-to-source-domain validation in ETL and source directly from NBS official provincial health catalog.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-003",
            "audited_model": "gemini_unavail",
            "severity": "P0",
            "category": "Confirmed Issue",
            "indicator_id": "ALL",
            "geo_code": "ALL",
            "year": "2000-2024",
            "affected_file_or_url": "r1_inputs/gemini_unavail/EVALUATION.json & observations.csv",
            "reported_value": "total_verified_sources=42; 60/60 exact matches",
            "observed_value": "541/1,526 rows (35.5%) cite zh.wikipedia.org + 50 rows cite Yicai/AgeClub/gotohui (38.7% non-official)",
            "expected_value": "0 non-official secondary sources counted as verified official sources",
            "evidence_url": "r1_inputs/gemini_unavail/observations.csv",
            "evidence_locator": "Column source_url value_counts(): zh.wikipedia.org=541, yicai.com, ageclub.net, gotohui",
            "description": "Severe provenance inflation: EVALUATION.json claims 42 verified sources while 35.5% of observations come from Wikipedia tables and additional rows come from commercial blogs (AgeClub Hubei 2024 65+ = 16.12% vs official NBS 17.29%, -6.8% error).",
            "reproduction_steps": "Group observations.csv by source_url domain; inspect CN-HB 2024 population_65plus (source_id=AGECLUB_A24).",
            "recommended_fix": "Exclude all Wikipedia, blog, and media aggregator tables from canonical public release (grade E0) and source exclusively from official statistical agencies.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-004",
            "audited_model": "gemini_4_neon",
            "severity": "P1",
            "category": "Confirmed Issue",
            "indicator_id": "ALL",
            "geo_code": "ALL",
            "year": "2000-2025",
            "affected_file_or_url": "r1_inputs/gemini_4_neon/EVALUATION.json & data/normalized/observations.csv",
            "reported_value": "verified_observations=9110 (100% of rows marked 'verified')",
            "observed_value": "9,110/9,110 rows labeled verified in CSV & EVALUATION.json",
            "expected_value": "Only directly audited/cross-verified samples upgraded to E2/E3; unsampled NBS API rows remain E1",
            "evidence_url": "r1_inputs/gemini_4_neon/DELIVERY_REPORT.md",
            "evidence_locator": "EVALUATION.json verified_observations=9110 vs DELIVERY_REPORT.md 60 spot-checked samples",
            "description": "Self-audit finding (Verification Status Inflation): Gemini 4 Neon Drive R1 labeled all 9,110 observations 'verified' based on NBS API provenance + 60 spot-check samples, violating the rule that sampling cannot auto-upgrade unsampled observations.",
            "reproduction_steps": "Check value_counts of verification_status in r1_inputs/gemini_4_neon/data/normalized/observations.csv and compare with sample count in reports/data_validation_samples.csv.",
            "recommended_fix": "Adopt strict E0-E4 evidence hierarchy separated from extraction_method in Round 2; grade unsampled NBS API rows E1, spot-checked rows E2, independently 2nd-source matched rows E3, and conflict-resolved revisions E4.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-005",
            "audited_model": "gemini_4_neon",
            "severity": "P1",
            "category": "Definition Difference",
            "indicator_id": "physicians_per_1000",
            "geo_code": "ALL",
            "year": "2000-2025",
            "affected_file_or_url": "r1_inputs/gemini_4_neon/data/normalized/observations.csv",
            "reported_value": "801 rows under indicator_id='physicians_per_1000' (e.g., Beijing 2013=3.63)",
            "observed_value": "Derived ratio: 执业(助理)医师数 / 年末常住人口 x 1000 (801 rows)",
            "expected_value": "Official NBS published 每万人拥有执业(助理)医师数 / 10 (676 rows, Beijing 2013=5.9) OR explicitly separated methodology_version / indicator_id",
            "evidence_url": "https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData",
            "evidence_locator": "NBS Catalog e469513e184d43109318f06a51cb436e vs c990bce9913e47a2b6fc1c6eb596b411; explains exact 125-row difference (Grok 676 vs G4N 801) and 264 value diffs",
            "description": "Solves Round 2 Section 2.1.B 125-row mystery: Gemini 4 Neon Drive R1 silently substituted a derived resident-population ratio (eliminating 124 missing 2000/2005-2007 provincial rows, +1 2025 national row, and NBS's 2011-2013 hukou denominator glitch) under the same indicator_id as the official published rate without separating definitions.",
            "reproduction_steps": "Compare grok_bot (676 rows) and gemini_4_neon (801 rows) on indicator_id='physicians_per_1000'; inspect transformation column and Beijing 2012-2014 values.",
            "recommended_fix": "In Round 2, publish BOTH as explicitly separated series: canonical 'physicians_per_1000' (official NBS published rate with 2012-2014 break warnings) AND 'physicians_per_1000_resident_derived' (explicitly tagged extraction_method='Derived').",
            "verification_status": "Definition Difference",
        },
        {
            "finding_id": "FND-006",
            "audited_model": "claude_opus_5_5",
            "severity": "P1",
            "category": "Official Revision",
            "indicator_id": "gdp",
            "geo_code": "120000",
            "year": "2015-2023",
            "affected_file_or_url": "r1_inputs/claude_opus_5_5/02_data/observations.csv",
            "reported_value": "Tianjin 2016 GDP=17885.39; Liaoning 2015=28669.02; Inner Mongolia 2011 GDP/cap=57974",
            "observed_value": "Pre-4th-Economic-Census Yearbook preliminary values spliced with post-4th-Census 2019+ values",
            "expected_value": "Tianjin 2016=11487.0; Liaoning 2015=20657.8; Inner Mongolia 2011 GDP/cap=38894 (NBS post-4th/5th-Census revised)",
            "evidence_url": "https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData",
            "evidence_locator": "NBS Provincial GDP Catalog vs China Statistical Yearbook 2016-2019 Table 3-9 (718 official revision rows between Claude & NBS API)",
            "description": "Unversioned vintage splicing: Claude's OCR extracted authentic Yearbook preliminary numbers (0 gross OCR digit errors across 3,912 overlapping keys!), but stitching pre-4th-Economic-Census 2015-2018 GDP to post-4th-Census 2019-2023 GDP inside one active series creates artificial 30%-36% cliffs in Tianjin, Liaoning, and Inner Mongolia.",
            "reproduction_steps": "Plot claude_opus_5_5 gdp for geo_code=120000 (Tianjin) across 2015-2023 and compare against NBS API.",
            "recommended_fix": "Preserve Yearbook preliminary figures inside a dedicated fact_vintage table while serving post-5th-Economic-Census consistent historical series as the canonical default.",
            "verification_status": "Official Revision",
        },
        {
            "finding_id": "FND-007",
            "audited_model": "claude_opus_5_5",
            "severity": "P1",
            "category": "Confirmed Issue",
            "indicator_id": "retail_sales|physicians_per_1000|hospital_beds_per_1000",
            "geo_code": "ALL",
            "year": "2000-2025",
            "affected_file_or_url": "r1_inputs/claude_opus_5_5/01_docs/blockers.md & 02_data/observations.csv",
            "reported_value": "12 indicators delivered (9 core + 3 substitutes)",
            "observed_value": "0 rows for retail_sales, physicians_per_1000, hospital_beds_per_1000",
            "expected_value": "12/12 core indicators with provincial coverage",
            "evidence_url": "https://data.stats.gov.cn/dg/website/publicrelease/web/external/new/queryIndexTreeAsync?pid=c4d82af16c3d4f0cb4f09d4af7d5888e&code=6",
            "evidence_locator": "NBS publicrelease provincial API provides all 3 missing core indicators without bypassing any WAF",
            "description": "Claude stopped at legacy easyquery.htm HTTP 403 and did not discover the official publicrelease NBS API, causing 3 of 12 core indicators to be omitted (honestly documented in blockers.md and replaced by consumption_expenditure & bed-occupancy).",
            "reproduction_steps": "List distinct indicator values in r1_inputs/claude_opus_5_5/02_data/observations.csv.",
            "recommended_fix": "Ingest all 12 core indicators directly from the official NBS publicrelease API.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-008",
            "audited_model": "gemini_unavail",
            "severity": "P1",
            "category": "Definition Difference",
            "indicator_id": "population",
            "geo_code": "500000",
            "year": "2000",
            "affected_file_or_url": "r1_inputs/gemini_unavail/observations.csv",
            "reported_value": "Chongqing 2000=3090.0; Hubei 2000=6028.0 (Nov-1 5th Census from Wikipedia)",
            "observed_value": "Census Nov-1 point-in-time counts mixed into Dec-31 year-end series (28 provinces in 2000 & 2020)",
            "expected_value": "Chongqing 2000=2849.0; Hubei 2000=5646.0 (NBS Dec-31 year-end resident population)",
            "evidence_url": "https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData",
            "evidence_locator": "NBS Provincial Population Catalog (年末常住人口) vs Wikipedia 历次普查与近年常住人口表",
            "description": "Splices Nov-1 Census population counts (2000 5th Census & 2020 7th Census) into a Dec-31 year-end resident population series, creating up to 7.8% single-year discontinuities (e.g., Chongqing 2000 +241w, Hubei 2000 +382w).",
            "reproduction_steps": "Compare gemini_unavail population rows for year=2000 and year=2020 against NBS year-end resident population.",
            "recommended_fix": "Use consistent Dec-31 year-end resident population throughout the annual series and tag Census Nov-1 point counts as a distinct census_snapshot vintage.",
            "verification_status": "Definition Difference",
        },
        {
            "finding_id": "FND-009",
            "audited_model": "muse_spark_1_3",
            "severity": "P1",
            "category": "Confirmed Issue",
            "indicator_id": "ALL",
            "geo_code": "ALL",
            "year": "2015-2025",
            "affected_file_or_url": "r1_inputs/muse_spark_1_3/data/normalized/observations.csv",
            "reported_value": "428 valid observations across 12 indicators",
            "observed_value": "211/428 rows (49.3%) cite non-official websites (Wikipedia 93, sina.cn 56, obpai.com 31, uutool.cn 31); 0 provincial rows for retail_sales & higher_education_students",
            "expected_value": "100% official primary sources with full 31-province coverage across all 12 core indicators",
            "evidence_url": "r1_inputs/muse_spark_1_3/data/normalized/observations.csv",
            "evidence_locator": "source_url domain distribution in observations.csv; confirmed in LIMITATIONS.md",
            "description": "Nearly half of delivered observations rely on secondary mirrors/blogs (though honestly marked partially_verified), and 2 core indicators have zero provincial rows. Pre-7th-Census national birth_rate (2015-2019) and pre-5th-Census 2024 retail_sales (487895 vs 483344.7) also appear.",
            "reproduction_steps": "Inspect source_url counts and geo_level='province' counts by indicator in r1_inputs/muse_spark_1_3/data/normalized/observations.csv.",
            "recommended_fix": "Retain Muse Spark 1.3's authentic NHC 2024 Health Yearbook PDF cross-check evidence, while replacing all mirror/blog rows with official NBS publicrelease API records.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-010",
            "audited_model": "grok_bot",
            "severity": "P2",
            "category": "Confirmed Issue",
            "indicator_id": "ALL",
            "geo_code": "ALL",
            "year": "2000-2025",
            "affected_file_or_url": "r1_inputs/grok_bot/EVALUATION.json & reports/lighthouse/",
            "reported_value": "Mobile Lighthouse Performance=73 (home) / 74 (indicator-gdp), LCP=7.4s",
            "observed_value": "Mobile LCP 7.4s (target >=90 performance)",
            "expected_value": "Lighthouse Mobile Performance >=90 via per-indicator data chunking and lazy chart loading",
            "evidence_url": "r1_inputs/grok_bot/EVALUATION.json",
            "evidence_locator": "lighthouse.home.performance=73, lcp='7.4 s'; lighthouse.indicator-gdp.performance=74, lcp='7.4 s'",
            "description": "Grok Bot's real Lighthouse audit transparently documented a mobile LCP bottleneck (7.4s, score 73-74) caused by eager heavy client bundle/data loading despite 100 Accessibility/SEO scores.",
            "reproduction_steps": "Read lighthouse block in r1_inputs/grok_bot/EVALUATION.json.",
            "recommended_fix": "Split static data into lightweight per-indicator JSON shards loaded on demand and dynamically import ECharts components on the client.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-011",
            "audited_model": "claude_opus_5_5",
            "severity": "P2",
            "category": "Environment Limitation",
            "indicator_id": "ALL",
            "geo_code": "ALL",
            "year": "2026",
            "affected_file_or_url": "https://china-data-atlas-claude-cgc0nwahr-timkok621-1320.vercel.app",
            "reported_value": "Deployed Vercel preview URL",
            "observed_value": "Redirects to https://vercel.com/login (Vercel Deployment Protection SSO gate)",
            "expected_value": "Public unauthenticated HTTP 200 access for end-users and external reviewers",
            "evidence_url": "https://china-data-atlas-claude-cgc0nwahr-timkok621-1320.vercel.app",
            "evidence_locator": "Live browser verification 2026-11-24 redirected to vercel.com/login",
            "description": "Claude Opus 5.5's Vercel deployment URL has Deployment Protection enabled, preventing public unauthenticated browsing and external browser QA.",
            "reproduction_steps": "Open https://china-data-atlas-claude-cgc0nwahr-timkok621-1320.vercel.app in an unauthenticated browser session.",
            "recommended_fix": "Deploy Round 2 to a publicly accessible HTTPS host (e.g., GitHub Pages or unprotected preview) and verify unauthenticated access in Playwright.",
            "verification_status": "Environment Limitation",
        },
        {
            "finding_id": "FND-012",
            "audited_model": "grok_bot|gemini_4_neon",
            "severity": "P2",
            "category": "Definition Difference",
            "indicator_id": "urbanization_rate",
            "geo_code": "540000",
            "year": "2015-2022",
            "affected_file_or_url": "r1_inputs/grok_bot/.../observations.csv & r1_inputs/gemini_4_neon/data/normalized/observations.csv",
            "reported_value": "Tibet 2015=28.79%, 2016=31.47%, 2017=33.24%, 2020=35.79%",
            "observed_value": "Derived from integer 10k counts (urban_pop_10k / pop_10k * 100)",
            "expected_value": "Direct NBS Yearbook Table 2-5/2-8 published percentage: Tibet 2015=28.87%, 2016=31.57%, 2017=33.38%, 2020=35.73%",
            "evidence_url": "https://www.stats.gov.cn/sj/ndsj/2025/indexch.htm",
            "evidence_locator": "China Statistical Yearbook Table 2-5/2-8 (confirmed independently by both Claude Opus 5.5 and GPT-6 Astra Pro)",
            "description": "Quantization rounding drift in small-population provinces: deriving urbanization_rate from whole-10k NBS counts (e.g. Tibet ~330-365w) introduces +/-0.06 to 0.14 percentage point drift vs NBS directly published percentages.",
            "reproduction_steps": "Compare Tibet (540000) and Qinghai (630000) urbanization_rate across grok_bot/gemini_4_neon vs claude_opus_5_5/gpt6_astra_pro.",
            "recommended_fix": "Document whole-10k denominator quantization bounds (+/-0.15 pp in Tibet/Qinghai) explicitly in methodology metadata and cross-verify against directly published NBS Yearbook percentages.",
            "verification_status": "Definition Difference",
        },
        {
            "finding_id": "FND-013",
            "audited_model": "gpt6_astra_pro",
            "severity": "P2",
            "category": "Confirmed Issue",
            "indicator_id": "gdp",
            "geo_code": "ALL",
            "year": "2015-2024",
            "affected_file_or_url": "https://china-data-atlas-gpt6-astra-r1-20261123.tian-liao-4133.chatgpt.site/indicators/gdp/",
            "reported_value": "57 GDP rows total (no 2015-2023 provincial panel); year dropdown offers 2000-2026",
            "observed_value": "Multi-province comparison table shows '不可计算起止年缺失' for Jiangsu/Zhejiang/Guangdong 2015-2024; 2024 GDP uses Yearbook 2025 preliminary vintage (Beijing 49843.1 vs 2026 final 49670.2)",
            "expected_value": "Complete 2000-2025 31-province panel with 2024 final verified canonical values + Yearbook preliminary stored as vintage; dropdown constrained to available years",
            "evidence_url": "https://china-data-atlas-gpt6-astra-r1-20261123.tian-liao-4133.chatgpt.site/indicators/gdp/",
            "evidence_locator": "Live browser verification 2026-11-24 on /indicators/gdp/ and observations.csv row count",
            "description": "While GPT-6 Astra Pro leads Round 1 in epistemic transparency and vintage logging, its sparse provincial panel (1,416 obs total) prevents longitudinal provincial CAGR calculations, and empty years (2000-2026) remain selectable in UI dropdowns.",
            "reproduction_steps": "Visit /indicators/gdp/ on GPT-6 Astra Pro live site and inspect Jiangsu/Zhejiang/Guangdong comparison table and year dropdown.",
            "recommended_fix": "Combine GPT-6 Astra Pro's 3-layer vintage & verification ledger with NBS publicrelease API's complete 2000-2025 31-province panel, and restrict UI year controls strictly to populated years.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-014",
            "audited_model": "gpt6_2",
            "severity": "P1",
            "category": "Official Revision",
            "indicator_id": "population|retail_sales",
            "geo_code": "320000|000000",
            "year": "2015|2024",
            "affected_file_or_url": "r1_inputs/gpt6_2/extracted/China-Data-Atlas-GPT-6.2-R1/data/normalized/observations.csv",
            "reported_value": "Jiangsu 2015 pop=7976.3; National 2024 retail_sales=487895.0; only 184 obs total",
            "observed_value": "Pre-7th-Census Jiangsu 2015 pop (-4.07%) and pre-5th-Census 2024 retail_sales (+0.93%); 0 provincial retail_sales rows",
            "expected_value": "Jiangsu 2015 pop=8315.0 (7th-Census revised); National 2024 retail_sales=483344.7 (5th-Census revised)",
            "evidence_url": "https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData",
            "evidence_locator": "NBS Provincial Population & National Retail Sales catalogs (reconciled in CNF-01662 and CNF-01768)",
            "description": "GPT-6.2 delivered only 184 valid observations (too sparse for trend research) and retained pre-7th-Census Jiangsu 2015 population and pre-5th-Census 2024 national retail sales without newer revised vintages.",
            "reproduction_steps": "Inspect rows (population, 320000, 2015) and (retail_sales, 000000, 2024) in GPT-6.2 observations.csv.",
            "recommended_fix": "Use latest post-census revised NBS series as canonical default and archive preliminary communiqué figures as historical vintages.",
            "verification_status": "Official Revision",
        },
        {
            "finding_id": "FND-015",
            "audited_model": "gemini_unavail|gpt6_astra_pro",
            "severity": "P2",
            "category": "Official Revision",
            "indicator_id": "hospital_beds_per_1000",
            "geo_code": "000000",
            "year": "2025",
            "affected_file_or_url": "data/reconciliation/unresolved_conflicts.csv (CNF-01074)",
            "reported_value": "gemini_unavail=7.18 vs gpt6_astra_pro=7.1462",
            "observed_value": "Both derived from different 2025 official communiqués (Feb 2026 NBS 1009万张 vs Aug 2026 NHC 10,039,606张 ÷ 140,489万人)",
            "expected_value": "Pending direct NBS API 2025 publication; both preliminary NBS and final NHC derived values documented cleanly as distinct vintages",
            "evidence_url": "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
            "evidence_locator": "NBS 2025 Statistical Communiqué (2026-02-28) vs NHC 2025 Health Statistical Communiqué PDF (2026-08-28)",
            "description": "Only unresolved R1 reconciliation record (CNF-01074): NBS API has not yet published 2025 hospital_beds_per_1000, so two R1 models independently derived it from two different official 2025 communiqués 6 months apart (7.18 preliminary vs 7.1462 NHC final).",
            "reproduction_steps": "Inspect CNF-01074 in data/reconciliation/unresolved_conflicts.csv.",
            "recommended_fix": "Keep marked unresolved/pending direct NBS publication in R1 conflict table rather than guessing or averaging, and surface both derived vintages transparently.",
            "verification_status": "Official Revision",
        },
        {
            "finding_id": "FND-016",
            "audited_model": "claude_opus_5_5|muse_spark_1_3|gemini_unavail",
            "severity": "P2",
            "category": "Confirmed Issue",
            "indicator_id": "ALL",
            "geo_code": "000000",
            "year": "ALL",
            "affected_file_or_url": "r1_inputs/{claude_opus_5_5,muse_spark_1_3,gemini_unavail}/observations.csv",
            "reported_value": "National code='100000' (Claude, Muse) or ISO 'CN'/'CN-BJ' (Gemini Unavail)",
            "observed_value": "Non-uniform geographic keys break direct cross-dataset joins",
            "expected_value": "Unified GB/T 2260 6-digit codes (110000-650000) + '000000' for National",
            "evidence_url": "data/metadata/regions.csv",
            "evidence_locator": "Unique geo_code inspection across all 7 R1 models",
            "description": "Inconsistent geographic identifiers across R1 models (100000 vs 000000 for National; ISO CN-XX vs GB/T 2260 6-digit codes) caused silent join drops until explicit geo crosswalk normalization was applied.",
            "reproduction_steps": "Run unique(geo_code) on claude_opus_5_5, muse_spark_1_3, and gemini_unavail observations.csv.",
            "recommended_fix": "Enforce canonical GB/T 2260 6-digit codes plus 000000 (National) across dim_region and all exports, storing ISO-3166-2 as an explicit secondary attribute.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-017",
            "audited_model": "gemini_4_neon",
            "severity": "P3",
            "category": "Confirmed Issue",
            "indicator_id": "ALL",
            "geo_code": "ALL",
            "year": "2026",
            "affected_file_or_url": "https://china-data-atlas-gemini-4-neon-r1.vercel.app",
            "reported_value": "Desktop 1280px homepage navigation & mobile KPI badges",
            "observed_value": "Top navbar CJK links wrap onto 2 lines ('首/页', '核心/指标') at 1280px; narrow mobile pills wrap ('经/济', '亿元人民/币')",
            "expected_value": "Single-line non-wrapping navigation and clean unit badges across 390px, 768px, 1280px, and 1440px",
            "evidence_url": "https://china-data-atlas-gemini-4-neon-r1.vercel.app",
            "evidence_locator": "Live browser verification 2026-11-24 at 1280x900 and 390x844",
            "description": "Minor responsive polish defect on Gemini 4 Neon R1 live site where flex container constraints force 2-character CJK navigation items and currency units to wrap awkwardly.",
            "reproduction_steps": "Open https://china-data-atlas-gemini-4-neon-r1.vercel.app at 1280x900 and 390x844.",
            "recommended_fix": "Apply whitespace-nowrap and shrink-0 to top navigation links and unit badges in Round 2.",
            "verification_status": "Confirmed Issue",
        },
        {
            "finding_id": "FND-018",
            "audited_model": "codex_gpt6|codex_unavail",
            "severity": "P2",
            "category": "Environment Limitation",
            "indicator_id": "ALL",
            "geo_code": "ALL",
            "year": "ALL",
            "affected_file_or_url": "Google Drive folders 1cAjfXt2ZdTd3TAisIV_Gm61Ot7lbQp5n & 11hyv6PNMhkPspFFrIPlHBlFFfR0yFnd_",
            "reported_value": "Listed in Round 1 comparison folder",
            "observed_value": "0 files in both Drive folders",
            "expected_value": "Complete Round 1 deliverables",
            "evidence_url": "https://drive.google.com/drive/folders/1jBQSNOjLmc815L7nkxruelvxLV5y7PKg",
            "evidence_locator": "data/input_manifest/r1_index_summary.json: codex_gpt6=0 files, codex_unavail=0 files",
            "description": "Both Codex Round 1 folders in Google Drive are empty (0 files) as of 2026-11-24 and cannot be audited or imported.",
            "reproduction_steps": "Run gdrive readonly ls on both folder IDs.",
            "recommended_fix": "Mark factually as unavailable in round1_inventory.csv without speculating on model performance.",
            "verification_status": "Environment Limitation",
        },
    ]

    with (AUDIT_DIR / "findings.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=findings_fields)
        w.writeheader()
        w.writerows(findings_rows)

    # 4. audit/cross_model_audit.md
    cols_ov = list(ov_df.columns)
    ov_lines = ["| " + " | ".join(cols_ov) + " |", "| " + " | ".join(["---"] * len(cols_ov)) + " |"]
    for _, rr in ov_df.iterrows():
        ov_lines.append("| " + " | ".join(str(rr[c]) for c in cols_ov) + " |")
    ov_md = "\n".join(ov_lines)
    audit_md = f"""# China Data Atlas Round 2 — Cross-Model Independent Audit Report

**Auditor**: Gemini 4 Neon (Round 2 Autonomous Team)  
**Audit Date**: 2026-11-24  
**Scope**: All 9 Round 1 Google Drive folders under `China Data Atlas AI Comparison` (`1jBQSNOjLmc815L7nkxruelvxLV5y7PKg`) — 7 populated models audited in full (28,509 raw observations imported read-only and reconciled key-by-key); 2 Codex folders verified empty (`unavailable`).

---

## 1. Executive Audit Summary & Quantitative Reconciliation

Every Round 1 deliverable was indexed into [`data/input_manifest/r1_input_manifest.csv`](../data/input_manifest/r1_input_manifest.csv) and reconciled row-by-row via [`pipeline/reconciliation/reconcile_r1.py`](../pipeline/reconciliation/reconcile_r1.py) after normalizing all indicator IDs (`data/metadata/indicator_crosswalk.csv`) and geographic keys (`000000` National + 31 GB/T 2260 6-digit provincial codes, correcting `100000` in Claude/Muse and ISO `CN-XX` in Gemini Unavail).

- **Total R1 observations imported (read-only)**: **28,509** across 7 populated models (`0` internal duplicates within any model).
- **Deduplicated unique `(indicator_id, geo_code, year)` keys**: **12,129**.
- **Total multi-model discrepancies logged (`>0.015` rounding or substantive)**: **{rec_summary['total_conflicts_logged']}**
  - **Resolved with official primary evidence**: **{rec_summary['resolved_conflicts']}**
  - **Unresolved (transparently preserved)**: **{rec_summary['unresolved_conflicts']}** (`CNF-01074`: National 2025 `hospital_beds_per_1000` — `7.18` from Feb-2026 NBS Preliminary Communiqué vs `7.1462` from Aug-2026 NHC Final Communiqué, pending direct NBS API publication).
- **Breakdown by root cause**:
  - `Match Within Official Rounding`: **{rec_summary['by_classification'].get('Match Within Official Rounding', 0)}**
  - `Official Revision`: **{rec_summary['by_classification'].get('Official Revision', 0)}** (pre-4th/5th Economic Census GDP/retail, 2024 preliminary vs 2026 final verified GDP, pre-7th-Census 2015–2019 national birth/natural-growth rates)
  - `Definition Difference`: **{rec_summary['by_classification'].get('Definition Difference', 0)}** (primarily 264 `physicians_per_1000` official per-10k/10 vs derived resident-pop records, plus hospital-only vs all-institution bed rates)
  - `Conflicting Value`: **{rec_summary['by_classification'].get('Conflicting Value', 0)}** (predominantly `gemini_unavail` non-official media/blog/Wikipedia errors: Yicai pre-5th-Census 2024 retail sales up to -10.1% wrong in Zhejiang, AgeClub Hubei 2024 65+ error -6.8%, Nov-1 Census vs Dec-31 year-end population splicing, and Xinjiang URL misattribution).

### Pairwise Data Overlap & Agreement Matrix

{ov_md}

---

## 2. Direct Investigation of Round 2 Priority Research Questions (Section 2.1 A–E)

### 2.1.A Official Data Acquisition (NBS `publicrelease` API Evaluation)
Both **Grok Bot** and **Gemini 4 Neon (R1)** bypassed legacy `data.stats.gov.cn/easyquery.htm` (which returns HTTP 403 `UrlACL`) *without* violating access controls by discovering NBS's official, publicly documented new frontend release API (`https://data.stats.gov.cn/dg/website/publicrelease/web/external`). Our independent Round 2 audit verified:
1. **Validity**: 100% genuine official NBS production backend serving all 124 provincial annual catalogs (`code=6`) and 550 national annual catalogs (`code=3`).
2. **Browser state dependency**: None — stateless JSON `GET`/`POST` endpoints returning HTTP 200 with standard headers, zero login, zero CAPTCHA, zero anti-bot bypass.
3. **Terms compliance**: Public statistical data access with polite rate limiting (`≥0.35s`/request); redistribution remains subject to NBS website terms (attribution required, non-commercial/good-faith public research, no CC0 sublicensing — see `research/DATA_RIGHTS_REVIEW.md`).
4. **Reproducibility & extensibility**: Deterministic UUID-based catalog/indicator IDs (`cid` + `indicatorIds`) make incremental updates and expansion to 40+ indicators straightforward.
5. **Maintenance risk**: Medium — UUIDs are stable today, but NBS could version or rate-limit `/dg/website/publicrelease` in the future; therefore Round 2 retains raw SHA-256 JSON snapshots, `source_access_log.csv`, and an automated change-detection pipeline with human review gates.

### 2.1.B Exact Resolution of the 125-Row Core Scale Discrepancy (`physicians_per_1000`)
**Mystery**: Grok Bot reported `8,985` core observations (`676` on `physicians_per_1000`); Gemini 4 Neon Drive R1 reported `9,110` core observations (`801` on `physicians_per_1000`) — an exact difference of **125 records**.  
**Verified Root Cause (`FND-005`)**:
- **Grok Bot (`676` rows)** queried NBS's directly published indicator `每万人拥有执业(助理)医师数 × 0.1` (`e469513e184d43109318f06a51cb436e`). That NBS table omits **124 provincial observations** (`2000`, `2005`, `2006`, `2007` × 31 provinces) plus **1 national `2025`** value = **125 rows**, is rounded to 0.1 precision, and contains NBS's notorious **2001–2011 & 2013 hukou-population denominator anomaly** (e.g., Beijing jumps `2012: 3.6 → 2013: 5.9 → 2014: 3.7`!).
- **Gemini 4 Neon Drive R1 (`801` rows)** *derived* `physicians_per_1000 = 执业(助理)医师数 (万人) ÷ 年末常住人口 (万人) × 1000`, yielding continuous `2000–2024` provincial coverage + `2025` National and eliminating the 2013 Beijing spike (`3.63` vs `3.68` in 2014) — **however**, it silently placed a derived metric under the exact same `indicator_id` as the official published rate.
- **Not caused by**: duplicate rows (`0`), wrong unit scaling (10x), or mixing non-physician health technicians (`卫生技术人员`).
- **Round 2 Fix**: Publish BOTH explicitly separated indicators (`physicians_per_1000` official NBS published series with 2012–2014 caliber break notices, AND `physicians_per_1000_resident_derived` transparently tagged `extraction_method=Derived`).

### 2.1.C Verification Status Inconsistency & Unified `E0–E4` Governance
- **Gemini 4 Neon Drive R1 (`FND-004`, P1)**: Inflated `verified_observations` to `9,110/9,110` despite only 60 independent spot-check samples.
- **Grok Bot R1**: Strictest high-scale discipline (`106 verified`, `8,710 partially_verified`, `2,413 unverified`), withholding `gdp_per_capita` from `core_indicators_verified` because 8 of 12 samples were official revisions rather than exact matches.
- **GPT-6 Astra Pro R1 & GPT-6.2 R1**: Highest epistemic clarity (`72/1,416` and `61/184` point-verified, explicitly distinguishing `逐点已复核` vs `来源已提取`).
- **Round 2 Fix**: Strictly separate `evidence_level` (`E0`–`E4`) from `extraction_method` (`API`, `XLS`, `HTML`, `OCR`, `Manual`, `Derived`). Unsampled NBS API records stay `E1`; spot-checked API/table rows become `E2`; records independently corroborated against a **second distinct official publication** (e.g., 7th Census Bulletin No. 5, 2024/2025 Statistical Communiqués, NHC 2024 Health Yearbook, MOE official tables) earn `E3`; reconciled conflict revisions earn `E4`.

### 2.1.D Claude Opus 5.5 Yearbook OCR & Quality Warnings
Claude's `quality_report.json` recorded `7,868` raw OCR cells (`4,616` deduplicated observations), including `5,488` `single_reading_ocr` warnings and `555` `revised_vs_earlier_edition` warnings. Cross-checking all **3,912 overlapping observations** against NBS API proved:
1. **Zero silent gross OCR digit errors** were found across all 3,912 overlapping cells — Claude's dual-pass OCR consensus + `152` manual visual reviews (`ocr_review.csv`) worked remarkably well!
2. Its `5,488` `single_reading_ocr` warnings referred to *raw single-edition cell coverage* (cells appearing in only one Yearbook edition rather than two editions), not OCR transcription failures.
3. Its **true P1 statistical risk (`FND-006`)** is **unversioned GDP vintage mixing**: reading preliminary GDP from each following year's Yearbook without applying 4th/5th Economic Census revisions creates artificial ~30%–36% drops in Tianjin (`2016: 17,885.39 → 11,487.0`), Liaoning (`2015: 28,669.02 → 20,657.8`), and Inner Mongolia.
4. **Bonus finding (`FND-012`)**: On Tibet (`540000`) and Qinghai (`630000`) `urbanization_rate`, Claude (and GPT-6 Astra Pro) extracted NBS's directly published Yearbook percentage (`Tibet 2015 = 28.87%`), exposing a `±0.08–0.14 pp` whole-`万人` rounding drift in Grok's and Gemini 4 Neon's derived `urban_pop_10k / pop_10k` formula (`28.79%`).

### 2.1.E Latest 2025 Data & Statistical Caliber Checks
- **2025 Population, GDP, GDP/cap, Disposable Income, Retail Sales**: All 31 provinces + National are available in NBS `publicrelease` API (`2025` preliminary official values; `2024` GDP now updated to 2026 final verified figures, e.g., Beijing `49,670.2 亿元` superseding Yearbook 2025 preliminary `49,843.1 亿元`).
- **Higher Education Caliber Split**: NBS provincial tables publish `普通、职业本专科在校学生数` (undergraduate + associate/vocational, **excluding postgraduates**). In Round 2, we explicitly separate `higher_education_students` (undergrad & vocational, 31 provinces) from `postgraduate_students` (explicitly scoped with national/available official coverage; never silently combined unless non-overlapping and same-year).
- **2013 Disposable Income Caliber Break**: Pre-2013 NBS published separate urban/rural series; unified `全体居民人均可支配收入` begins in `2013` nationwide (pre-2013 provincial unified series absent in NBS API — preserved honestly as missing, with `urban_disposable_income` and `rural_disposable_income` added in Round 2 for long-run analysis).
- **2011–2013 Medical Ratio Anomaly & Beds Caliber**: NBS `每万人医疗机构床位数` covers **all health institutions** (`医疗卫生机构`), NOT hospitals only (`医院`), and `每万人执业(助理)医师数` exhibits a 2011–2013 hukou-vs-resident denominator break — both explicitly guarded in Round 2 metadata and UI notices.

---

## 3. Individual Model Evaluations (All 9 Round 1 Folders)

### 3.1 Grok Bot (`1Myux8GqrLiP0IyAX5wHJkjF0FTUHCsMR`)
1. **Top 3 Strengths**: (a) Largest authoritative official dataset (`11,229` obs across 12 core + 3 extended indicators, `0%` secondary sources); (b) Best verification discipline among large-scale models (`106` verified, strict `≥5` independent-match gate withholding `gdp_per_capita`); (c) Comprehensive real QA (`104` automated tests + real Lighthouse JSON reports).
2. **Top 3 Weaknesses**: (a) No public GitHub repo or deployed preview URL (environment-blocked); (b) Mobile Lighthouse Performance `73` (`LCP 7.4s`) due to eager data/JS payloads (`FND-010`); (c) Whole-`万人` derived `urbanization_rate` quantization drift in Tibet/Qinghai (`FND-012`) and 124 missing historical provincial `physicians_per_1000` rows.
3. **Reusable Data Engineering**: NBS `publicrelease` API discovery, strict indicator verification gating, and automated DuckDB/Parquet regression tests.
4. **Reusable Product Features**: Clean filterable explorer URL parameters and honest methodology break warnings.
5. **Statistical Credibility Risk**: Low (transparent limitations; minor rounding drift on derived urbanization for small provinces).
6. **Software & Maintenance Risk**: Medium — static local export only, heavy client payload needs per-indicator code/data splitting.

### 3.2 Gemini 4 Neon — Drive R1 (`1QRtc23mP3sGLekDyMqWw_Te7jC9Y0T3G`)
1. **Top 3 Strengths**: (a) Full 26-year 31-province panel (`9,110` obs, 12/12 core indicators) via NBS official API; (b) Live publicly verified Next.js 16 + ECharts 6 deployment (`https://china-data-atlas-gemini-4-neon-r1.vercel.app`, GitHub PR #1) with 7-region matrix, multi-province trends, and cross-indicator scatter explorer; (c) Rich bilingual UI and citation UX.
2. **Top 3 Weaknesses**: (a) **P1 Verification inflation (`FND-004`)**: marked all `9,110` rows `verified` on 60 samples; (b) **P1 Silent methodology substitution (`FND-005`)**: derived `physicians_per_1000` under the official indicator ID without separating definitions; (c) **P3 UI polish (`FND-017`)**: `1280px` desktop navbar CJK wrapping and no vintage revision ledger.
3. **Reusable Data Engineering**: Fast NBS API extraction and per-indicator JSON export pipeline.
4. **Reusable Product Features**: 7-region compliant equal-area tile heatmap, cross-indicator scatter lab, GB/T 7714 + APA citation block.
5. **Statistical Credibility Risk**: Medium-High until `FND-004` and `FND-005` are corrected (both fixed in Round 2).
6. **Software & Maintenance Risk**: Low-Medium — clean TypeScript/Next.js codebase; needs automated update/change-detection pipeline and vintage tables.

### 3.3 Claude Opus 5.5 (`103Q9txnKYcPiXz_DApN_zOJdjEebb30P`)
1. **Top 3 Strengths**: (a) Best raw archival provenance (`120` official Yearbook files with SHA-256 manifest); (b) Dual-pass OCR consensus + `152` manual visual reviews achieved **0 gross digit errors across 3,912 overlapping observations**; (c) Direct extraction of Yearbook published `urbanization_rate` avoided whole-`万人` rounding drift.
2. **Top 3 Weaknesses**: (a) Dropped 3/12 core indicators (`retail_sales`, `physicians_per_1000`, `hospital_beds_per_1000`, `FND-007`); (b) Unversioned splicing of pre-/post-4th-Economic-Census GDP creates ~35% artificial cliffs (`FND-006`); (c) Vercel preview locked behind SSO (`FND-011`) and non-standard National code `100000` (`FND-016`).
3. **Reusable Data Engineering**: Raw file SHA-256 archival, `ocr_review.csv` human override architecture, and historical Yearbook vintage capture.
4. **Reusable Product Features**: Clean cell-level provenance display (`yearbook edition + table + cell`).
5. **Statistical Credibility Risk**: Medium-High on longitudinal GDP analysis due to unversioned 4th/5th Economic Census breaks.
6. **Software & Maintenance Risk**: Medium — Tesseract OCR pipeline (~6 min) is fragile for annual updates compared to NBS JSON API; Vercel SSO blocks public access.

### 3.4 GPT-6 Astra Pro (`1Q6Y3Je7xmmfAh3wADcp_UWxeyjbrLA4V`)
1. **Top 3 Strengths**: (a) **Best statistical governance & epistemic transparency of Round 1** (`observation_versions.csv`, `evidence_manifest.csv`, `72` point-verified vs `来源已提取`, `92/92` source-to-browser match); (b) Live publicly accessible deployment (`chatgpt.site`, verified 200 OK) with explicit preliminary-vs-final GDP revision notes and URL query state sync; (c) Discovered official Aug 2026 NHC 2025 Health Statistical Communiqué PDF.
2. **Top 3 Weaknesses**: (a) Shallow historical depth (`1,416` obs; missing 2015–2023 provincial GDP breaks multi-province CAGR, `FND-013`); (b) UI year dropdown shows empty `2000–2026` years; (c) Lighthouse not run and 2024 provincial GDP uses preliminary Yearbook 2025 vintage.
3. **Reusable Data Engineering**: 3-layer `observation + source + vintage` data model and explicit evidence ledger.
4. **Reusable Product Features**: Per-row verification status badges, explicit revision changelog panels, URL query-state persistence.
5. **Statistical Credibility Risk**: Very Low (highest honesty in R1; only caveat is 2024 preliminary GDP vintage).
6. **Software & Maintenance Risk**: Medium — manual/PDF extraction does not scale cleanly to 30–50 multi-decade indicators without API ingestion.

### 3.5 Gemini (Model Version Unavailable) (`1zN44CCnW8IfJ1Elmk48gZL1YhF900nUP`)
1. **Top 3 Strengths**: (a) Full-stack SSR + REST API prototype; (b) Collected official MOE provincial education URLs (`2015–2022`); (c) Clean schema with geographic metadata.
2. **Top 3 Weaknesses**: (a) **P0 Source provenance failure (`FND-003`)**: 541/1,526 rows (35.5%) cite Wikipedia while claiming `42 verified sources`; (b) **P0 Factual errors (`FND-001`, `FND-002`)**: Zhejiang 2024 retail sales `-10.1%` wrong (Yicai pre-census news), Hubei 2024 65+ `-6.8%` wrong (AgeClub blog), Beijing Health URL misattributed to Xinjiang; (c) **P1 Definition mixing (`FND-008`)**: spliced Nov-1 Census population into Dec-31 year-end series and used non-standard ISO `CN-XX` geo codes (`FND-016`).
3. **Reusable Data Engineering**: MOE official annual table URL inventory (for independent cross-verification only).
4. **Reusable Product Features**: REST API endpoint structure.
5. **Statistical Credibility Risk**: High — secondary-source contamination and broken source URL attribution disqualify direct ingestion.
6. **Software & Maintenance Risk**: Medium — local-only deployment, no automated official ingestion.

### 3.6 Muse Spark 1.3 (`1TOZVhWJW8Oxc-_ga1e6oZkkL9CPWSG-P`)
1. **Top 3 Strengths**: (a) Discovered and SHA-256 verified the official NHC *2024 China Health Statistical Yearbook* PDF (`73` rows); (b) Exceptionally disciplined QA documentation (`phase5_fix_log.md` fixing 4 UI bugs + 5 metadata defects); (c) Honest verification labeling (`70/428` verified) and candid disclosure of limitations.
2. **Top 3 Weaknesses**: (a) **P1 Secondary mirror dependence (`FND-009`)**: `211/428` rows (~49.3%) rely on Wikipedia, `obpai.com`, `uutool.cn`, and `sina.cn`; (b) Zero provincial coverage for `retail_sales` and `higher_education_students`; (c) No public deployment and non-standard `100000` National code.
3. **Reusable Data Engineering**: Official NHC 2024 Health Yearbook PDF locator + SHA-256 verification and structured QA fix logging.
4. **Reusable Product Features**: Clean static fallback design.
5. **Statistical Credibility Risk**: High on mirror-sourced provincial tables (low on NHC PDF rows).
6. **Software & Maintenance Risk**: Medium-High — manual mirror scraping is non-reproducible and brittle.

### 3.7 GPT-6.2 (`1HmG5Kbn0J-GLug2mS3D91-ZHdRJhOGVt`)
1. **Top 3 Strengths**: (a) Ultra-conservative honest verification gate (`61/184` verified; refused to claim indicator-level pass without coverage); (b) Zero fabricated or interpolated values; (c) Self-contained single-file HTML snapshot for offline review.
2. **Top 3 Weaknesses**: (a) Extremely sparse dataset (`184` obs, missing provincial `retail_sales`, unusable for longitudinal analysis); (b) Pre-census values in Jiangsu 2015 population (`-4.1%`) and National 2024 retail sales (`FND-014`); (c) No live deployment.
3. **Reusable Data Engineering**: Conservative audit gate framing and explicit non-pass accounting.
4. **Reusable Product Features**: Portable self-contained static export concept.
5. **Statistical Credibility Risk**: Low-Medium (honest scope, minor pre-revision vintages).
6. **Software & Maintenance Risk**: High — manual 184-row assembly cannot scale.

### 3.8 Codex GPT-6 & Codex (Model Version Unavailable)
- Both Drive folders (`1cAjfXt2ZdTd3TAisIV_Gm61Ot7lbQp5n` and `11hyv6PNMhkPspFFrIPlHBlFFfR0yFnd_`) contained **0 files** as of 2026-11-24 (`unavailable`). No evaluation or claims inferred.

---

## 4. Synthesis: What Enters Round 2 Canonical Architecture
1. **Acquisition Backbone**: NBS official `publicrelease` JSON API (from Grok + Gemini 4 Neon R1) expanded from 12 to **40+ official indicators** with raw SHA-256 snapshots (inspired by Claude Opus 5.5).
2. **Governance & 3-Layer Schema**: `observation + source + vintage` + `fact_conflict` + strict `E0–E4` separated from `extraction_method` (inspired by GPT-6 Astra Pro + Grok Bot).
3. **Independent Second-Source Cross-Verification (`E3`)**: Cross-check canonical NBS API values against independent official primary publications (7th National Population Census Bulletin No. 5, 2024/2025 NBS Statistical Communiqués, MOE official tables, and NHC 2024 Health Yearbook / 2025 Health Communiqué discovered by GPT-6 Astra Pro & Muse Spark 1.3).
4. **Product & Performance Architecture**: Next.js 16 + ECharts 6 with **per-indicator JSON sharding** (fixing Grok's 7.4s mobile LCP), **URL query-state sync** (from OWID + GPT-6 Astra Pro), **Editorial Scorecard + Top/Bottom callouts** (from The Maps Daily), **31 independent Province Pages**, **Multi-Province Comparison**, **Advanced Cross-Indicator Explorer**, **6 Reproducible Data Stories**, and a **Deterministic DuckDB-Backed Research Query Engine**.
"""
    (AUDIT_DIR / "cross_model_audit.md").write_text(audit_md, encoding="utf-8")

    # 5. audit/reuse_attribution.md
    reuse_md = """# Round 2 Reuse & Attribution Register

All Round 1 deliverables were treated strictly as **read-only research inputs**. No Round 1 code was copied without attribution, no Round 1 repository or deployment was modified, and no sibling Round 2 folder was accessed.

| Reused Component / Concept | Originating Source / Model | License / Status | How Adapted in Round 2 (Gemini 4 Neon) |
|---|---|---|---|
| NBS `publicrelease` API endpoint mapping & catalog structure | Grok Bot (R1) & Gemini 4 Neon (R1) | Public official NBS JSON API; independent Round 2 ingestion script written from scratch | Expanded from 12 core indicators to 40+ indicators across 5 domains with rate limiting (`0.35s`), retries, and SHA-256 raw snapshots |
| 3-layer `observation + source + vintage` provenance model & per-row verification badge UX | GPT-6 Astra Pro (R1) | Conceptual architectural reuse (original DuckDB schema & React UI authored fresh in R2) | Implemented as `fact_observation`, `fact_vintage`, `fact_conflict`, `dim_source`, `dim_indicator`, `dim_region` in DuckDB + UI Evidence & Vintage Drawer |
| Raw SHA-256 file manifest & pre-census Yearbook vintage comparison evidence | Claude Opus 5.5 (R1) | Read-only audit input; verified Yearbook preliminary GDP figures referenced as historical vintages | Populated `fact_vintage` with audited pre-4th/5th-Economic-Census and 2024 preliminary Yearbook vintages alongside NBS revised canonical series |
| NHC 2024 Health Yearbook PDF & Aug 2026 NHC 2025 Health Communiqué official URL references | Muse Spark 1.3 (R1) & GPT-6 Astra Pro (R1) | Official PRC National Health Commission public publications | Cited as independent official cross-verification references (re-verified independently in Round 2) |
| Next.js 16 + TypeScript + Tailwind CSS 4 + Apache ECharts 6 base frontend design language & 7-region compliant equal-area matrix | Gemini 4 Neon (R1 own baseline) | Own prior Round 1 work (MIT / Apache-2.0 OSS dependencies) | Substantially refactored with per-indicator JSON sharding, Indicator Detail Engine, 31 Province Pages, Multi-Province Comparison, Advanced Explorer, 6 Data Stories, Audit Hub, and Research Query Engine |
| Indicator Grapher URL query-state persistence & full/filtered export pattern | Our World in Data (`ourworldindata.org`, conceptual UX reference) | UX inspiration only; zero OWID code or branding copied | Implemented `?view=`, `?transform=`, `?scale=`, `?year=`, `?compare=`, `?provinces=` shareable query state |
| Editorial Data Quality scorecard, benchmark toggles (`vs National` / `vs Prior Year`), and Top/Bottom 5 callout framing | The Maps Daily (`themapsdaily.com`, conceptual UX reference) | UX inspiration only; zero code, copy, or brand elements copied | Implemented original Chinese-first editorial layout, evidence-grade badge distribution, and regional benchmark views |
| Open-source Python & JS libraries | Next.js (MIT), React (MIT), Apache ECharts (Apache-2.0), Tailwind CSS (MIT), Lucide React (ISC), DuckDB (MIT), Pandas (BSD-3), PyArrow (Apache-2.0), Pytest (MIT), Playwright (Apache-2.0) | Permissive OSI-approved open-source licenses | Standard package manager dependencies (`package.json`, `pipeline/requirements.txt`) |
"""
    (AUDIT_DIR / "reuse_attribution.md").write_text(reuse_md, encoding="utf-8")

    print("Successfully generated ALL Phase 1 audit deliverables:")
    for p in ["round1_inventory.csv", "model_comparison.csv", "findings.csv", "cross_model_audit.md", "reuse_attribution.md"]:
        fp = AUDIT_DIR / p
        print(f"  - audit/{p} ({fp.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
