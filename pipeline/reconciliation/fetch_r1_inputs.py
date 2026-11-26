#!/usr/bin/env python3
"""
Read-only inventory and targeted download of ALL Round 1 model deliverables
from Google Drive folder China Data Atlas AI Comparison (1jBQSNOjLmc815L7nkxruelvxLV5y7PKg).

Strictly READ-ONLY on Round 1 folders. Never touches any Round 2 folders.
Outputs:
  - r1_inputs/<model_slug>/...
  - data/input_manifest/round1_files_manifest.csv
  - data/input_manifest/round1_drive_trees.json
"""
from __future__ import annotations

import csv
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path("/Users/tian/.gemini/antigravity/scratch/china-data-atlas-gemini-4-neon-r2")
R1_DIR = ROOT / "r1_inputs"
MANIFEST_DIR = ROOT / "data" / "input_manifest"

ROUND1_MODELS = [
    ("claude_opus_5_5", "Claude Opus 5.5", "103Q9txnKYcPiXz_DApN_zOJdjEebb30P"),
    ("codex_unavail_1250", "Codex (Model Version Unavailable, 1250)", "11hyv6PNMhkPspFFrIPlHBlFFfR0yFnd_"),
    ("codex_gpt6", "Codex GPT-6", "1cAjfXt2ZdTd3TAisIV_Gm61Ot7lbQp5n"),
    ("gemini_unavail", "Gemini (Model Version Unavailable)", "1zN44CCnW8IfJ1Elmk48gZL1YhF900nUP"),
    ("gemini_4_neon", "Gemini 4 Neon", "1QRtc23mP3sGLekDyMqWw_Te7jC9Y0T3G"),
    ("gpt6_astra_pro", "GPT-6 Astra Pro", "1Q6Y3Je7xmmfAh3wADcp_UWxeyjbrLA4V"),
    ("gpt6_2", "GPT-6.2", "1HmG5Kbn0J-GLug2mS3D91-ZHdRJhOGVt"),
    ("grok_bot", "Grok Bot (Model Version Unavailable)", "1Myux8GqrLiP0IyAX5wHJkjF0FTUHCsMR"),
    ("muse_spark_1_3", "Muse Spark 1.3", "1TOZVhWJW8Oxc-_ga1e6oZkkL9CPWSG-P"),
]

# Files we definitely want to download for audit & data reconciliation (avoid huge ZIPs or binary media)
IMPORTANT_EXTS = {".csv", ".json", ".md", ".txt", ".py", ".mjs", ".ts", ".sql", ".yaml", ".yml"}
SKIP_DIR_KEYWORDS = {"node_modules", ".next", ".venv", "__pycache__", "screenshots", "app/public"}


def gdrive_ls(folder_id: str) -> list[dict]:
    res = subprocess.run(
        ["gdrive", "readonly", "ls", folder_id, "--json"],
        capture_output=True, text=True, check=True,
    )
    txt = res.stdout.strip()
    return json.loads(txt) if txt else []


def walk_drive_folder(folder_id: str, prefix: str = "", depth: int = 0, max_depth: int = 4) -> list[dict]:
    if depth > max_depth:
        return []
    items = gdrive_ls(folder_id)
    out = []
    for it in items:
        rel = f"{prefix}/{it['name']}" if prefix else it["name"]
        entry = {
            "id": it["id"],
            "name": it["name"],
            "rel_path": rel,
            "mimeType": it.get("mimeType", ""),
            "size": int(it.get("size") or 0),
            "modifiedTime": it.get("modifiedTime", ""),
            "is_folder": it.get("mimeType") == "application/vnd.google-apps.folder",
        }
        out.append(entry)
        if entry["is_folder"]:
            # Skip deep recursion into app/src or node_modules unless needed; recurse data, reports, pipeline, deployment, tests
            low = rel.lower()
            if any(k in low for k in ["node_modules", ".next", ".venv", "__pycache__", "screenshots"]):
                continue
            if depth >= 2 and low.startswith("app/"):
                continue
            out.extend(walk_drive_folder(it["id"], rel, depth + 1, max_depth))
    return out


