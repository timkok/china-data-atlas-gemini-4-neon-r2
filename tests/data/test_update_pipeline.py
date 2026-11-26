"""
Isolated Update Simulation Test Suite (Fulfills Round 2 Section 11 & Acceptance Task S)
======================================================================================
Strictly isolated inside a temporary sandbox (never touches production canonical CSVs!).
Tests ALL five mandatory update-governance scenarios and writes reports/update_test_report.json:
1. New-year detection & staging (2026 national + Guangdong GDP & population)
2. Historical revision detection WITHOUT overwriting old vintage (2025 GDP revised -> old preserved in vintages)
3. Blocking invalid / missing-field / out-of-range / E0 / anomalous-jump batches
4. Explicit pending-review gate (auto_published is always False)
5. Full apply + deterministic byte-for-byte SHA-256 rollback verification!
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from pipeline.update.check_and_stage_update import (
    CANON_OBS,
    CANON_VINT,
    apply_staged_update,
    rollback_from_snapshot,
    sha256_file,
    stage_update_batch,
)


def run_isolated_update_simulation(sandbox_dir: Path) -> dict:
    prod_obs_hash_before = sha256_file(CANON_OBS)
    prod_vint_hash_before = sha256_file(CANON_VINT)

    iso_obs = sandbox_dir / "isolated_observations.csv"
    iso_vint = sandbox_dir / "isolated_vintages.csv"
    shutil.copy2(CANON_OBS, iso_obs)
    shutil.copy2(CANON_VINT, iso_vint)
    orig_obs_hash = sha256_file(iso_obs)
    orig_vint_hash = sha256_file(iso_vint)
    orig_obs_count = len(pd.read_csv(iso_obs))
    orig_vint_count = len(pd.read_csv(iso_vint))

    # Scenario 1 & 2: Valid batch with 2 new-year rows (2026) + 1 historical revision (2025 Guangdong GDP +0.8%)
    base_df = pd.read_csv(iso_obs, dtype={"geo_code": str})
    gd25_old = float(base_df[(base_df["indicator_id"] == "gdp") & (base_df["geo_code"] == "440000") & (base_df["year"] == 2025)]["value"].iloc[0])
    gd25_rev = round(gd25_old * 1.008, 1)

    valid_batch = [
        {
            "indicator_id": "gdp", "geo_code": "000000", "year": 2026,
            "value": 1468000.0, "unit": "亿元", "original_value": "1468000.0", "original_unit": "亿元",
            "source_id": "NBS_DATA_NATIONAL", "source_table": "SIMULATION_NBS_2026_PRELIM",
            "vintage_id": "SIM_2027_PRELIM", "evidence_level": "E1", "extraction_method": "API",
            "notes": "Isolated simulation test record (never persisted to production)",
        },
        {
            "indicator_id": "gdp", "geo_code": "440000", "year": 2026,
            "value": 152500.0, "unit": "亿元", "original_value": "152500.0", "original_unit": "亿元",
            "source_id": "NBS_DATA_PROVINCIAL", "source_table": "SIMULATION_NBS_2026_PRELIM",
            "vintage_id": "SIM_2027_PRELIM", "evidence_level": "E1", "extraction_method": "API",
            "notes": "Isolated simulation test record (never persisted to production)",
        },
        {
            "indicator_id": "gdp", "geo_code": "440000", "year": 2025,
            "value": gd25_rev, "unit": "亿元", "original_value": str(gd25_rev), "original_unit": "亿元",
            "source_id": "NBS_DATA_PROVINCIAL", "source_table": "SIMULATION_NBS_2025_FINAL_REV",
            "vintage_id": "SIM_2027_FINAL_REV", "evidence_level": "E2", "extraction_method": "API",
            "notes": "Simulated 2025 final verification revision (+0.8%)",
        },
    ]

    stage_ok = sandbox_dir / "stage_valid"
    rep_valid = stage_update_batch(iso_obs, iso_vint, valid_batch, stage_ok)

    # Verify staging did NOT touch iso_obs yet (review gate respected!)
    assert sha256_file(iso_obs) == orig_obs_hash
    assert rep_valid["status"] == "STAGED_PENDING_REVIEW"
    assert rep_valid["auto_published"] is False
    assert rep_valid["new_rows_detected"] == 2
    assert rep_valid["revisions_detected"] == 1
    assert rep_valid["vintages_added"] == 2
    assert rep_valid["staged_obs_rows"] == orig_obs_count + 2

    # Scenario 3: Invalid batch (missing required field, invalid geo_code, out-of-range, E0, >25% anomalous jump)
    invalid_batch = [
        {"indicator_id": "gdp", "geo_code": "999999", "year": 2026, "value": 100.0, "unit": "亿元",
         "original_value": "100", "original_unit": "亿元", "source_id": "NBS_DATA_PROVINCIAL",
         "source_table": "BAD_GEO", "vintage_id": "BAD", "evidence_level": "E1", "extraction_method": "API"},
        {"indicator_id": "urbanization_rate", "geo_code": "440000", "year": 2026, "value": 145.0, "unit": "%",
         "original_value": "145", "original_unit": "%", "source_id": "NBS_DATA_PROVINCIAL",
         "source_table": "BAD_RANGE", "vintage_id": "BAD", "evidence_level": "E0", "extraction_method": "API"},
        {"indicator_id": "gdp", "geo_code": "440000", "year": 2025, "value": gd25_old * 2.5, "unit": "亿元",
         "original_value": str(gd25_old * 2.5), "original_unit": "亿元", "source_id": "NBS_DATA_PROVINCIAL",
         "source_table": "BAD_JUMP", "vintage_id": "BAD", "evidence_level": "E1", "extraction_method": "API"},
        {"indicator_id": "gdp", "geo_code": "440000", "year": 2026},  # missing fields
    ]
    stage_bad = sandbox_dir / "stage_invalid"
    rep_bad = stage_update_batch(iso_obs, iso_vint, invalid_batch, stage_bad)
    assert rep_bad["status"] == "BLOCKED_VALIDATION_FAILED"
    assert len(rep_bad["blocking_errors"]) >= 4
    assert not (stage_bad / "staged_observations.csv").exists()

    # Scenario 4 & 5: Apply approved staged update to ISOLATED copy, verify old vintage preserved, then ROLLBACK byte-for-byte!
    applied = apply_staged_update(stage_ok, iso_obs, iso_vint)
    assert applied["applied"] is True
    assert sha256_file(iso_obs) != orig_obs_hash
    v_after = pd.read_csv(iso_vint, dtype={"geo_code": str})
    assert len(v_after) == orig_vint_count + 2
    preserved = v_after[
        (v_after["indicator_id"] == "gdp")
        & (v_after["geo_code"] == "440000")
        & (v_after["year"] == 2025)
        & (v_after["is_current_canonical"].astype(str).str.lower() == "false")
    ]
    assert any(abs(float(x) - gd25_old) < 0.01 for x in preserved["value"]), "Prior canonical vintage was NOT preserved!"

    rolled = rollback_from_snapshot(stage_ok, iso_obs, iso_vint)
    assert rolled["rolled_back"] is True
    assert rolled["restored_obs_sha256"] == orig_obs_hash
    assert rolled["restored_vint_sha256"] == orig_vint_hash

    # Critical safety assertion: Production canonical files 100% untouched!
    assert sha256_file(CANON_OBS) == prod_obs_hash_before
    assert sha256_file(CANON_VINT) == prod_vint_hash_before

    return {
        "executed_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "isolated_sandbox_verified": True,
        "production_files_untouched": True,
        "production_obs_sha256_unchanged": prod_obs_hash_before,
        "scenarios": {
            "new_year_detection": {"status": "PASS", "new_rows_detected": rep_valid["new_rows_detected"]},
            "revision_preservation": {
                "status": "PASS",
                "revisions_detected": rep_valid["revisions_detected"],
                "old_gd_2025_gdp_preserved": gd25_old,
                "simulated_new_gd_2025_gdp": gd25_rev,
                "vintages_added": rep_valid["vintages_added"],
            },
            "invalid_batch_blocking": {
                "status": "PASS",
                "blocking_errors_count": len(rep_bad["blocking_errors"]),
                "sample_errors": rep_bad["blocking_errors"][:5],
            },
            "human_review_gate": {"status": "PASS", "auto_published": rep_valid["auto_published"]},
            "snapshot_and_rollback": {
                "status": "PASS",
                "byte_identical_obs_rollback": rolled["restored_obs_sha256"] == orig_obs_hash,
                "byte_identical_vint_rollback": rolled["restored_vint_sha256"] == orig_vint_hash,
            },
        },
        "overall_status": "PASS",
    }


def test_isolated_update_pipeline_all_scenarios(tmp_path: Path) -> None:
    report = run_isolated_update_simulation(tmp_path)
    assert report["overall_status"] == "PASS"
    out_path = ROOT / "reports" / "update_test_report.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
