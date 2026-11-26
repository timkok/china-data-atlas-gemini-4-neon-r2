# Round 1 Cross-Model Audit Report — China Data Atlas (R2)

- **审计执行模型**：Gemini 4 Neon（Round 2 独立审计，包含对自身 Round 1 版本的诚实自审）
- **审计日期（UTC）**：2026-11-24
- **审查范围**：`China Data Atlas AI Comparison` (`1jBQSNOjLmc815L7nkxruelvxLV5y7PKg`) 全部 **9 个 Round 1 目录**（7 个含完整数据与报告、2 个空目录），只读导入全部 7 份标准化 `observations.csv`（合计 28,509 条原始行、9,181 个去重核心 12 指标键），并完成逐单元格数值交叉比对与 2,909 条差异裁决（详见 [`findings.csv`](findings.csv)、[`round1_inventory.csv`](round1_inventory.csv)、[`data_overlap_matrix.csv`](data_overlap_matrix.csv) 与 [`../data/reconciliation/conflicts.csv`](../data/reconciliation/conflicts.csv)）。

---

## 1. 核心专项调查结论（对应任务书 §2.1 A–E）

### A. 官方数据获取机制对比（Grok Bot vs Gemini 4 Neon）
- 两者均独立发现国家统计局新版「国家数据」公开匿名数据接口：`POST https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData`（替代已返回 HTTP 403 `UrlACL` 的旧版 `easyquery.htm`），均未绕过登录、验证码或任何反爬限制。
- **关键工程差异**：Grok Bot (`pipeline/ingestion/nbs_client.py`) 认为 WAF 拦截裸 HTTP 请求，因而每次抓取都启动 Playwright 无头 Chromium；Gemini 4 Neon 实测证明仅需规范 `Referer: https://data.stats.gov.cn/dg/website/page.html` 与 `Content-Type: application/json`，纯 Python `requests.Session` 即可稳定返回 HTTP 200（速度提升 10 倍、无浏览器依赖、极易接入 GitHub Actions 定期增量检测）。
- **长期维护风险**：该端点属于国家数据前端 SPA 调用的公开非契约接口，未来若前端改版可能调整字段或 CID，因此 Round 2 保留原始 JSON 快照哈希与变更探测告警机制。

### B. 125 条核心记录差异根因调查（Grok Bot 8,985 vs Gemini 4 Neon 9,110）
- 逐单元格交叉比对证实：除 `physicians_per_1000` 外，两者在其余 11 个核心指标的 **8,309 个重叠单元格中 >1% 差异数为 0**！
- **全部 125 条记录差异与全部 464 条 >1% 数值差异均 100% 集中于 `physicians_per_1000`**：
  - Grok Bot 直接读取国家数据「每万人拥有执业（助理）医师数（人）」并除以 10。该表仅公布 21 个省级年份（缺失 **2000、2005、2006、2007 年 × 31 省 = 124 条**）与 25 个全国年份（缺失 **2025 年 = 1 条**），合计正好 **125 条**；且该表在国家数据中按“每万人整数”舍入（如全国 2024=36 → 3.60、北京 2024=58 → 5.80、全国 2000=17 → 1.70），带来最高 ±0.05/千人（3–4%）的舍入失真。
  - Gemini 4 Neon 使用同库官方「执业（助理）医师数（万人）÷ 年末常住人口（万人）× 1000」精算至 2 位小数（2024 年全国 `3.61` 与国家卫健委公报 `3.61` 完全一致，覆盖全部 801 条 2000–2025 年数据）。
  - **同时通过审计 GPT-6 Astra Pro 发现另一关键事实**：2000–2004 年国家卫健委《2024 中国卫生健康统计年鉴》直接公布的每千人口医师数（2000 年 `1.68`、2002 年 `1.47`）高于 Gemini 4 Neon 的派生值（`1.64`、`1.44`，差 ~2.4%），原因在于卫健委沿用历史分母且 **2002 年起实行法定执业医师资格证口径切换**（2002 年前为在岗医生）。Round 2 完整保留双版本并显式标注 2002 年口径断点！

