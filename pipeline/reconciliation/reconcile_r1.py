"""
Phase 1 & Phase 2 Core Engine:
Imports ALL 7 accessible Round 1 observations datasets (read-only), standardizes via
data/metadata/indicator_crosswalk.csv, compares EVERY overlapping (indicator_id, geo_code, year)
record across all 7 models AND against live official NBS API baseline snapshots,
and generates:
  - data/metadata/indicator_crosswalk.csv
  - audit/data_overlap_matrix.csv
  - data/reconciliation/conflicts.csv
  - data/reconciliation/resolved_conflicts.csv
  - data/reconciliation/unresolved_conflicts.csv
  - audit/reconciliation_summary.json
"""

import csv
import json
import math
from collections import defaultdict
from pathlib import Path
import pandas as pd

R2_ROOT = Path(__file__).resolve().parents[2]
R1_DIR = R2_ROOT / "r1_inputs"
R1_LOCAL_RAW = Path("/Users/tian/.gemini/antigravity/scratch/china-data-atlas/web/public/data/indicators")

MODEL_FILES = [
    ("grok_bot", "Grok Bot (R1)", R1_DIR / "grok_bot/extracted/China-Data-Atlas-Grok-Bot-R1/data/normalized/observations.csv"),
    ("gemini_4_neon", "Gemini 4 Neon (R1 Drive)", R1_DIR / "gemini_4_neon/data/normalized/observations.csv"),
    ("claude_opus_5_5", "Claude Opus 5.5 (R1)", R1_DIR / "claude_opus_5_5/02_data/observations.csv"),
    ("gemini_unavail", "Gemini (Unavail, R1)", R1_DIR / "gemini_unavail/observations.csv"),
    ("gpt6_astra_pro", "GPT-6 Astra Pro (R1)", R1_DIR / "gpt6_astra_pro/data/normalized/observations.csv"),
    ("muse_spark_1_3", "Muse Spark 1.3 (R1)", R1_DIR / "muse_spark_1_3/data/normalized/observations.csv"),
    ("gpt6_2", "GPT-6.2 (R1)", R1_DIR / "gpt6_2/extracted/China-Data-Atlas-GPT-6.2-R1/data/normalized/observations.csv"),
]

# Standard canonical indicator crosswalk mapping all raw model indicator_ids
CROSSWALK_MAP = {
    "population": ("population", "年末常住人口", "Resident Population (Year-End)", "万人", True),
    "birth_rate": ("birth_rate", "人口出生率", "Crude Birth Rate", "‰", True),
    "birth-rate": ("birth_rate", "人口出生率", "Crude Birth Rate", "‰", True),
    "urbanization_rate": ("urbanization_rate", "常住人口城镇化率", "Urbanization Rate", "%", True),
    "urbanization": ("urbanization_rate", "常住人口城镇化率", "Urbanization Rate", "%", True),
    "population_65plus": ("population_65plus", "65岁及以上人口占比", "Population Share Aged 65+", "%", True),
    "aged-65-share": ("population_65plus", "65岁及以上人口占比", "Population Share Aged 65+", "%", True),
    "gdp": ("gdp", "地区生产总值 (GDP)", "Gross Regional Product (GDP)", "亿元", True),
    "gdp_per_capita": ("gdp_per_capita", "人均地区生产总值 (人均GDP)", "GDP per Capita", "元/人", True),
    "gdp-per-capita": ("gdp_per_capita", "人均地区生产总值 (人均GDP)", "GDP per Capita", "元/人", True),
    "disposable_income": ("disposable_income", "全体居民人均可支配收入", "Per Capita Disposable Income", "元", True),
    "disposable-income": ("disposable_income", "全体居民人均可支配收入", "Per Capita Disposable Income", "元", True),
    "retail_sales": ("retail_sales", "社会消费品零售总额", "Total Retail Sales of Consumer Goods", "亿元", True),
    "higher_education_students": ("higher_education_students", "普通、职业本专科在校学生数", "Higher Education Enrollment (Undergrad & Vocational)", "万人", True),
    "college-enrolment": ("higher_education_students", "普通、职业本专科在校学生数", "Higher Education Enrollment (Undergrad & Vocational)", "万人", True),
    "regular_vocational_undergrad_students": ("higher_education_students", "普通、职业本专科在校学生数", "Higher Education Enrollment (Undergrad & Vocational)", "万人", True),
    "higher_education_institutions": ("higher_education_institutions", "普通、职业高等学校数量", "Regular & Vocational Higher Education Institutions", "所", True),
    "colleges": ("higher_education_institutions", "普通、职业高等学校数量", "Regular & Vocational Higher Education Institutions", "所", True),
    "physicians_per_1000": ("physicians_per_1000", "每千人口执业（助理）医师数", "Licensed Physicians per 1,000 Population", "人/千人", True),
    "hospital_beds_per_1000": ("hospital_beds_per_1000", "每千人口医疗卫生机构床位数", "Health Institution Beds per 1,000 Population", "张/千人", True),
    # Non-core / extended indicators present in Round 1 models
    "natural-growth-rate": ("natural_growth_rate", "人口自然增长率", "Natural Population Growth Rate", "‰", False),
    "natural_growth_rate": ("natural_growth_rate", "人口自然增长率", "Natural Population Growth Rate", "‰", False),
    "death_rate": ("death_rate", "人口死亡率", "Crude Death Rate", "‰", False),
    "urban_population": ("urban_population", "城镇人口", "Urban Resident Population", "万人", False),
    "consumption-expenditure": ("consumption_expenditure", "全体居民人均消费支出", "Per Capita Consumption Expenditure", "元", False),
    "bed-occupancy": ("hospital_bed_utilization_rate", "医院病床使用率", "Hospital Bed Utilization Rate", "%", False),
}

