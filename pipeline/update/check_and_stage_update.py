#!/usr/bin/env python3
"""
Round 2 Automated Data Update, Change Detection, Revision Preservation & Rollback Pipeline
==========================================================================================
Key Governance Guarantees:
1. Never auto-publishes unreviewed data to production.
2. Preserves every historical revision in vintages.csv (never silently overwrites old values).
3. Blocks invalid, out-of-range, missing-field, duplicate, or E0 unverified batches cleanly.
4. Produces an auditable pending_review_report.json with exact row diffs and SHA-256 snapshots.
5. Supports deterministic byte-for-byte rollback from pre-update snapshots.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
CANON_OBS = ROOT / "data" / "canonical_candidate" / "observations.csv"
CANON_VINT = ROOT / "data" / "canonical_candidate" / "vintages.csv"
META_IND = ROOT / "data" / "metadata" / "indicators.csv"
META_REG = ROOT / "data" / "metadata" / "regions.csv"
RAW_MANIFEST = ROOT / "data" / "input_manifest" / "raw_evidence_hashes.csv"

REQUIRED_INCOMING_FIELDS = {
    "indicator_id", "geo_code", "year", "value", "unit",
    "original_value", "original_unit", "source_id", "source_table",
    "vintage_id", "evidence_level", "extraction_method",
}

RANGE_BOUNDS = {
    "urbanization_rate": (0.0, 100.0),
    "population_65plus": (0.0, 60.0),
    "population": (100.0, 200000.0),
    "gdp": (50.0, 2000000.0),
    "gdp_per_capita": (1000.0, 400000.0),
    "disposable_income": (2000.0, 150000.0),
    "physicians_per_1000": (0.2, 15.0),
    "hospital_beds_per_1000": (0.5, 20.0),
    "birth_rate": (0.0, 50.0),
}


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def validate_incoming_batch(
    incoming: list[dict[str, Any]],
    valid_inds: set[str],
    valid_geos: set[str],
    base_df: pd.DataFrame,
) -> list[str]:
    """Validate incoming batch before staging. Returns list of blocking errors."""
    errors: list[str] = []
    if not incoming:
        return ["Incoming batch is empty"]

    seen_keys: set[tuple[str, str, int]] = set()
    base_lookup = {
        (str(r["indicator_id"]), str(r["geo_code"]).zfill(6), int(r["year"])): float(r["value"])
        for _, r in base_df.iterrows()
    }

    for idx, rec in enumerate(incoming):
        missing = [k for k in REQUIRED_INCOMING_FIELDS if k not in rec or str(rec.get(k, "")).strip() == ""]
        if missing:
            errors.append(f"Row {idx}: missing required fields {sorted(missing)}")
            continue
        ind_id = str(rec["indicator_id"])
        geo6 = str(rec["geo_code"]).zfill(6)
        if ind_id not in valid_inds:
            errors.append(f"Row {idx}: unknown indicator_id '{ind_id}'")
        if geo6 not in valid_geos:
            errors.append(f"Row {idx}: invalid GB/T 2260 geo_code '{geo6}'")
        try:
            yr = int(rec["year"])
            if not (1949 <= yr <= 2100):
                errors.append(f"Row {idx}: invalid year {yr}")
        except (TypeError, ValueError):
            errors.append(f"Row {idx}: non-integer year '{rec['year']}'")
            continue
        try:
            val = float(rec["value"])
            if pd.isna(val):
                raise ValueError("NaN")
        except (TypeError, ValueError):
            errors.append(f"Row {idx}: invalid numeric value '{rec['value']}'")
            continue

        ev = str(rec["evidence_level"])
        if ev not in ("E1", "E2", "E3", "E4"):
            errors.append(f"Row {idx}: disallowed evidence_level '{ev}' (E0 prohibited in canonical candidate)")

        key = (ind_id, geo6, yr)
        if key in seen_keys:
            errors.append(f"Row {idx}: duplicate key {key} inside incoming batch")
        seen_keys.add(key)

        if ind_id in RANGE_BOUNDS:
            lo, hi = RANGE_BOUNDS[ind_id]
            if not (lo <= val <= hi):
                errors.append(f"Row {idx}: value {val} out of bounds [{lo}, {hi}] for {ind_id}")

        # Revision jump anomaly guard (>25% unexplained historical revision requires explicit revision_override=true)
        if key in base_lookup and base_lookup[key] != 0:
            rel_jump = abs(val - base_lookup[key]) / abs(base_lookup[key]) * 100.0
            if rel_jump > 25.0 and not rec.get("revision_override"):
                errors.append(
                    f"Row {idx}: anomalous revision jump {rel_jump:.2f}% on {key} "
                    f"({base_lookup[key]} -> {val}) without revision_override"
                )
    return errors


def stage_update_batch(
    base_obs_csv: Path,
    base_vint_csv: Path,
    incoming: list[dict[str, Any]],
    staging_dir: Path,
    meta_ind_csv: Path = META_IND,
    meta_reg_csv: Path = META_REG,
) -> dict[str, Any]:
    """
    Validate and stage an update batch into staging_dir (leaving base files untouched unless
    explicitly promoted via apply_staged_update). Preserves replaced canonical values in vintages.
    """
    staging_dir.mkdir(parents=True, exist_ok=True)
    base_df = pd.read_csv(base_obs_csv, dtype={"geo_code": str, "original_value": str})
    base_df["geo_code"] = base_df["geo_code"].str.zfill(6)
    vint_df = pd.read_csv(base_vint_csv, dtype={"geo_code": str})
    vint_df["geo_code"] = vint_df["geo_code"].str.zfill(6)

    ind_df = pd.read_csv(meta_ind_csv)
    reg_df = pd.read_csv(meta_reg_csv, dtype={"geo_code": str})
    reg_df["geo_code"] = reg_df["geo_code"].str.zfill(6)
    valid_inds = set(ind_df["indicator_id"])
    valid_geos = set(reg_df["geo_code"])
    reg_map = reg_df.set_index("geo_code").to_dict(orient="index")
    ind_map = ind_df.set_index("indicator_id").to_dict(orient="index")

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    errors = validate_incoming_batch(incoming, valid_inds, valid_geos, base_df)
    if errors:
        report = {
            "timestamp_utc": ts,
            "status": "BLOCKED_VALIDATION_FAILED",
            "auto_published": False,
            "incoming_rows": len(incoming),
            "blocking_errors": errors,
            "new_rows_detected": 0,
            "revisions_detected": 0,
            "unchanged_rows": 0,
            "base_obs_sha256": sha256_file(base_obs_csv),
        }
        (staging_dir / "pending_review_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return report

    # Create pre-update backup snapshot
    snap_dir = staging_dir / "snapshot_before"
    snap_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(base_obs_csv, snap_dir / "observations.csv")
    shutil.copy2(base_vint_csv, snap_dir / "vintages.csv")

    obs_by_key = {
        (str(r["indicator_id"]), str(r["geo_code"]).zfill(6), int(r["year"])): dict(r)
        for _, r in base_df.iterrows()
    }
    new_vintages: list[dict[str, Any]] = []
    new_rows: list[dict[str, Any]] = []
    revised_rows: list[dict[str, Any]] = []
    unchanged = 0

    for rec in incoming:
        ind_id = str(rec["indicator_id"])
        geo6 = str(rec["geo_code"]).zfill(6)
        yr = int(rec["year"])
        val = float(rec["value"])
        key = (ind_id, geo6, yr)
        reg = reg_map[geo6]
        ind = ind_map[ind_id]

        new_obs = {
            "observation_id": f"{ind_id}__{geo6}__{yr}",
            "indicator_id": ind_id,
            "geo_level": reg["geo_level"],
            "geo_code": geo6,
            "geo_name_zh": reg["name_zh"],
            "geo_name_en": reg["name_en"],
            "year": yr,
            "value": val,
            "unit": str(rec["unit"]),
            "original_value": str(rec["original_value"]),
            "original_unit": str(rec["original_unit"]),
            "is_derived": str(rec.get("is_derived", "false")).lower(),
            "derivation_formula": str(rec.get("derivation_formula", "")),
            "statistical_definition": ind["definition_zh"],
            "source_id": str(rec["source_id"]),
            "source_name": str(rec.get("source_name", rec["source_id"])),
            "source_table": str(rec["source_table"]),
            "source_url": str(rec.get("source_url", "https://data.stats.gov.cn/")),
            "retrieved_at": ts,
            "release_date": str(rec.get("release_date", ts[:10])),
            "first_published_date": str(rec.get("first_published_date", ts[:10])),
            "revised_date": str(rec.get("revised_date", "")),
            "vintage_id": str(rec["vintage_id"]),
            "revision_flag": str(rec.get("revision_flag", "staged_update")),
            "evidence_level": str(rec["evidence_level"]),
            "extraction_method": str(rec["extraction_method"]),
            "verification_status": str(rec.get("verification_status", "pending_human_review")),
            "notes": str(rec.get("notes", "")),
        }

        if key not in obs_by_key:
            obs_by_key[key] = new_obs
            new_rows.append({"key": f"{ind_id}/{geo6}/{yr}", "new_value": val, "vintage_id": new_obs["vintage_id"]})
        else:
            old = obs_by_key[key]
            old_val = float(old["value"])
            if abs(old_val - val) <= 1e-9:
                unchanged += 1
                continue
            delta_pct = round((val - old_val) / abs(old_val) * 100.0, 4) if old_val != 0 else 0.0
            # Archive old canonical value into vintages BEFORE updating staged canonical!
            old_vid = str(old["vintage_id"])
            new_vintages.append({
                "vintage_record_id": f"{ind_id}__{geo6}__{yr}__{old_vid}__archived",
                "indicator_id": ind_id,
                "geo_code": geo6,
                "year": yr,
                "vintage_id": old_vid,
                "vintage_label": f"修订前归档版本 ({old_vid})",
                "value": old_val,
                "unit": old["unit"],
                "source_reference": old["source_table"],
                "published_period": old.get("release_date", ""),
                "is_current_canonical": "false",
                "delta_vs_canonical_pct": round((old_val - val) / abs(val) * 100.0, 4) if val != 0 else 0.0,
                "notes": f"Archived automatically upon staged revision to {new_obs['vintage_id']} at {ts}",
            })
            new_vintages.append({
                "vintage_record_id": f"{ind_id}__{geo6}__{yr}__{new_obs['vintage_id']}",
                "indicator_id": ind_id,
                "geo_code": geo6,
                "year": yr,
                "vintage_id": new_obs["vintage_id"],
                "vintage_label": f"新版本候选 ({new_obs['vintage_id']})",
                "value": val,
                "unit": new_obs["unit"],
                "source_reference": new_obs["source_table"],
                "published_period": new_obs["release_date"],
                "is_current_canonical": "true",
                "delta_vs_canonical_pct": 0.0,
                "notes": new_obs["notes"],
            })
            new_obs["first_published_date"] = str(old.get("first_published_date") or old.get("release_date") or "")
            new_obs["revised_date"] = ts[:10]
            obs_by_key[key] = new_obs
            revised_rows.append({
                "key": f"{ind_id}/{geo6}/{yr}",
                "old_value": old_val,
                "new_value": val,
                "delta_pct": delta_pct,
                "old_vintage_preserved": old_vid,
                "new_vintage": new_obs["vintage_id"],
            })

    staged_obs_path = staging_dir / "staged_observations.csv"
    staged_vint_path = staging_dir / "staged_vintages.csv"
    out_obs = pd.DataFrame(sorted(obs_by_key.values(), key=lambda x: (x["indicator_id"], x["geo_code"], int(x["year"]))))
    out_obs.to_csv(staged_obs_path, index=False, encoding="utf-8")

    out_vint = pd.concat([vint_df, pd.DataFrame(new_vintages)], ignore_index=True) if new_vintages else vint_df
    out_vint = out_vint.drop_duplicates(subset=["vintage_record_id"], keep="last")
    out_vint.to_csv(staged_vint_path, index=False, encoding="utf-8")

    report = {
        "timestamp_utc": ts,
        "status": "STAGED_PENDING_REVIEW",
        "auto_published": False,
        "incoming_rows": len(incoming),
        "blocking_errors": [],
        "new_rows_detected": len(new_rows),
        "revisions_detected": len(revised_rows),
        "unchanged_rows": unchanged,
        "vintages_added": len(new_vintages),
        "new_rows_detail": new_rows,
        "revisions_detail": revised_rows,
        "snapshot_before_obs_sha256": sha256_file(snap_dir / "observations.csv"),
        "staged_obs_sha256": sha256_file(staged_obs_path),
        "staged_obs_rows": len(out_obs),
        "staged_vint_rows": len(out_vint),
    }
    (staging_dir / "pending_review_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def apply_staged_update(staging_dir: Path, target_obs_csv: Path, target_vint_csv: Path) -> dict[str, Any]:
    """Promote an already-reviewed staged batch to target files (used only after explicit human approval)."""
    rep = json.loads((staging_dir / "pending_review_report.json").read_text(encoding="utf-8"))
    if rep["status"] != "STAGED_PENDING_REVIEW":
        raise RuntimeError(f"Cannot apply staging dir with status {rep['status']}")
    shutil.copy2(staging_dir / "staged_observations.csv", target_obs_csv)
    shutil.copy2(staging_dir / "staged_vintages.csv", target_vint_csv)
    return {"applied": True, "obs_sha256": sha256_file(target_obs_csv), "vint_sha256": sha256_file(target_vint_csv)}


def rollback_from_snapshot(staging_dir: Path, target_obs_csv: Path, target_vint_csv: Path) -> dict[str, Any]:
    """Deterministically roll back target files to pre-update snapshot."""
    snap_dir = staging_dir / "snapshot_before"
    shutil.copy2(snap_dir / "observations.csv", target_obs_csv)
    shutil.copy2(snap_dir / "vintages.csv", target_vint_csv)
    return {
        "rolled_back": True,
        "restored_obs_sha256": sha256_file(target_obs_csv),
        "restored_vint_sha256": sha256_file(target_vint_csv),
    }


def check_live_nbs_delta() -> dict[str, Any]:
    """Polite read-only probe of NBS national GDP & population latest years against canonical DB."""
    url = "https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://data.stats.gov.cn/dg/website/page.html",
        "Content-Type": "application/json;charset=UTF-8",
    }
    base_df = pd.read_csv(CANON_OBS, dtype={"geo_code": str})
    probes = [
        ("gdp", "f7fd25aaad184414875632cf2327da60", "7dc6a2ee6c614960b7059991e0cc4d96"),
        ("population", "6331ad868e8b4f55b8e9b6e765609ce1", "806083491dbe46a08995783945a30b9d"),
    ]
    results = []
    for ind_id, cid, iid in probes:
        cur_max = int(base_df[(base_df["indicator_id"] == ind_id) & (base_df["geo_code"] == "000000")]["year"].max())
        try:
            r = requests.post(url, headers=headers, json={
                "cid": cid, "indicatorIds": [iid], "daCatalogId": "",
                "das": [{"text": "全国", "value": "000000000000"}],
                "showType": "1", "dts": ["2024YY-2026YY"],
                "rootId": "884c062607104a91967b22742537f44f",
            }, timeout=20)
            yrs = [int(y["code"][:4]) for y in r.json().get("data", []) if any(str(v.get("value", "")).strip() for v in y.get("values", []))]
            live_max = max(yrs) if yrs else 0
            results.append({"indicator_id": ind_id, "http_status": r.status_code, "canonical_max_year": cur_max, "live_max_year": live_max, "new_year_available": live_max > cur_max})
        except Exception as e:
            results.append({"indicator_id": ind_id, "error": str(e), "canonical_max_year": cur_max})
    return {"checked_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "probes": results}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check-live", action="store_true", help="Run polite read-only NBS latest-year probe")
    args = ap.parse_args()
    if args.check_live:
        res = check_live_nbs_delta()
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print("Use --check-live for read-only NBS check or import stage_update_batch() for staged updates.")


if __name__ == "__main__":
    main()
