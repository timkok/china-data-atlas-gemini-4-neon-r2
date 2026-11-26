# Deployment Information — China Data Atlas (Round 2)

- **Model Identity**: Gemini 4 Neon (`Gemini 4 Neon (Extra High; specific checkpoint version unavailable)`)
- **Deployment Date (UTC)**: 2026-11-26
- **Isolation Verified**: Completely separate repository, separate Vercel project, and separate Google Drive subfolder — Round 1 (`timkok/china-data-atlas-gemini-4-neon-r1` & `https://china-data-atlas-gemini-4-neon-r1.vercel.app`) remains 100% untouched (verified HTTP 200).

## Live Public URLs

| Resource | URL | Verified Status |
|---|---|---|
| **Live Web App (Vercel Production)** | https://china-data-atlas-gemini-4-neon-r2.vercel.app | **HTTP 200** across all 14 probed routes & 95 static/SSG routes |
| **Vercel Deployment Snapshot** | https://china-data-atlas-gemini-4-neon-r2-gfjpwiu1l-timkok621-1320.vercel.app | Ready (59s build, zero auth wall) |
| **GitHub Repository (Isolated R2)** | https://github.com/timkok/china-data-atlas-gemini-4-neon-r2 | Public repo + `feat/r2-china-data-atlas` PR #1 |
| **Google Drive Exclusive Folder** | https://drive.google.com/drive/folders/1xDi50PyX0Ho3-eETSydP0A9nuhuNPfeR | Full structured deliverables + clean ZIP |

## Live Route Verification Matrix (2026-11-26 UTC)

- `/` → HTTP 200
- `/indicators` → HTTP 200
- `/indicators/population` → HTTP 200
- `/indicators/physicians_per_1000` → HTTP 200
- `/provinces` → HTTP 200
- `/provinces/440000` → HTTP 200
- `/compare` → HTTP 200
- `/explore` → HTTP 200
- `/stories` → HTTP 200
- `/stories/zhejiang-vs-jiangsu-economy-income` → HTTP 200
- `/assistant` → HTTP 200
- `/audit` → HTTP 200
- `/methodology` → HTTP 200
- `/data/observations.csv` → HTTP 200
- **Live Playwright E2E Suite against `https://china-data-atlas-gemini-4-neon-r2.vercel.app`**: 10/10 test blocks (all 20 Acceptance Tasks A–T) PASSED with zero browser console/page errors.

## Measured Lighthouse Benchmarks (`reports/lighthouse/*.json`)

| Page | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` (Homepage) | **100** | **100** | 96 | **100** | 0.9 s | 50 ms | 0 |
| `/indicators/population` | **100** | 94 | 96 | **100** | 0.9 s | 10 ms | 0 |
| `/provinces/440000` | **100** | **100** | 96 | **100** | 0.9 s | 70 ms | 0 |
| `/explore` | **100** | **100** | 96 | **100** | 1.5 s | 60 ms | 0 |
| `/stories/zhejiang-vs-jiangsu-economy-income` | **100** | **100** | 96 | **100** | 0.9 s | 60 ms | 0 |

## Honest Unverified Access Checks (`tests_not_run`)

- `mainland_access_status`: `not_verified_overseas_host` (deployment tested from an overseas US host; Mainland China ISP routing/latency was not directly tested).
- `wechat_browser_status`: `not_verified_overseas_host` (390×844 mobile viewport tested in Chromium Playwright; live WeChat embedded WebView was not directly tested).
- **Secret Hygiene**: `app/.env.local` created by Vercel CLI was deleted immediately post-deploy and excluded via `.gitignore` and ZIP packager assertions; zero tokens or secrets exist in Git, Drive, or ZIP deliverables.