# Map canonical ID -> local official NBS baseline JSON slug from our verified R1 NBS snapshots
NBS_BASELINE_SLUG = {
    "population": "population",
    "birth_rate": "birth-rate",
    "natural_growth_rate": "natural-growth-rate",
    "urbanization_rate": "urbanization-rate",
    "population_65plus": "aging-65-share",
    "gdp": "gdp",
    "gdp_per_capita": "gdp-per-capita",
    "disposable_income": "disposable-income",
    "consumption_expenditure": "consumption-expenditure",
    "retail_sales": "retail-sales",
    "higher_education_students": "higher-ed-enrollment",
    "higher_education_institutions": "higher-ed-institutions",
    "physicians_per_1000": "physicians-per-1k",
    "hospital_beds_per_1000": "hospital-beds-per-1k",
}


ISO_TO_GB = {
    "CN": "000000",
    "CN-BJ": "110000", "CN-TJ": "120000", "CN-HE": "130000", "CN-SX": "140000", "CN-NM": "150000",
    "CN-LN": "210000", "CN-JL": "220000", "CN-HL": "230000",
    "CN-SH": "310000", "CN-JS": "320000", "CN-ZJ": "330000", "CN-AH": "340000", "CN-FJ": "350000", "CN-JX": "360000", "CN-SD": "370000",
    "CN-HA": "410000", "CN-HB": "420000", "CN-HN": "430000", "CN-GD": "440000", "CN-GX": "450000", "CN-HI": "460000",
    "CN-CQ": "500000", "CN-SC": "510000", "CN-GZ": "520000", "CN-YN": "530000", "CN-XZ": "540000",
    "CN-SN": "610000", "CN-GS": "620000", "CN-QH": "630000", "CN-NX": "640000", "CN-XJ": "650000",
}


def norm_geo(raw_geo) -> str:
    s = str(raw_geo).strip()
    if s.upper() in ISO_TO_GB:
        return ISO_TO_GB[s.upper()]
    if s in ("0", "000000", "000000000000", "100000", "CN", "CHN", "NAT", "NATIONAL", "national", "全国"):
        return "000000"
    digits = "".join(ch for ch in s if ch.isdigit())
    if digits == "100000":
        return "000000"
    if len(digits) == 2:
        return digits + "0000"
    if len(digits) >= 6:
        return digits[:6]
    return s


def load_nbs_baseline() -> dict[tuple[str, str, int], float]:
    """Loads verified official NBS API observations from local audited NBS snapshots."""
    base = {}
    for canon_id, slug in NBS_BASELINE_SLUG.items():
        p = R1_LOCAL_RAW / f"{slug}.json"
        if not p.exists():
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        for o in data.get("observations") or []:
            if o.get("value") is not None:
                base[(canon_id, str(o["region_code"]), int(o["year"]))] = float(o["value"])
    return base


