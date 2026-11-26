-- China Data Atlas (Round 2) — Three-Layer Statistical Data Architecture DDL
-- Compatible with PostgreSQL 15+ and DuckDB 1.x

CREATE TABLE IF NOT EXISTS regions (
    geo_code                VARCHAR(12) PRIMARY KEY, -- GB/T 2260 6-digit code ('000000' = National)
    name_zh                 VARCHAR(64) NOT NULL,
    name_en                 VARCHAR(64) NOT NULL,
    short_zh                VARCHAR(16) NOT NULL,
    geo_level               VARCHAR(16) NOT NULL CHECK (geo_level IN ('national', 'province', 'prefecture')),
    macro_region_zh         VARCHAR(32) NOT NULL,
    macro_region_en         VARCHAR(32) NOT NULL,
    nbs_economic_zone_zh    VARCHAR(32) NOT NULL,
    nbs_economic_zone_en    VARCHAR(32) NOT NULL,
    capital_zh              VARCHAR(32),
    capital_en              VARCHAR(32),
    iso_3166_2              VARCHAR(16),
    in_mainland_nbs_scope   BOOLEAN NOT NULL DEFAULT TRUE,
    scope_note              TEXT
);

CREATE TABLE IF NOT EXISTS sources (
    source_id               VARCHAR(64) PRIMARY KEY,
    source_name_zh          VARCHAR(255) NOT NULL,
    source_name_en          VARCHAR(255) NOT NULL,
    publisher_zh            VARCHAR(255) NOT NULL,
    publisher_en            VARCHAR(255) NOT NULL,
    url                     TEXT NOT NULL,
    access_method           VARCHAR(64) NOT NULL,
    update_cadence          VARCHAR(32) NOT NULL,
    license_status          TEXT NOT NULL,
    redistribution_policy   TEXT NOT NULL,
    notes                   TEXT
);

CREATE TABLE IF NOT EXISTS indicators (
    indicator_id            VARCHAR(64) PRIMARY KEY,
    is_core_r1              BOOLEAN NOT NULL DEFAULT FALSE,
    domain_id               VARCHAR(32) NOT NULL,
    domain_zh               VARCHAR(64) NOT NULL,
    domain_en               VARCHAR(64) NOT NULL,
    name_zh                 VARCHAR(128) NOT NULL,
    name_en                 VARCHAR(128) NOT NULL,
    short_zh                VARCHAR(64) NOT NULL,
    unit_zh                 VARCHAR(32) NOT NULL,
    unit_en                 VARCHAR(32) NOT NULL,
    display_decimals        INTEGER NOT NULL DEFAULT 2,
    geo_coverage_scope      VARCHAR(64) NOT NULL,
    time_coverage_note      TEXT,
    higher_is_better        VARCHAR(16) CHECK (higher_is_better IN ('true', 'false', 'neutral')),
    definition_zh           TEXT NOT NULL,
    definition_en           TEXT NOT NULL,
    formula_note            TEXT,
    methodological_breaks   TEXT,
    limitations_zh          TEXT,
    primary_source_id       VARCHAR(64) REFERENCES sources(source_id)
);

-- Layer 1: Raw Evidence Manifest
CREATE TABLE IF NOT EXISTS raw_evidence_manifest (
    file_key                VARCHAR(128) PRIMARY KEY,
    source_id               VARCHAR(64) REFERENCES sources(source_id),
    url                     TEXT NOT NULL,
    local_path              TEXT NOT NULL,
    redistributed_in_repo   BOOLEAN NOT NULL DEFAULT TRUE,
    bytes                   BIGINT NOT NULL,
    sha256                  CHAR(64) NOT NULL,
    retrieved_at_utc        TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Layer 2: Canonical Candidate Observations (Strict separation of evidence_level vs extraction_method)
CREATE TABLE IF NOT EXISTS observations (
    observation_id          VARCHAR(128) PRIMARY KEY,
    indicator_id            VARCHAR(64) NOT NULL REFERENCES indicators(indicator_id),
    geo_level               VARCHAR(16) NOT NULL,
    geo_code                VARCHAR(12) NOT NULL REFERENCES regions(geo_code),
    geo_name_zh             VARCHAR(64) NOT NULL,
    geo_name_en             VARCHAR(64) NOT NULL,
    year                    INTEGER NOT NULL CHECK (year >= 1949 AND year <= 2100),
    value                   DOUBLE PRECISION NOT NULL,
    unit                    VARCHAR(32) NOT NULL,
    original_value          VARCHAR(64) NOT NULL,
    original_unit           VARCHAR(32) NOT NULL,
    is_derived              BOOLEAN NOT NULL DEFAULT FALSE,
    derivation_formula      TEXT,
    statistical_definition  TEXT,
    source_id               VARCHAR(64) NOT NULL REFERENCES sources(source_id),
    source_name             VARCHAR(255) NOT NULL,
    source_table            VARCHAR(255) NOT NULL,
    source_url              TEXT NOT NULL,
    retrieved_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    release_date            VARCHAR(32),
    first_published_date    VARCHAR(32),
    revised_date            VARCHAR(32),
    vintage_id              VARCHAR(64) NOT NULL,
    revision_flag           VARCHAR(32) NOT NULL,
    evidence_level          VARCHAR(4) NOT NULL CHECK (evidence_level IN ('E0', 'E1', 'E2', 'E3', 'E4')),
    extraction_method       VARCHAR(32) NOT NULL CHECK (extraction_method IN ('API', 'HTML', 'OCR', 'PDF', 'Manual', 'Derived')),
    verification_status     VARCHAR(32) NOT NULL,
    notes                   TEXT,
    UNIQUE (indicator_id, geo_code, year)
);

CREATE INDEX IF NOT EXISTS idx_obs_ind_year ON observations(indicator_id, year);
CREATE INDEX IF NOT EXISTS idx_obs_geo_year ON observations(geo_code, year);
CREATE INDEX IF NOT EXISTS idx_obs_evidence ON observations(evidence_level);

-- Layer 2b: Multi-Vintage Archive (preserves pre-5EC, pre-7th-Census, NHC 2000-2004, per-10k legacy vintages without overwriting)
CREATE TABLE IF NOT EXISTS observation_vintages (
    vintage_record_id       VARCHAR(160) PRIMARY KEY,
    indicator_id            VARCHAR(64) NOT NULL REFERENCES indicators(indicator_id),
    geo_code                VARCHAR(12) NOT NULL REFERENCES regions(geo_code),
    year                    INTEGER NOT NULL,
    vintage_id              VARCHAR(64) NOT NULL,
    vintage_label           VARCHAR(128) NOT NULL,
    value                   DOUBLE PRECISION NOT NULL,
    unit                    VARCHAR(32) NOT NULL,
    source_reference        TEXT NOT NULL,
    published_period        VARCHAR(64),
    is_current_canonical    BOOLEAN NOT NULL DEFAULT FALSE,
    delta_vs_canonical_pct  DOUBLE PRECISION,
    notes                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_vintages_key ON observation_vintages(indicator_id, geo_code, year);