### C. Verification Status 定义审视（含诚实自审）
- **Gemini 4 Neon R1（Confirmed P1 自审问题 `F-001`）**：将全部 `9,110/9,110` 条记录标为 `verified`，尽管独立抽样复核表仅覆盖 60 条。批量 API 抓取与结构测试通过不能等同于逐条独立核验。
- **Grok Bot**：三层分级更为严谨（`106 verified / 8,710 partially_verified / 2,413 unverified`），但全部 3 个扩展指标（2,244 条）及部分全国序列仍处于 `unverified`。
- **GPT-6 Astra Pro（R1 最佳审计台账）**：`72 verified / 1,344 partially_verified`，并额外保留 `original_value`、`original_unit`、`evidence_file` 三列，审计透明度最高。
- **Round 2 统一标准**：采用严格的 **E0–E4 证据等级** 与 **`extraction_method`（API / HTML / XLS / OCR / Manual / Derived）分离存储**，抽样绝不自动提升未抽查行等级，两模型从同一接口抓到相同值不计为 E3 独立来源交叉核验。

### D. Claude Opus 5.5 年鉴 OCR 提取与警告核查
- 核查其 `02_data/quality_report.json` 与 `observations.csv`（4,616 条）：
  - `5,488` 条 `single_reading_ocr` 与 `555` 条 `revised_vs_earlier_edition` 属于原始单元格提取溯源与跨年鉴修订标记，**并非已证实错误**；实际上在其与国家数据重叠的 **3,028 条非 GDP 单元格中，>1% 差异仅 2 条**（均为 2016–2017 全国出生率七普前旧口径 `12.95/12.43` vs 修订后 `13.57/12.64`），OCR 准确率极高！
  - 真正的问题在于：① 未能获取 3 项核心指标（`retail_sales`、`physicians_per_1000`、`hospital_beds_per_1000`，虽在 `01_docs/blockers.md` 诚实披露未冒充）；② 其 2015–2023 省级 GDP 直接采自各年当期《中国统计年鉴》，未纳入 2024 年底第五次全国经济普查修订，产生 **594 条 >1% 历史版本偏差**（如北京 2015 年 `23,014.59` vs 五经普修订后 `26,034.1` 亿元）；③ 使用了非标准 19 列 CSV 且缺少 `EVALUATION.json`，Vercel 站点返回 HTTP 302（SSO 保护）。

### E. 其他关键发现（Muse Spark 1.3、Gemini、GPT-6.2、Codex）
- **Muse Spark 1.3（`F-003`, `F-007`）**：在 `higher_education_students` 中将**本专科在校生与在学研究生相加**（2024 年 `43,008,004` vs NBS/MOE 本专科 `38,912,568`，偏高 +10.5%），虽然在 `notes` 写了公式但混用了同一 `indicator_id`；另将 2015–2019 七普前城镇化率（`60.60%`）直接拼接至 2020 七普后（`63.89%`），制造了 +3.29 个百分点的虚假跳变（真实修订增幅为 +1.18pp）。
- **Gemini (Model Version Unavailable)（`F-004`, `F-005`, `F-008`）**：① 使用 ISO 代码（`CN-GD`）而非 GB/T 2260 6 位代码且缺少 `verification_status` 列；② 2024 年省级社零总额采自第一财经媒体报道（五经普前口径，浙江 `33,900` vs NBS `37,707.7` 差 10.1%）；③ 2000 年省级人口采用 11 月 1 日五普时点数而非年末常住人口；④ **证实 1 条硬性数值错误**：湖北 2024 年 65 岁及以上占比填为 `16.12%`，经核查国家数据原始样本 `10,385 / 60,048 = 17.29%`（偏差 6.77%）。
- **GPT-6.2（`F-010`）**：核验诚实度高（明确自报 0 个核心指标完整核验），但仅 184 条记录，2015 江苏人口采用七普前未修订值（`7,976.3` vs 修订后 `8,315` 万）。
- **Codex GPT-6 & Codex (1250)（`F-014`）**：两个 Drive 目录内均为 **0 个文件**，记为 `unavailable`。

---

## 2. 逐模型简洁独立评价