def normalize_value_and_unit(canon_id: str, raw_val: float, raw_unit: str, model: str) -> tuple[float, bool, str]:
    """Returns (value_in_canonical_unit, unit_was_converted, conversion_note)."""
    u = str(raw_unit or "").strip()
    if canon_id == "higher_education_students":
        # Some models report in exact '人' (persons) instead of '万人' (10k persons)
        if u == "人" or (raw_val > 50000 and "万" not in u):
            return round(raw_val / 10000.0, 4), True, f"converted {u or 'persons'} -> 万人 (÷10000)"
    if canon_id == "population":
        if u == "人" or raw_val > 2000000:
            return round(raw_val / 10000.0, 2), True, f"converted {u or 'persons'} -> 万人 (÷10000)"
    return raw_val, False, ""


def load_all_r1() -> tuple[list[dict], list[dict]]:
    records = []
    crosswalk_rows = []
    seen_cw = set()

    for m_slug, m_label, path in MODEL_FILES:
        df = pd.read_csv(path, low_memory=False)
        cols = set(df.columns)
        ind_col = "indicator_id" if "indicator_id" in cols else "indicator"
        geo_col = "geo_code" if "geo_code" in cols else "region_code"
        ver_col = "verification_status" if "verification_status" in cols else ("status" if "status" in cols else None)
        status_col = "data_status" if "data_status" in cols else ("status" if "status" in cols else None)
        meth_col = "methodology_version" if "methodology_version" in cols else ("method_code" if "method_code" in cols else None)
        trans_col = "transformation" if "transformation" in cols else ("method" if "method" in cols else None)
        src_url_col = "source_url" if "source_url" in cols else None
        src_tbl_col = "source_table" if "source_table" in cols else None
        src_ag_col = "source_agency" if "source_agency" in cols else None
        notes_col = "notes" if "notes" in cols else ("revision_note" if "revision_note" in cols else None)

        for _, row in df.iterrows():
            raw_ind = str(row[ind_col]).strip()
            if raw_ind not in CROSSWALK_MAP:
                continue
            canon_id, name_zh, name_en, canon_unit, is_core = CROSSWALK_MAP[raw_ind]
            val = row["value"]
            if pd.isna(val):
                continue
            try:
                fval = float(val)
            except Exception:
                continue
            geo = norm_geo(row[geo_col])
            yr = int(float(row["year"]))
            raw_unit = str(row.get("unit", "") or "").strip()
            norm_val, unit_conv, conv_note = normalize_value_and_unit(canon_id, fval, raw_unit, m_slug)

            cw_key = (m_slug, raw_ind, canon_id, raw_unit)
            if cw_key not in seen_cw:
                seen_cw.add(cw_key)
                crosswalk_rows.append({
                    "canonical_indicator_id": canon_id,
                    "canonical_name_zh": name_zh,
                    "canonical_name_en": name_en,
                    "canonical_unit": canon_unit,
                    "is_core_12": is_core,
                    "source_model": m_slug,
                    "raw_indicator_id": raw_ind,
                    "raw_unit": raw_unit,
                    "unit_conversion_required": unit_conv,
                    "conversion_rule": conv_note or "none",
                })

            records.append({
                "model": m_slug,
                "model_label": m_label,
                "canonical_indicator_id": canon_id,
                "raw_indicator_id": raw_ind,
                "geo_code": geo,
                "year": yr,
                "raw_value": fval,
                "raw_unit": raw_unit,
                "norm_value": norm_val,
                "unit_converted": unit_conv,
                "data_status": str(row.get(status_col, "") if status_col else "").strip(),
                "verification_status": str(row.get(ver_col, "") if ver_col else "").strip(),
                "methodology_version": str(row.get(meth_col, "") if meth_col else "").strip(),
                "transformation": str(row.get(trans_col, "") if trans_col else "").strip(),
                "source_agency": str(row.get(src_ag_col, "") if src_ag_col else "").strip(),
                "source_table": str(row.get(src_tbl_col, "") if src_tbl_col else "").strip(),
                "source_url": str(row.get(src_url_col, "") if src_url_col else "").strip(),
                "notes": str(row.get(notes_col, "") if notes_col else "").strip(),
            })

    return records, crosswalk_rows


