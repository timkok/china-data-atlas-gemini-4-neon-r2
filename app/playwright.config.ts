import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../tests/e2e",
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3100",
    headless: true,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  },
  reporter: [["list"], ["json", { outputFile: "../reports/playwright_e2e_report.json" }]],
});
