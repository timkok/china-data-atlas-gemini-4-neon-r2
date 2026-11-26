import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const ROOT = path.resolve(__dirname, "..", "..");
const SHOTS = path.join(ROOT, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

function attachConsoleGuard(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const txt = msg.text();
      // Ignore harmless favicon/network abort during rapid route transitions
      if (!txt.includes("favicon.ico")) errors.push(`CONSOLE_ERROR: ${txt}`);
    }
  });
  return errors;
}

test.describe("China Data Atlas R2 — Full 20 User Acceptance Tasks (A–T)", () => {
  test("Task A & B: Homepage discovery, KPIs, search jump & desktop screenshot", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.locator("h1")).toContainText("中国数据地图");
    await expect(page.locator("body")).toContainText("30,220");
    await expect(page.locator("body")).toContainText("44");
    await page.screenshot({ path: path.join(SHOTS, "homepage-desktop.png"), fullPage: false });

    // Task B: Search for 每千人医师 and navigate
    const searchInput = page.getByLabel("首页搜索指标、省份或数据故事");
    await searchInput.fill("医师");
    const matchBtn = page.getByRole("button", { name: /每千人口执业（助理）医师数/ }).first();
    await expect(matchBtn).toBeVisible();
    await matchBtn.click();
    await page.waitForURL("**/indicators/physicians_per_1000");
    await expect(page.locator("h1")).toContainText("每千人口执业（助理）医师数");
    expect(errors).toEqual([]);
  });

  test("Task C, D, E, F, G: Indicator views, transforms, year switch, CSV & citation + screenshots", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/indicators/population", { waitUntil: "networkidle" });

    // Task E: Year switch on spatial matrix
    await expect(page.locator("body")).toContainText("七大地理大区省级空间矩阵");
    const yearSelect = page.getByLabel("选择年份");
    await yearSelect.selectOption("2020");
    await expect(page.locator("body")).toContainText("2020 年 · 七大地理大区省级空间矩阵");
    await yearSelect.selectOption("2025");

    // Task C & D: Switch to Trend, test YoY, Indexed, Log scale
    await page.getByRole("tab", { name: "历史趋势" }).click();
    await page.waitForSelector("canvas", { timeout: 15_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, "indicator-desktop.png"), fullPage: false });

    await page.getByRole("button", { name: "同比增速 (%)" }).click();
    await page.getByRole("button", { name: "定基指数 (Base=100)" }).click();
    await page.getByRole("button", { name: "对数 (Log)" }).click();
    await page.getByRole("button", { name: "线性" }).click();

    // Switch to Ranking & Data Table
    await page.getByRole("tab", { name: "省份排名" }).click();
    await page.waitForSelector("canvas", { timeout: 15_000 });
    await page.getByRole("tab", { name: "数据明细表" }).click();
    await expect(page.locator("table tbody tr").first()).toBeVisible();

    // Task F: Synchronized CSV export verification
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "导出当前 CSV" }).click(),
    ]);
    const dlPath = await dl.path();
    expect(dlPath).toBeTruthy();
    const csvText = fs.readFileSync(dlPath!, "utf-8");
    expect(csvText).toContain("indicator_id,indicator_name_zh,geo_code");
    expect(csvText).toContain("evidence_level,extraction_method,vintage_id");
    expect(csvText.split("\n").length).toBeGreaterThan(700);

    // Task G: Citation format switcher (GB/T 7714 & APA 7th)
    await expect(page.locator("pre")).toContainText("[DS/OL]");
    await page.getByRole("button", { name: "APA 7th" }).click();
    await expect(page.locator("pre")).toContainText("[Dataset]");
    expect(errors).toEqual([]);
  });

  test("Task H, K, L: Methodological breaks, Latest vs Complete Year, Vintages & Spatial Compliance shot", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Task K: Latest Data vs Complete Comparable Year on urbanization_rate (2025 nat vs 2024 31-prov)
    await page.goto("/indicators/urbanization_rate", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /最新数据/ }).click();
    await expect(page.locator("body")).toContainText("年份覆盖提示");
    await page.getByRole("button", { name: /完整可比年/ }).click();

    // Task H & L: Physicians 2002 break + NHC / NBS per-10k vintages
    await page.goto("/indicators/physicians_per_1000", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("执业医师法");
    await page.getByRole("tab", { name: /修订版本/ }).click();
    await expect(page.locator("body")).toContainText("国家卫健委");
    await expect(page.locator("body")).toContainText("NBS每万人取整表");

    // Spatial alternative + compliance notice screenshot on GDP
    await page.goto("/indicators/gdp", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "地图合规与插件接口说明" }).click();
    await expect(page.locator("body")).toContainText("deferred_with_pluggable_provider_interface");
    await page.screenshot({ path: path.join(SHOTS, "map-or-alternative.png"), fullPage: false });
    expect(errors).toEqual([]);
  });

  test("Task I & J: Mobile (390px) & Tablet (768px) zero overflow + mobile screenshots", async ({ page }) => {
    const errors = attachConsoleGuard(page);

    // Mobile Homepage (390×844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(homeOverflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: path.join(SHOTS, "homepage-mobile.png"), fullPage: false });

    // Hamburger menu works on mobile
    await page.getByLabel("打开导航菜单").click();
    await expect(page.getByRole("navigation", { name: "移动端导航" })).toBeVisible();
    await page.getByLabel("关闭导航菜单").click();

    // Mobile Indicator page (390×844)
    await page.goto("/indicators/population", { waitUntil: "networkidle" });
    const indOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(indOverflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: path.join(SHOTS, "indicator-mobile.png"), fullPage: false });

    // Task J: Tablet (768×1024) + lang attribute
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/indicators", { waitUntil: "networkidle" });
    const tabOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(tabOverflow).toBeLessThanOrEqual(2);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    expect(htmlLang).toBe("zh-CN");
    expect(errors).toEqual([]);
  });

  test("Task M: Cross-Model Audit Center & 1,911 Conflict Adjudication Explorer", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/audit", { waitUntil: "networkidle" });

    await expect(page.locator("h1")).toContainText("跨模型交叉审计");
    await expect(page.locator("body")).toContainText("1,911");
    await expect(page.locator("body")).toContainText("11,229");
    await expect(page.locator("body")).toContainText("9,110");
    await page.getByRole("button", { name: "P1" }).click();
    await expect(page.locator("body")).toContainText("FND-004");
    expect(errors).toEqual([]);
  });

  test("Task N: Multi-Province Comparison (Guangdong, Jiangsu, Zhejiang + Presets + CSV)", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/compare", { waitUntil: "networkidle" });

    await page.waitForSelector("canvas", { timeout: 15_000 });
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toContainText("广东省");
    await expect(page.locator("body")).toContainText("江苏省");
    await expect(page.locator("body")).toContainText("浙江省");
    await page.screenshot({ path: path.join(SHOTS, "province-comparison.png"), fullPage: false });

    await page.getByRole("button", { name: "东北三省" }).click();
    await expect(page.locator("body")).toContainText("黑龙江省");
    await page.getByRole("button", { name: "指数 (2015=100)" }).click();

    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "导出对比表 CSV" }).click(),
    ]);
    const csv = fs.readFileSync((await dl.path())!, "utf-8");
    expect(csv).toContain("common_comparable_year");
    expect(errors).toEqual([]);
  });

  test("Task O & P: Data Explorer Pearson r Scatter + Multi-Province Multi-Indicator CSV Export", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/explore", { waitUntil: "networkidle" });

    // Task O: Pearson r & Causation Disclaimer
    await page.waitForSelector("canvas", { timeout: 15_000 });
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toContainText("0.7899");
    await expect(page.locator("body")).toContainText("相关性 ≠ 因果性");
    await page.screenshot({ path: path.join(SHOTS, "data-explorer.png"), fullPage: false });

    // Task P: Multi-Province × Multi-Indicator Synchronized CSV Export
    await page.getByRole("button", { name: /多省 × 多指标定制导出/ }).click();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /同步导出定制 CSV/ }).click(),
    ]);
    const csv = fs.readFileSync((await dl.path())!, "utf-8");
    expect(csv).toContain("indicator_id,indicator_name_zh,unit,geo_code");
    expect(csv).toContain("440000");
    expect(csv).toContain("320000");
    expect(csv).toContain("330000");
    expect(csv).toContain("physicians_per_1000");
    expect(errors).toEqual([]);
  });

  test("Task Q: 31 Province Profile Pages (Guangdong 440000 & Zhejiang 330000)", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/provinces", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText("31 省级行政区");

    await page.goto("/provinces/440000", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText("广东省");
    await expect(page.locator("body")).toContainText("#1");
    await page.waitForSelector("canvas", { timeout: 15_000 });

    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "导出本省指标 CSV" }).click(),
    ]);
    const csv = fs.readFileSync((await dl.path())!, "utf-8");
    expect(csv).toContain("440000,广东省");
    expect(errors).toEqual([]);
  });

  test("Task R: Reproducible Data Stories with Formula, Chart & Fact vs Inference", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/stories", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText("6 篇");

    await page.goto("/stories/zhejiang-vs-jiangsu-economy-income", { waitUntil: "networkidle" });
    await page.waitForSelector("canvas", { timeout: 15_000 });
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toContainText("研究问题");
    await expect(page.locator("body")).toContainText("核验统计事实");
    await expect(page.locator("body")).toContainText("结构解读与推断");
    await page.screenshot({ path: path.join(SHOTS, "data-story.png"), fullPage: false });
    expect(errors).toEqual([]);
  });

  test("Task S & T: Methodology Update Gate + Deterministic Query Engine & Speculative Refusal", async ({ page }) => {
    const errors = attachConsoleGuard(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Task S: Methodology & verified isolated update test report
    await page.goto("/methodology", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("不声明为 CC0");
    await expect(page.locator("body")).toContainText("deferred_with_pluggable_provider_interface");
    const updateRep = JSON.parse(
      fs.readFileSync(path.join(ROOT, "reports", "update_test_report.json"), "utf-8")
    );
    expect(updateRep.overall_status).toBe("PASS");
    expect(updateRep.production_files_untouched).toBe(true);

    // Task T: Research Query Engine answered query + honest refusal
    await page.goto("/assistant", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("非通用生成式 LLM");
    await page.getByRole("button", { name: "对比广东与江苏近10年GDP变化" }).click();
    await page.waitForSelector("canvas", { timeout: 15_000 });
    await expect(page.locator("body")).toContainText("确定性计算完成");

    // Speculative query must be refused cleanly
    const qInput = page.getByLabel("输入统计研究问题");
    await qInput.fill("2035年GDP预测");
    await page.getByRole("button", { name: "执行确定性计算" }).click();
    await expect(page.locator("body")).toContainText("超出官方历史统计库范围");
    expect(errors).toEqual([]);
  });
});
