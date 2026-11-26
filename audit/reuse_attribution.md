# Reuse & Attribution Log — China Data Atlas (R2)

本轮（Round 2）严格遵守只读研究与开源/同行致谢规范，未未经授权直接复制其他模型完整代码库，而是以**架构吸收、字段标准融合与问题规避**的方式整合各 Round 1 模型之长，特此逐项注明来源：

1. **继承自 Gemini 4 Neon (Self R1)**：
   - 裸 HTTP 国家数据 `publicrelease/web/external/stream/esData` 礼貌抓取模式（无需 Playwright 浏览器）；
   - Next.js 15 + Tailwind v4 + Apache ECharts 5 配置驱动指标页架构、按路由分片静态 JSON 与合规七大区域省级矩阵可视化框架；
   - GitHub Actions CI + 独立 Vercel Preview 自动化端到端验收流程。
2. **借鉴自 GPT-6 Astra Pro (R1)**：
   - 在 `data/canonical_candidate/observations.csv` 中正式引入 **`original_value`** 与 **`original_unit`** 审计字段，确保任何单位换算或派生比率均可在单行内直接还原官方原始值；
   - 采纳其发现的 **2002 年执业医师法定口径断点**说明（2002 年前为在岗医生，2002 年起为执业/助理医师证书口径），并将国家卫健委《2024 中国卫生健康统计年鉴》2000–2004 年全国直接公布值作为独立版本保留于 `vintages.csv`。
3. **借鉴自 Grok Bot (R1)**：
   - 借鉴其区分“直接独立核验 vs 批量同源入库”的验证纪律，并在 Round 2 进一步升级为 E0–E4 证据等级 + `extraction_method` 双轨体系；
   - 将其 Round 1 扩展的 3 项高价值人口指标（`death_rate`、`natural_growth_rate`、`urban_population`）一并纳入 Round 2 的 38+ 指标官方扩展体系（并补充独立抽样核验，解决 Grok R1 中这 3 项为 `unverified` 的遗留问题）。
4. **借鉴自 Claude Opus 5.5 (R1)**：
   - 借鉴其 `revision_note` 跨版次历史修订记录思路，在 Round 2 建立独立的 `data/canonical_candidate/vintages.csv` 三层版本表（保留五经普前 GDP、七普前出生率/城镇化率/人口等历史发布版本），并为其所有保留的原始 JSON 证据生成 SHA-256 校验清单（`data/input_manifest/raw_evidence_hashes.csv`）。
5. **受启发于 Muse Spark 1.3 & GPT-6.2 (R1)**：
   - 针对 Muse Spark 将研究生与本专科合并导致的 +10.5% 口径冲突，Round 2 严格将 `higher_education_students`（普通、职业本专科在校生）与新增 `postgraduate_students`（在学研究生）拆分并排展示，杜绝口径混淆。