def should_download(entry: dict) -> bool:
    if entry["is_folder"]:
        return False
    rel = entry["rel_path"].lower()
    name = entry["name"].lower()
    ext = Path(name).suffix
    if name.endswith(".zip"):
        # Only download ZIP if the folder has very few unpacked files (handled separately)
        return False
    if entry["size"] > 25 * 1024 * 1024:
        return False
    # Always download core docs, normalized/metadata CSVs, reports, deployment, and pipeline scripts
    if "/" not in rel and ext in IMPORTANT_EXTS:
        return True
    if any(rel.startswith(p) for p in ["data/normalized", "data/metadata", "reports/", "deployment/", "pipeline/"]):
        return ext in IMPORTANT_EXTS
    if "observations" in name and ext == ".csv":
        return True
    if any(k in name for k in ["evaluation", "delivery_report", "model_info", "product_research", "quality", "validation", "coverage", "acceptance", "readme"]):
        return ext in IMPORTANT_EXTS
    return False


def download_file(file_id: str, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["gdrive", "readonly", "download", file_id, "--out", str(dest)],
        capture_output=True, text=True, check=True,
    )
    h = hashlib.sha256(dest.read_bytes()).hexdigest()
    return h


def main() -> None:
    R1_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)

    all_trees = {}
    download_jobs = []

    print("=== WALKING ALL 9 ROUND 1 DRIVE FOLDERS ===")
    for slug, label, fid in ROUND1_MODELS:
        try:
            tree = walk_drive_folder(fid)
        except Exception as e:
            print(f"[ERR] {slug}: {e}")
            tree = []
        all_trees[slug] = {"label": label, "folder_id": fid, "items": tree}
        files_only = [x for x in tree if not x["is_folder"]]
        zips = [x for x in files_only if x["name"].lower().endswith(".zip")]
        chosen = [x for x in files_only if should_download(x)]
        # If a model only uploaded a ZIP and no unpacked observations/reports, download its ZIP too (if <= 60MB)
        has_obs = any("observations" in x["name"].lower() for x in chosen)
        if not has_obs and zips:
            for z in zips:
                if z["size"] <= 60 * 1024 * 1024:
                    chosen.append(z)
        print(f"  {slug:22s}: total_items={len(tree):3d}, files={len(files_only):3d}, queued_download={len(chosen):2d}, zips={len(zips)}")
        for item in chosen:
            download_jobs.append((slug, label, item))

    (MANIFEST_DIR / "round1_drive_trees.json").write_text(
        json.dumps(all_trees, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\n=== DOWNLOADING {len(download_jobs)} ROUND 1 AUDIT FILES ===")
    manifest_rows = []

    def worker(job):
        slug, label, item = job
        dest = R1_DIR / slug / item["rel_path"]
        if dest.exists() and dest.stat().st_size == item["size"] and item["size"] > 0:
            sha = hashlib.sha256(dest.read_bytes()).hexdigest()
            status = "cached"
        else:
            try:
                sha = download_file(item["id"], dest)
                status = "downloaded"
            except Exception as e:
                sha = ""
                status = f"error: {e}"
        return {
            "model_slug": slug,
            "model_label": label,
            "drive_file_id": item["id"],
            "rel_path": item["rel_path"],
            "size_bytes": item["size"],
            "modified_time": item["modifiedTime"],
            "sha256": sha,
            "status": status,
        }

    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(worker, j) for j in download_jobs]
        for fut in as_completed(futs):
            row = fut.result()
            manifest_rows.append(row)
            done += 1
            if done % 25 == 0 or done == len(download_jobs):
                print(f"  Progress: {done}/{len(download_jobs)}")

    manifest_rows.sort(key=lambda r: (r["model_slug"], r["rel_path"]))
    out_csv = MANIFEST_DIR / "round1_files_manifest.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["model_slug", "model_label", "drive_file_id", "rel_path", "size_bytes", "modified_time", "sha256", "status"],
        )
        w.writeheader()
        w.writerows(manifest_rows)

    errs = [r for r in manifest_rows if r["status"].startswith("error")]
    print(f"\nDONE! Manifest: {out_csv} ({len(manifest_rows)} files, {len(errs)} errors)")


if __name__ == "__main__":
    main()