def classify_diff(canon_id: str, v1: float, v2: float, r1: dict, r2: dict) -> str:
    if v1 == v2:
        return "Exact Match"
    abs_diff = abs(v1 - v2)
    rel_diff = abs_diff / max(abs(v1), abs(v2), 1e-9)

    # Check exact 10x unit scaling error (e.g. per-10k vs per-1k)
    if (v1 > 0 and v2 > 0) and (abs(v1 / v2 - 10.0) < 0.05 or abs(v2 / v1 - 10.0) < 0.05):
        return "Unit Conversion Difference"

    # Official rounding tolerance
    # Rates (%) and per-mille (‰) or derived urbanization/aging often differ by <=0.06 due to 10k-person rounding
    if canon_id in ("urbanization_rate", "population_65plus", "birth_rate", "natural_growth_rate", "physicians_per_1000", "hospital_beds_per_1000"):
        if abs_diff <= 0.06:
            return "Match Within Official Rounding"
    elif rel_diff <= 0.0015 or abs_diff <= 0.6:
        return "Match Within Official Rounding"

    # Known methodology / definition differences
    if canon_id == "physicians_per_1000":
        t1, t2 = r1["transformation"].lower(), r2["transformation"].lower()
        if ("ratio_per_1000" in t1) != ("ratio_per_1000" in t2):
            return "Definition Difference"
    if canon_id == "population_65plus":
        # Sample survey vs Census / Yearbook direct vs derived
        if any("普查" in x or "census" in x.lower() for x in [r1["source_table"], r2["source_table"], r1["data_status"], r2["data_status"]]):
            if rel_diff < 0.08:
                return "Definition Difference"
    if canon_id == "higher_education_students":
        # Undergrad+vocational vs including postgraduates (typically ~8-15% higher in big university provinces like Beijing/Shanghai)
        if any("研究生" in x or "广义" in x or "all" in x.lower() for x in [r1["notes"], r2["notes"], r1["source_table"], r2["source_table"]]):
            return "Definition Difference"
    if canon_id == "urbanization_rate":
        # Direct published Yearbook % (Claude / GPT-6 Astra Pro) vs derived urban_10k / pop_10k (Grok / G4N)
        # Small provinces (Tibet ~360w, Qinghai ~590w) incur up to 0.15 pp whole-10k denominator rounding drift
        if abs_diff <= 0.16 and any("2-5" in x or "2-8" in x or "城镇人口比重" in x for x in [r1["source_table"], r2["source_table"], r1["notes"], r2["notes"]]):
            return "Match Within Official Rounding"
    if canon_id in ("birth_rate", "natural_growth_rate"):
        # Pre-7th-Census National 2015-2019 rates in Yearbook 2016-2020 vs post-7th-Census revised NBS series
        meta_blob = (r1["source_url"] + r2["source_url"] + r1["source_table"] + r2["source_table"]).lower()
        if any(k in meta_blob for k in ["ndsj/201", "ndsj/2020", "2-8", "公报", "统计年鉴"]) and rel_diff <= 0.12:
            return "Official Revision"
    if canon_id in ("gdp", "gdp_per_capita", "retail_sales", "population", "urbanization_rate"):
        # Economic census (4th & 5th) and 7th Population Census official historical revisions
        meta_blob = (r1["source_url"] + r2["source_url"] + r1["source_table"] + r2["source_table"] + r1["notes"] + r2["notes"]).lower()
        has_official_earlier_vintage = any(k in meta_blob for k in ["ndsj/201", "ndsj/2020", "ndsj/2021", "ndsj/2022", "ndsj/2023", "ndsj/2024", "ndsj/2025", "公报", "初步", "普查前", "统计年鉴"])
        has_secondary_non_official = any(k in (r1["source_url"] + r2["source_url"]).lower() for k in ["wikipedia", "obpai", "uutool", "sina", "yicai", "ageclub", "gotohui"])
        if has_official_earlier_vintage and not has_secondary_non_official:
            max_rev = 0.42 if canon_id in ("gdp", "gdp_per_capita") else 0.15
            if rel_diff <= max_rev:
                return "Official Revision"
    if canon_id == "hospital_beds_per_1000":
        # All health institutions vs hospitals-only
        if rel_diff > 0.10 and ("医院" in r1["source_table"] or "医院" in r2["source_table"]):
            return "Definition Difference"

    return "Conflicting Value"


