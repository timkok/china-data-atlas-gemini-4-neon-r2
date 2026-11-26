"""Comprehensive pytest suite for Round 2 Canonical Candidate Database & Governance Rules."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import duckdb
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
OBS_CSV = ROOT / "data" / "canonical_candidate" / "observations.csv"
VINT_CSV = ROOT / "data" / "canonical_candidate" / "vintages.csv"
IND_CSV = ROOT / "data" / "metadata" / "indicators.csv"
REG_CSV = ROOT / "data" / "metadata" / "regions.csv"
QUAL_JSON = ROOT / "reports" / "data_quality_report.json"
VAL_CSV = ROOT / "reports" / "data_validation_samples.csv"
DUCKDB_PATH = ROOT / "data" / "processed" / "china_data_atlas_r2.duckdb"
PARQUET_PATH = ROOT / "data" / "processed" / "observations.parquet"
SQLITE_PATH = ROOT / "data" / "processed" / "china_data_atlas_r2.sqlite"


@pytest.fixture(scope="module")
def obs_df() -> pd.DataFrame:
    df = pd.read_csv(OBS_CSV, dtype={"geo_code": str, "original_value": str})
    df["geo_code"] = df["geo_code"].str.zfill(6)
    return df


@pytest.fixture(scope="module")
def ind_df() -> pd.DataFrame:
    return pd.read_csv(IND_CSV)


@pytest.fixture(scope="module")
def reg_df() -> pd.DataFrame:
    df = pd.read_csv(REG_CSV, dtype={"geo_code": str})
    df["geo_code"] = df["geo_code"].str.zfill(6)
    return df


def test_indicator_expansion_and_core_completeness(obs_df: pd.DataFrame, ind_df: pd.DataFrame) -> None:
    assert 30 <= len(ind_df) <= 50, f"Expected 30-50 indicators, got {len(ind_df)}"
    assert obs_df["indicator_id"].nunique() == len(ind_df)
    core = set(ind_df[ind_df["is_core_r1"].astype(str).str.lower() == "true"]["indicator_id"])
    assert len(core) == 12
    for cid in core:
        sub = obs_df[(obs_df["indicator_id"] == cid) & (obs_df["geo_code"] != "000000")]
        assert (sub.groupby("year")["geo_code"].nunique() >= 31).any(), f"{cid} missing complete 31-province year"
    # Higher education split check: undergrad/college vs postgraduates separated
    assert "higher_education_students" in set(ind_df["indicator_id"])
    assert "postgraduate_students" in set(ind_df["indicator_id"])


def test_primary_key_and_no_nulls(obs_df: pd.DataFrame, reg_df: pd.DataFrame) -> None:
    assert obs_df.duplicated(subset=["indicator_id", "geo_code", "year"]).sum() == 0
    for col in ["observation_id", "indicator_id", "geo_code", "year", "value", "unit", "original_value", "evidence_level", "extraction_method"]:
        assert obs_df[col].isna().sum() == 0, f"Nulls found in {col}"
    assert set(obs_df["geo_code"]).issubset(set(reg_df["geo_code"]))


def test_strict_evidence_governance(obs_df: pd.DataFrame) -> None:
    # Zero unverified E0 rows in canonical candidate
    assert (obs_df["evidence_level"] == "E0").sum() == 0
    # Strict separation: bulk API rows MUST remain E1 (no fake bulk promotion!)
    ev = obs_df["evidence_level"].value_counts().to_dict()
    assert ev.get("E1", 0) > 20000, "Bulk single-source API rows must stay E1, not bulk-promoted"
    assert ev.get("E2", 0) >= 100, "Directly audited/HTML samples must be E2"
    assert ev.get("E3", 0) >= 15, "Dual-official-source cross-checks must be E3"
    assert ev.get("E4", 0) >= 500, "Adjudicated multi-model conflicts must be E4"
    # Extraction methods valid
    assert set(obs_df["extraction_method"]).issubset({"API", "HTML", "Derived", "PDF", "OCR", "Manual"})


def test_accounting_identities(obs_df: pd.DataFrame) -> None:
    piv = obs_df.pivot(index=["geo_code", "year"], columns="indicator_id", values="value")
    # Urban + Rural ≈ Population
    ur = piv.dropna(subset=["urban_population", "rural_population", "population"])
    assert len(ur) >= 600
    max_ur_pct = ((ur["urban_population"] + ur["rural_population"] - ur["population"]).abs() / ur["population"] * 100).max()
    assert max_ur_pct < 1.0
    # GDP 3-sector sum ≈ GDP
    gs = piv.dropna(subset=["gdp_primary", "gdp_secondary", "gdp_tertiary", "gdp"])
    assert len(gs) >= 800
    max_gdp_pct = ((gs["gdp_primary"] + gs["gdp_secondary"] + gs["gdp_tertiary"] - gs["gdp"]).abs() / gs["gdp"] * 100).max()
    assert max_gdp_pct < 1.0


def test_known_official_anchor_values(obs_df: pd.DataFrame) -> None:
    lk = obs_df.set_index(["indicator_id", "geo_code", "year"])["value"].to_dict()
    # 2025 National GDP & Population (NBS Communique + API E3 verified)
    assert abs(lk[("gdp", "000000", 2025)] - 1401879.2) < 1.0
    assert abs(lk[("population", "000000", 2025)] - 140489) <= 1.0
    assert abs(lk[("urbanization_rate", "000000", 2025)] - 67.89) <= 0.05
    # 2024 National Physicians per 1,000 matches NHC 3.61 (eliminates Grok per-10k rounding loss!)
    assert abs(lk[("physicians_per_1000", "000000", 2024)] - 3.61) <= 0.02
    # 2024 National Regular/Vocational Undergrad+College matches MOE 38.91M (excludes postgraduates!)
    assert abs(lk[("higher_education_students", "000000", 2024)] - 38912568) <= 5000
    # 2020 Census Bulletin No. 5 National 65+ = 13.50%
    assert abs(lk[("population_65plus", "000000", 2020)] - 13.50) < 0.01


def test_vintages_and_multiformat_storage() -> None:
    vdf = pd.read_csv(VINT_CSV, dtype={"geo_code": str})
    assert len(vdf) >= 2000
    assert "NBS_PER10K_INTEGER_DIV10" in set(vdf["vintage_id"])
    assert "NHC_YEARBOOK_2024_DIRECT" in set(vdf["vintage_id"])
    assert "PRE_5EC_YEARBOOK" in set(vdf["vintage_id"])

    # DuckDB, Parquet, SQLite row counts match canonical CSV exactly
    expected = len(pd.read_csv(OBS_CSV))
    con = duckdb.connect(str(DUCKDB_PATH), read_only=True)
    assert con.execute("SELECT COUNT(*) FROM observations").fetchone()[0] == expected
    assert con.execute(f"SELECT COUNT(*) FROM read_parquet('{PARQUET_PATH}')").fetchone()[0] == expected
    con.close()

    scon = sqlite3.connect(str(SQLITE_PATH))
    assert scon.execute("SELECT COUNT(*) FROM observations").fetchone()[0] == expected
    scon.close()


def test_quality_gate_and_validation_samples() -> None:
    q = json.loads(QUAL_JSON.read_text(encoding="utf-8"))
    assert q["status"] == "PASS"
    assert q["data_quality_errors"] == 0
    vdf = pd.read_csv(VAL_CSV)
    assert len(vdf) >= 100
    assert (vdf["audit_result"] == "PASS").all()