| 模型 | 最强 3 项成果 | 最重要 3 项问题 | 值得复用的数据/产品资产 | 可信度与维护风险 |
|---|---|---|---|---|
| **Grok Bot** | ① 11,229 条全量 NBS 官方数据（含 3 扩展指标）；② 严谨三层核验与 106 条跨源抽检；③ 104 项自动化测试与 10/10 验收。 | ① `physicians_per_1000` 用整值每万人丢 125 行且有舍入误差；② 无 GitHub 与线上预览部署；③ 2,413 行未核验且 NBS 客户端耦合 Playwright。 | 三层核验纪律、死亡率/自然增长率/城镇人口扩展、省统计局交叉核验源清单。 | 长期运行依赖无头浏览器抓取；扩展指标缺乏抽样复核。 |
| **Gemini 4 Neon (Self R1)** | ① 12/12 核心指标 9,110 条零错误 + 裸 HTTP 可复现 NBS 管道；② 唯一公网 HTTP 200 Vercel 部署 + GitHub PR/CI + Lighthouse 99 首页；③ 跨指标散点探索器 + 双轴趋势图。 | ① **P1 自审**：全部 9,110 行标为 `verified`（仅抽检 60 条）；② 缺少省份页、多版本历史与自动更新流水线；③ 指标页 Lighthouse 性能 77 且未标注 2002 医师口径断点。 | 裸 HTTP `publicrelease` 管道、按路由分片 JSON、合规七大区域矩阵、CI/Vercel 线上端到端测试。 | R1 核验标签过宽；ECharts 同步打包拖累指标页首屏。 |
| **Claude Opus 5.5** | ① 极高准确率的双 OCR 年鉴提取与 SHA-256 原始证据清单；② 业内最佳 `revision_note` 跨版次修订追溯；③ 极度坦诚的 `blockers.md` 与 `self_check.md`。 | ① 缺失 3/12 核心指标（社零、医师、床位）；② 2015–2023 GDP 为五经普前旧版本（594 处 >1% 偏差）；③ 非标准 19 列 CSV、无 `EVALUATION.json`、Vercel 返回 302 鉴权拦阻。 | `revision_note` 多版次记录、原始文件 SHA-256 清单、诚实披露规范。 | 年鉴图片 OCR 维护成本高且滞后于经济普查统一修订。 |
| **GPT-6 Astra Pro** | ① 最佳审计台账（新增 `original_value`/`original_unit`/`evidence_file`）；② 精准识别 2002 医师法定口径断点并接入《2024 卫健年鉴》；③ 168 项测试与公开 ChatGPT Sites 站点。 | ① 仅 1,416 条观测，历史连续性不足（GDP/教育/老龄化仅 33–57 行）；② 无 GitHub 仓库与 Vercel Preview；③ 9/10 验收（历史深度受限）。 | 审计扩展字段设计、NHC 卫健年鉴直接交叉验证、2002 医师断点文档。 | 人工/半自动证据转录模式难以扩展至 40+ 指标 26 年全量序列。 |
| **Gemini (Unavail)** | ① 12/12 指标覆盖与 1,526 条观测；② Next.js SSR + REST API 架构；③ 60 条抽样与 20 项浏览器测试。 | ① ISO 地区代码不合规且缺 `verification_status`；② 2024 省级社零用媒体报道（差最高 10.1%）；③ 湖北 2024 65+ 数值错误（16.12% vs 17.29%）且无公网部署。 | REST API 端点思路；为跨模型审计提供重要反面校验样本。 | 混入第三方媒体与五普时点数导致时间序列失真。 |
| **Muse Spark 1.3** | ① 严谨的 70/358 核验分级；② 详实的 Phase 5 测试与修复记录；③ 清晰的指标注释与防踩坑提示。 | ① `higher_education_students` 混入研究生（+10.5% 偏差）；② 拼接七普前/五经普前旧公报造成断层；③ 仅 428 条数据且未线上部署。 | 测试修复追踪习惯；直接促成 R2 本专科与研究生拆分设计。 | 手工摘录公报难以保持跨普查修订一致性。 |
| **GPT-6.2** | ① 极其克制诚实的覆盖与核验声明（自报 0 核心完全核验）；② 便携离线单文件 HTML；③ 单条高度可追溯。 | ① 仅 184 条记录、省级覆盖稀疏；② 重命名 `higher_education_students`；③ 江苏 2015 人口为七普前旧数且无公网部署。 | 极保守的验证伦理标准。 | 数据体量不足以支撑长期多省历史研究。 |
| **Codex GPT-6 & Codex 1250** | 两个 Drive 目录均为空（0 文件）。 | 无任何可审阅交付文件。 | 无。 | 交付缺失（`unavailable`）。 |