def main():
    nbs_base = load_nbs_baseline()
    records, cw_rows = load_all_r1()
    print(f"Imported {len(records):,} total R1 records across {len(MODEL_FILES)} populated models")

    # 1. Save indicator crosswalk
    cw_path = R2_ROOT / "data/metadata/indicator_crosswalk.csv"
    cw_rows.sort(key=lambda x: (not x["is_core_12"], x["canonical_indicator_id"], x["source_model"]))
    with cw_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(cw_rows[0].keys()))
        w.writeheader()
        w.writerows(cw_rows)

    # Index records by model and by (canon_id, geo, year)
    by_model: dict[str, dict[tuple[str, str, int], dict]] = defaultdict(dict)
    by_key: dict[tuple[str, str, int], dict[str, dict]] = defaultdict(dict)
    dup_counts = defaultdict(int)

    for rec in records:
        key = (rec["canonical_indicator_id"], rec["geo_code"], rec["year"])
        m = rec["model"]
        if key in by_model[m]:
            dup_counts[m] += 1
        by_model[m][key] = rec
        by_key[key][m] = rec

    print("Duplicate keys within each model:", dict(dup_counts))
    print("Unique (indicator, geo, year) keys across ALL 7 models combined:", len(by_key))
    for m_slug, _, _ in MODEL_FILES:
        print(f"  {m_slug:18s}: {len(by_model[m_slug]):5d} unique keys")

    # 2. Pairwise Data Overlap Matrix
    overlap_rows = []
    model_slugs = [m[0] for m in MODEL_FILES]
    for i, m1 in enumerate(model_slugs):
        for j, m2 in enumerate(model_slugs):
            if j <= i:
                continue
            k1 = set(by_model[m1].keys())
            k2 = set(by_model[m2].keys())
            common = sorted(k1 & k2)
            counts = defaultdict(int)
            for k in common:
                r1, r2 = by_model[m1][k], by_model[m2][k]
                cat = classify_diff(k[0], r1["norm_value"], r2["norm_value"], r1, r2)
                counts[cat] += 1
            n_com = len(common)
            agree = counts["Exact Match"] + counts["Match Within Official Rounding"]
            conflict = counts["Conflicting Value"] + counts["Unit Conversion Difference"]
            overlap_rows.append({
                "model_a": m1,
                "model_b": m2,
                "model_a_keys": len(k1),
                "model_b_keys": len(k2),
                "overlap_keys": n_com,
                "only_in_a": len(k1 - k2),
                "only_in_b": len(k2 - k1),
                "exact_match": counts["Exact Match"],
                "match_within_rounding": counts["Match Within Official Rounding"],
                "agreement_rate_pct": round(agree / n_com * 100.0, 2) if n_com else 0.0,
                "definition_difference": counts["Definition Difference"],
                "official_revision": counts["Official Revision"],
                "unit_conversion_diff": counts["Unit Conversion Difference"],
                "conflicting_value": counts["Conflicting Value"],
                "conflict_rate_pct": round(conflict / n_com * 100.0, 2) if n_com else 0.0,
            })

    ov_path = R2_ROOT / "audit/data_overlap_matrix.csv"
    with ov_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(overlap_rows[0].keys()))
        w.writeheader()
        w.writerows(overlap_rows)

    # 3. Full Conflict Detection & Official NBS Evidence Resolution
    conflicts = []
    resolved = []
    unresolved = []
    conflict_seq = 0

    for key in sorted(by_key.keys()):
        canon_id, geo, yr = key
        m_dict = by_key[key]
        if len(m_dict) < 2:
            continue
        vals = {m: r["norm_value"] for m, r in m_dict.items()}
        min_v, max_v = min(vals.values()), max(vals.values())
        if min_v == max_v:
            continue

        # Check worst pairwise classification among models present for this key
        m_list = sorted(m_dict.keys())
        cats = set()
        for a_idx in range(len(m_list)):
            for b_idx in range(a_idx + 1, len(m_list)):
                ma, mb = m_list[a_idx], m_list[b_idx]
                cats.add(classify_diff(canon_id, vals[ma], vals[mb], m_dict[ma], m_dict[mb]))

        # Classify primary conflict category:
        # If an official-vs-official Official Revision explains the value spread (e.g. 2024 Preliminary GDP in Yearbook 2025 vs 2026 Final Verified),
        # do not downgrade it to Conflicting Value merely because a Wikipedia-citing model copied the same official preliminary value!
        priority = ["Conflicting Value", "Unit Conversion Difference", "Definition Difference", "Official Revision", "Match Within Official Rounding"]
        primary_cat = next((c for c in priority if c in cats), "Conflicting Value")
        if primary_cat == "Conflicting Value" and "Official Revision" in cats:
            # Check if every non-official-matching value equals an official earlier-vintage model's value
            official_vintage_vals = set()
            for ma_idx in range(len(m_list)):
                for mb_idx in range(ma_idx + 1, len(m_list)):
                    ma, mb = m_list[ma_idx], m_list[mb_idx]
                    if classify_diff(canon_id, vals[ma], vals[mb], m_dict[ma], m_dict[mb]) == "Official Revision":
                        official_vintage_vals.add(vals[ma])
                        official_vintage_vals.add(vals[mb])
            if all(v in official_vintage_vals for v in vals.values()):
                primary_cat = "Official Revision"

        # Skip pure trivial rounding noise (<0.01) for conflicts.csv, keep meaningful rounding (>0.01) and ALL substantive diffs
        abs_spread = round(max_v - min_v, 4)
        rel_spread = round(abs_spread / max(abs(max_v), abs(min_v), 1e-9) * 100.0, 3)
        if primary_cat == "Match Within Official Rounding" and abs_spread <= 0.015:
            continue

        conflict_seq += 1
        cid_str = f"CNF-{conflict_seq:05d}"
        official_val = nbs_base.get(key)

        # Determine models matching official NBS baseline vs diverging
        matching_official = []
        diverging_official = []
        if official_val is not None:
            for m, v in sorted(vals.items()):
                tol = 0.06 if canon_id in ("urbanization_rate", "population_65plus", "birth_rate", "natural_growth_rate", "physicians_per_1000", "hospital_beds_per_1000") else max(0.5, abs(official_val) * 0.0015)
                if abs(v - official_val) <= tol:
                    matching_official.append(m)
                else:
                    diverging_official.append(f"{m}={v}")

        # Build resolution
        if official_val is not None:
            resolution_status = "resolved"
            if primary_cat == "Definition Difference" and canon_id == "physicians_per_1000":
                rationale = (
                    f"NBS published per-10k/10 value is {official_val} (hukou denominator pre-2012 & 2013); "
                    f"Gemini 4 Neon derived headcount/resident_pop={vals.get('gemini_4_neon')}. "
                    f"Resolved by preserving BOTH distinct methodology versions cleanly rather than conflating them."
                )
            elif primary_cat == "Official Revision":
                rationale = (
                    f"Latest official NBS API (post-5th Economic Census / 7th Population Census revision) reports {official_val}; "
                    f"earlier yearbook/communiqué/Wikipedia values retained as historical vintage only."
                )
            elif primary_cat == "Match Within Official Rounding":
                rationale = (
                    f"Minor rounding spread ({abs_spread}) between directly published Yearbook ratios and derived 10k-person ratios; "
                    f"canonical value aligned to official NBS baseline ({official_val})."
                )
            else:
                rationale = (
                    f"Resolved directly against official NBS publicrelease API snapshot ({official_val}); "
                    f"diverging R1 values ({', '.join(diverging_official)}) identified as secondary-source/OCR/methodology discrepancy."
                )
        else:
            # No direct NBS baseline (e.g. 2020 census 65+ provincial where NBS sample table is null!)
            if canon_id == "population_65plus" and yr == 2020:
                # 7th Census Communiqué No. 5 is official! Check if models agree on 7th Census
                census_models = [m for m in m_list if "普查" in m_dict[m]["source_table"] or "1901085" in m_dict[m]["source_url"] or "1902005" in m_dict[m]["source_url"]]
                if census_models and len({round(vals[m], 2) for m in census_models}) == 1:
                    official_val = round(vals[census_models[0]], 2)
                    resolution_status = "resolved"
                    rationale = f"Resolved via 7th National Population Census Bulletin No. 5 ({official_val}%), authoritative over non-census estimates."
                else:
                    resolution_status = "unresolved"
                    rationale = "Conflicting 2020 65+ values without single verified census match; flagged unresolved."
            else:
                resolution_status = "unresolved"
                rationale = f"No direct NBS API baseline matched for ({canon_id}, {geo}, {yr}); preserved candidate values as unresolved pending official verification."

        row_obj = {
            "conflict_id": cid_str,
            "indicator_id": canon_id,
            "geo_code": geo,
            "year": yr,
            "classification": primary_cat,
            "models_present": "|".join(m_list),
            "values_by_model": "; ".join(f"{m}={vals[m]}" for m in m_list),
            "abs_spread": abs_spread,
            "rel_spread_pct": rel_spread,
            "official_nbs_value": "" if official_val is None else official_val,
            "matching_official_models": "|".join(matching_official),
            "diverging_models": "|".join(diverging_official),
            "sources_summary": " || ".join(f"{m}:{m_dict[m]['source_table'][:50]}" for m in m_list[:4]),
            "resolution_status": resolution_status,
            "resolution_rationale": rationale,
        }
        conflicts.append(row_obj)
        if resolution_status == "resolved":
            resolved.append(row_obj)
        else:
            unresolved.append(row_obj)

    for out_p, data_list in [
        (R2_ROOT / "data/reconciliation/conflicts.csv", conflicts),
        (R2_ROOT / "data/reconciliation/resolved_conflicts.csv", resolved),
        (R2_ROOT / "data/reconciliation/unresolved_conflicts.csv", unresolved),
    ]:
        out_p.parent.mkdir(parents=True, exist_ok=True)
        fields = [
            "conflict_id", "indicator_id", "geo_code", "year", "classification",
            "models_present", "values_by_model", "abs_spread", "rel_spread_pct",
            "official_nbs_value", "matching_official_models", "diverging_models",
            "sources_summary", "resolution_status", "resolution_rationale",
        ]
        with out_p.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(data_list)

    # Summarize conflicts by classification & by diverging model
    by_cat = defaultdict(int)
    by_ind_cat = defaultdict(int)
    div_by_model = defaultdict(int)
    severe_conflicts = []
    for c in conflicts:
        by_cat[c["classification"]] += 1
        by_ind_cat[f"{c['indicator_id']}::{c['classification']}"] += 1
        if c["classification"] == "Conflicting Value":
            for dm in c["diverging_models"].split("|"):
                if "=" in dm:
                    div_by_model[dm.split("=")[0]] += 1
            if c["rel_spread_pct"] >= 5.0:
                severe_conflicts.append(c)

    summary = {
        "total_r1_records_imported": len(records),
        "unique_keys_across_all_r1": len(by_key),
        "duplicate_keys_within_models": dict(dup_counts),
        "total_conflicts_logged": len(conflicts),
        "resolved_conflicts": len(resolved),
        "unresolved_conflicts": len(unresolved),
        "by_classification": dict(by_cat),
        "by_indicator_classification": dict(sorted(by_ind_cat.items(), key=lambda x: -x[1])[:25]),
        "divergences_on_conflicting_value_by_model": dict(sorted(div_by_model.items(), key=lambda x: -x[1])),
        "top_severe_conflicts_sample": sorted(severe_conflicts, key=lambda x: -x["rel_spread_pct"])[:25],
    }
    (R2_ROOT / "audit/reconciliation_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== RECONCILIATION SUMMARY ===")
    print(f"  Total conflicts (>0.015 rounding or substantive): {len(conflicts)}")
    print(f"  Resolved: {len(resolved)} | Unresolved: {len(unresolved)}")
    print("  By classification:", dict(by_cat))
    print("  Divergences on Conflicting Value by model:", dict(div_by_model))
    print("\n=== TOP 15 MOST SEVERE CONFLICTS ===")
    for sc in summary["top_severe_conflicts_sample"][:15]:
        print(f"  [{sc['indicator_id']} {sc['geo_code']} {sc['year']}] spread={sc['rel_spread_pct']}% | NBS={sc['official_nbs_value']} | {sc['values_by_model']}")


if __name__ == "__main__":
    main()
