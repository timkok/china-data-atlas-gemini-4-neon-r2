"""
Recursively index all 9 Round 1 model folders on Google Drive using `gdrive readonly ls --json`
and selectively download all audit, metadata, observations, quality reports, and key ingestion scripts
(strictly read-only; NEVER touches Round 2 sibling folders or modifies any Round 1 files).
"""

import csv
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
R1_DIR = ROOT / "r1_inputs"
MANIFEST_DIR = ROOT / "data" / "input_manifest"

R1_FOLDERS = [
    ("claude_opus_5_5", "Claude Opus 5.5", "103Q9txnKYcPiXz_DApN_zOJdjEebb30P"),
    ("codex_unavail", "Codex (Model Version Unavailable)", "11hyv6PNMhkPspFFrIPlHBlFFfR0yFnd_"),
    ("codex_gpt6", "Codex GPT-6", "1cAjfXt2ZdTd3TAisIV_Gm61Ot7lbQp5n"),
    ("gemini_unavail", "Gemini (Model Version Unavailable)", "1zN44CCnW8IfJ1Elmk48gZL1YhF900nUP"),
    ("gemini_4_neon", "Gemini 4 Neon", "1QRtc23mP3sGLekDyMqWw_Te7jC9Y0T3G"),
    ("gpt6_astra_pro", "GPT-6 Astra Pro", "1Q6Y3Je7xmmfAh3wADcp_UWxeyjbrLA4V"),
    ("gpt6_2", "GPT-6.2", "1HmG5Kbn0J-GLug2mS3D91-ZHdRJhOGVt"),
    ("grok_bot", "Grok Bot (Model Version Unavailable)", "1Myux8GqrLiP0IyAX5wHJkjF0FTUHCsMR"),
    ("muse_spark_1_3", "Muse Spark 1.3", "1TOZVhWJW8Oxc-_ga1e6oZkkL9CPWSG-P"),
]

SKIP_DIRS = {"node_modules", ".next", ".venv", "__pycache__", ".git", "screenshots", "assets", "images"}


def gdrive_ls(folder_id: str) -> list[dict]:
    res = subprocess.run(
        ["gdrive", "readonly", "ls", folder_id, "--json"],
        capture_output=True,
        text=True,
        check=True,
    )
    txt = res.stdout.strip()
    if not txt:
        return []
    return json.loads(txt)


def walk_folder(folder_id: str, prefix: str = "", depth: int = 0, max_depth: int = 4) -> list[dict]:
    items = gdrive_ls(folder_id)
    out = []
    for it in items:
        name = it.get("name", "")
        mime = it.get("mimeType", "")
        rel_path = f"{prefix}/{name}" if prefix else name
        entry = {
            "id": it.get("id", ""),
            "name": name,
            "path": rel_path,
            "mimeType": mime,
            "size": int(it.get("size") or 0),
            "modifiedTime": it.get("modifiedTime", ""),
            "is_folder": mime == "application/vnd.google-apps.folder",
        }
        out.append(entry)
        if entry["is_folder"] and depth < max_depth:
            if name.lower() not in SKIP_DIRS and not name.lower().startswith("raw_images"):
                try:
                    out.extend(walk_folder(entry["id"], rel_path, depth + 1, max_depth))
                except Exception as exc:
                    print(f"  [warn] failed walking {rel_path}: {exc}")
    return out


def should_download(item: dict) -> bool:
    if item["is_folder"]:
        return False
    name_l = item["name"].lower()
    path_l = item["path"].lower()
    size = item["size"]
    # Skip giant binaries, zip archives, images, pdfs unless small & key
    if name_l.endswith((".zip", ".tar.gz", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".woff2", ".ico", ".db", ".duckdb", ".sqlite", ".parquet")):
        return False
    if size > 15_000_000:
        return False
    # Always download core reports, metadata, observations, quality, validation, sources, browser test reports
    key_patterns = [
        "readme", "model_info", "delivery_report", "evaluation", "product_research",
        "limitations", "methodology", "changelog", "map_compliance", "deployment",
        "observation", "indicator", "region", "source", "quality", "validation",
        "coverage", "browser", "test_report", "acceptance", "audit", "dictionary",
        "conflict", "manifest", "verify", "ingest", "fetch", "nbs", "scrape", "extract",
    ]
    if any(k in path_l for k in key_patterns) and name_l.endswith((".md", ".txt", ".json", ".csv", ".py", ".ts", ".js", ".yaml", ".yml")):
        # Avoid downloading huge raw NBS json dumps (>3MB) or Next.js boilerplate files inside app/
        if "/app/" in path_l and not any(k in name_l for k in ["package.json", "indicator", "data"]):
            return False
        if "/raw/" in path_l and size > 1_000_000:
            return False
        return True
    # Also download any top-level markdown/json/csv file
    if "/" not in item["path"] and name_l.endswith((".md", ".txt", ".json", ".csv")):
        return True
    # Also download Google Docs at top level via export
    if "/" not in item["path"] and item["mimeType"] == "application/vnd.google-apps.document":
        return True
    return False


