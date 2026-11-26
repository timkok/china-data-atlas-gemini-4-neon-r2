#!/usr/bin/env python3
"""
Clean ZIP Packager & Polite Rate-Limit-Safe Google Drive Uploader for Round 2
=============================================================================
Target exclusive Drive folder: 1xDi50PyX0Ho3-eETSydP0A9nuhuNPfeR (China Data Atlas R2 - Gemini 4 Neon)
- Strictly excludes: .venv/, node_modules/, .next/, .vercel/, .env*, r1_inputs/, nbs_html_local/, .git/
- Uses polite concurrency (max_workers=2) + exponential backoff on Google Drive 403 rateLimitExceeded.
- Never touches any Round 1 folder or other models' Round 2 folders.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRIVE_ROOT_ID = "1xDi50PyX0Ho3-eETSydP0A9nuhuNPfeR"
ZIP_NAME = "China-Data-Atlas-Gemini-4-Neon-R2.zip"
ZIP_PATH = ROOT / ZIP_NAME

EXCLUDE_DIRS = {
    ".git", ".venv", "node_modules", ".next", ".vercel", "__pycache__",
    ".pytest_cache", "r1_inputs", "nbs_html_local", "test-results", "playwright-report",
}
EXCLUDE_FILE_PREFIXES = (".env", "nbs_prov_extra_", "nbs_r2_discovered_", "nbs_r2_extra_")
EXCLUDE_EXACT = {".DS_Store", "Thumbs.db", ZIP_NAME}


def is_excluded(rel: Path) -> bool:
    for part in rel.parts:
        if part in EXCLUDE_DIRS:
            return True
    name = rel.name
    if name in EXCLUDE_EXACT or name.endswith(".zip") or name.endswith(".pyc"):
        return True
    if any(name.startswith(p) for p in EXCLUDE_FILE_PREFIXES):
        return True
    return False


def collect_deliverable_files() -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = Path(dirpath).relative_to(ROOT)
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for fn in sorted(filenames):
            rel = rel_dir / fn if str(rel_dir) != "." else Path(fn)
            if not is_excluded(rel):
                files.append(rel)
    return files


def build_clean_zip(files: list[Path]) -> None:
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for rel in files:
            zf.write(ROOT / rel, arcname=f"China-Data-Atlas-Gemini-4-Neon-R2/{rel.as_posix()}")
    print(f"Built clean ZIP: {ZIP_PATH.name} ({ZIP_PATH.stat().st_size / 1e6:.2f} MB, {len(files)} files)")


def run_gdrive(args: list[str], retries: int = 6) -> str:
    delay = 3.0
    for attempt in range(1, retries + 1):
        p = subprocess.run(["gdrive", *args], capture_output=True, text=True)
        if p.returncode == 0:
            return p.stdout.strip()
        err = (p.stderr + "\n" + p.stdout).strip()
        if "rateLimitExceeded" in err or "RATE_LIMIT" in err or "403" in err or "429" in err or "503" in err:
            print(f"  [backoff {attempt}/{retries}] sleeping {delay:.1f}s due to Drive rate limit...")
            time.sleep(delay)
            delay = min(delay * 2.0, 45.0)
            continue
        raise RuntimeError(f"gdrive {' '.join(args)} failed: {err}")
    raise RuntimeError(f"gdrive {' '.join(args)} failed after {retries} retries")


def parse_drive_id(out: str) -> str:
    # gdrive mutate outputs JSON or "id: ..." / token
    import json, re
    try:
        j = json.loads(out)
        if isinstance(j, dict) and j.get("id"):
            return str(j["id"])
    except Exception:
        pass
    m = re.search(r'"id"\s*:\s*"([a-zA-Z0-9_-]{15,})"', out)
    if m:
        return m.group(1)
    m2 = re.search(r"\b([a-zA-Z0-9_-]{25,})\b", out)
    if m2:
        return m2.group(1)
    raise RuntimeError(f"Could not parse Drive ID from: {out[:200]}")


def list_existing_children(parent_id: str) -> dict[str, str]:
    import json
    out = run_gdrive(["readonly", "ls", parent_id, "--json"])
    items = json.loads(out) if out else []
    if isinstance(items, dict):
        items = items.get("files", items.get("items", []))
    return {str(it.get("name")): str(it.get("id")) for it in items if it.get("name") and it.get("id")}


def main() -> None:
    files = collect_deliverable_files()
    # Safety check: verify zero secrets or forbidden paths
    for rel in files:
        assert ".env" not in rel.name, f"Forbidden secret file: {rel}"
        assert "r1_inputs" not in rel.parts, f"Forbidden R1 raw file: {rel}"
        assert "nbs_html_local" not in rel.parts, f"Forbidden raw HTML: {rel}"
    build_clean_zip(files)

    if "--zip-only" in sys.argv:
        return

    # Upload structured Section 14 deliverables + full ZIP to our exclusive Drive folder
    # Upload core readable deliverables directly as structured folders + full ZIP for complete archive
    # (Skip uploading hundreds of tiny app/src/data/indicators/*.json or data/raw/nbs_r2/*.json individually
    # ONLY if we want to stay well under Drive's per-minute write quota — wait: let's check total file count!)
    print(f"Total clean files in project: {len(files)}")

    # Curated top-level & Section 14 key files to upload uncompressed into Drive tree + complete ZIP containing ALL files!
    # Wait: let's upload ALL key Section 14 deliverables uncompressed (~70 files) + the complete ZIP (~12 MB) so
    # reviewers can preview every report, CSV, SQL, screenshot, Lighthouse JSON, and code summary directly in Drive,
    # AND download the complete repo ZIP in 1 click without hitting Drive's per-minute quota!
    direct_upload_rels: list[Path] = []
    for rel in files:
        s = rel.as_posix()
        # Include all top-level docs, audit/, research/, reports/, screenshots/, deployment/,
        # data/metadata/, data/input_manifest/, data/reconciliation/, data/canonical_candidate/,
        # data/processed/ (DuckDB + Parquet; SQLite is inside ZIP), pipeline/, tests/, .github/
        if (
            len(rel.parts) == 1
            or s.startswith(("audit/", "research/", "reports/", "screenshots/", "deployment/",
                             "data/metadata/", "data/input_manifest/", "data/reconciliation/",
                             "data/canonical_candidate/", "pipeline/", "tests/", ".github/"))
            or s in ("data/processed/china_data_atlas_r2.duckdb", "data/processed/observations.parquet",
                     "app/package.json", "app/next.config.ts", "app/playwright.config.ts")
        ):
            direct_upload_rels.append(rel)

    direct_upload_rels.append(Path(ZIP_NAME))
    print(f"Files to upload directly to Drive tree (+ complete ZIP): {len(direct_upload_rels)}")

    # Ensure directory structure sequentially first (clean & race-free!)
    folder_ids: dict[str, str] = {"": DRIVE_ROOT_ID}
    existing_cache: dict[str, dict[str, str]] = {"": list_existing_children(DRIVE_ROOT_ID)}

    unique_dirs = sorted({rel.parent.as_posix() for rel in direct_upload_rels if rel.parent.as_posix() != "."})
    for d in unique_dirs:
        parts = d.split("/")
        cur = ""
        for p in parts:
            nxt = f"{cur}/{p}" if cur else p
            if nxt not in folder_ids:
                parent_id = folder_ids[cur]
                if cur not in existing_cache:
                    existing_cache[cur] = list_existing_children(parent_id)
                if p in existing_cache[cur]:
                    fid = existing_cache[cur][p]
                else:
                    out = run_gdrive(["mutate", "mkdir", p, "--parent", parent_id, "--json"])
                    fid = parse_drive_id(out)
                    existing_cache[cur][p] = fid
                    time.sleep(0.35)
                folder_ids[nxt] = fid
            cur = nxt

    def upload_one(rel: Path) -> str:
        parent_key = "" if rel.parent.as_posix() == "." else rel.parent.as_posix()
        parent_id = folder_ids[parent_key]
        if parent_key not in existing_cache:
            existing_cache[parent_key] = list_existing_children(parent_id)
        local_path = ROOT / rel
        existing_id = existing_cache[parent_key].get(rel.name)
        if existing_id:
            run_gdrive(["mutate", "update", existing_id, str(local_path)])
            return f"UPDATED {rel.as_posix()}"
        else:
            run_gdrive(["mutate", "upload", str(local_path), "--parent", parent_id])
            return f"UPLOADED {rel.as_posix()}"

    done = 0
    failed: list[str] = []
    # Low concurrency (max_workers=2) + small spacing prevents 403 rateLimitExceeded
    with ThreadPoolExecutor(max_workers=2) as pool:
        futs = {pool.submit(upload_one, rel): rel for rel in direct_upload_rels}
        for fut in as_completed(futs):
            rel = futs[fut]
            try:
                msg = fut.result()
                done += 1
                if done % 10 == 0 or rel.name == ZIP_NAME:
                    print(f"[{done}/{len(direct_upload_rels)}] {msg}")
            except Exception as exc:
                failed.append(f"{rel.as_posix()}: {exc}")
                print(f"[FAIL] {rel.as_posix()}: {exc}")

    print(f"\nDRIVE UPLOAD SUMMARY: {done}/{len(direct_upload_rels)} succeeded, {len(failed)} failed.")
    if failed:
        for f in failed:
            print("  ERR:", f)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