def download_item(item: dict, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if item["mimeType"] == "application/vnd.google-apps.document":
        dest = dest.with_suffix(".md")
        subprocess.run(
            ["gdrive", "readonly", "export", item["id"], str(dest), "--format", "md"],
            capture_output=True,
            text=True,
            check=True,
        )
    elif item["mimeType"] == "application/vnd.google-apps.spreadsheet":
        dest = dest.with_suffix(".csv")
        subprocess.run(
            ["gdrive", "readonly", "export", item["id"], str(dest), "--format", "csv"],
            capture_output=True,
            text=True,
            check=True,
        )
    else:
        subprocess.run(
            ["gdrive", "readonly", "download", item["id"], "--out", str(dest)],
            capture_output=True,
            text=True,
            check=True,
        )
    return hashlib.sha256(dest.read_bytes()).hexdigest()


def main():
    R1_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    manifest_rows = []
    summary = {}

    for slug, label, fid in R1_FOLDERS:
        print(f"\n=== Indexing R1 [{slug}] {label} ({fid}) ===")
        tree = walk_folder(fid, max_depth=4)
        (R1_DIR / f"index_{slug}.json").write_text(json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8")
        files = [x for x in tree if not x["is_folder"]]
        folders = [x for x in tree if x["is_folder"]]
        print(f"  Found {len(files)} files across {len(folders)} subfolders")
        top_names = [x["name"] for x in tree if "/" not in x["path"]]
        print(f"  Top-level: {top_names[:20]}")

        dl_count = 0
        for item in files:
            if should_download(item):
                dest = R1_DIR / slug / item["path"]
                try:
                    sha = download_item(item, dest)
                    dl_count += 1
                    manifest_rows.append({
                        "model_slug": slug,
                        "model_label": label,
                        "drive_file_id": item["id"],
                        "drive_path": item["path"],
                        "mime_type": item["mimeType"],
                        "size_bytes": item["size"],
                        "modified_time": item["modifiedTime"],
                        "local_rel_path": str(dest.relative_to(ROOT)),
                        "sha256": sha,
                        "status": "downloaded",
                    })
                except Exception as exc:
                    print(f"  [warn] download failed {item['path']}: {exc}")
                    manifest_rows.append({
                        "model_slug": slug,
                        "model_label": label,
                        "drive_file_id": item["id"],
                        "drive_path": item["path"],
                        "mime_type": item["mimeType"],
                        "size_bytes": item["size"],
                        "modified_time": item["modifiedTime"],
                        "local_rel_path": "",
                        "sha256": "",
                        "status": f"error: {exc}",
                    })
        print(f"  Downloaded {dl_count} key audit/data files for {slug}")
        summary[slug] = {
            "label": label,
            "folder_id": fid,
            "total_files_indexed": len(files),
            "total_subfolders": len(folders),
            "downloaded_files": dl_count,
            "top_level": top_names,
        }

    (MANIFEST_DIR / "r1_index_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    with (MANIFEST_DIR / "r1_input_manifest.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "model_slug", "model_label", "drive_file_id", "drive_path", "mime_type",
                "size_bytes", "modified_time", "local_rel_path", "sha256", "status",
            ],
        )
        w.writeheader()
        w.writerows(manifest_rows)
    print(f"\n=== ALL 9 ROUND 1 FOLDERS INDEXED & {len(manifest_rows)} KEY FILES MANIFESTED ===")


if __name__ == "__main__":
    main()
