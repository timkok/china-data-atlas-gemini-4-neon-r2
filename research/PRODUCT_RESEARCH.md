# Round 2 Product Research — China Data Atlas (R2)

- **研究日期（UTC）**：2026-11-24
- **实际浏览器访问 URL（全部经宿主验证 HTTP 200，无登录/反爬绕过）**：
  - `https://themapsdaily.com/posts/in-birth-rate`
  - `https://ourworldindata.org/`
  - `https://ourworldindata.org/explorers/population-and-demography?indicator=Population&Sex=Both+sexes&Age=Total&Projection+scenario=None&country=CHN~IND~USA~IDN~PAK~NGA~BRA~JPN`
  - `https://ourworldindata.org/country/china`（重定向至 `https://ourworldindata.org/search?countries=China`）
  - `https://ourworldindata.org/grapher/population`
  - 线上 Round 1 网站检查：`https://china-data-atlas-gemini-4-neon-r1.vercel.app/`（HTTP 200）、`https://china-data-atlas-gpt6-astra-r1-20261123.tian-liao-4133.chatgpt.site/`（HTTP 200）、`https://china-data-atlas-claude-cgc0nwahr-timkok621-1320.vercel.app/`（HTTP 302 SSO 保护）。

---

## 1. 对标深度拆解：单个指标页与研究工作流

### 1.1 The Maps Daily (`/posts/in-birth-rate`)
- **卓越之处**：
  1. **问题驱动的阅读动线**：*How big is it? → Where is it highest? → How has it changed? → Who moved most since 2018? → Zone Breakdown → Look up any state → Data Explorer → Sources & Methodology*。
  2. **区域中位数 + 基准线**：6 大区域不仅列最高邦，还给出区域中位数与全国均值对比。
  3. **透明数据质量评分卡**：显式列出 5 条检查项与 2015 年 PDF 错行手工修复说明。
- **我们实测识别出的 5 处研究级短板（Round 2 明确超越点）**：
  1. **无地区/省份综合档案页**：36 邦数据表内 0 个跳转链接，无法下钻查看某个地区的跨领域全貌 → **R2 新增 `/provinces/[code]` 31 省独立研究档案页**。
  2. **无跨指标关联分析**：相关指标仅是外链，无法同屏做散点图或相关性分析 → **R2 升级统一 `/explore`（散点/气泡/折线/条形/指数化 2015=100/CAGR/分布 + 多省多指标同步 CSV）**。
  3. **无指数化（Base=100）与对数坐标**：趋势图仅展示原始值 → **R2 指标引擎支持 绝对值 / 同比变化率 / 基准年=100 指数化 + 线性/对数坐标切换**。
  4. **无历史版本与修订对比**：不展示五经普/七普前后修订差异 → **R2 内置 Vintage 版本抽屉与 `/audit` 跨模型冲突裁决视图**。
  5. **编辑文案与数据偶发边界出入**：文内写“4 升 30 降”（合计 34）与 36 个当前邦/属地存在 2 个未解释差额 → **R2 所有摘要与 Data Stories 数值 100% 由标准化数据集动态计算生成**。

### 1.2 Our World in Data (`Explorer` / `Grapher` / `Country Profile`)
- **卓越之处**：
  - `Table / Map / Line / Bar` 一键切换 + `Linear / Logarithmic` + `Relative change`；
  - 下载中心区分 `Full data` 与 `Displayed data`，提供可复制引用与 API 元数据；
  - 国家页（`/country/china`）按 10 大领域卡片展示最新核心数字与同行国家对比。
- **Round 2 吸收与本土化创新**：
  - 吸收 OWID 的**多视图统一引擎**（空间矩阵 / 历史趋势 / 省级排名 / 完整数据表）、**线性/对数 & 指数化切换**、以及**按领域分组的 31 省独立研究页**；
  - 结合中国国情增加**E0–E4 证据分级徽章**、**2002 医师断点 / 2013 城乡一体化 / 2020 七普 / 2024 五经普版本标记**，以及**确定性 Research Query Engine（`/assistant`）**，让非统计背景用户可直接提问获得基于数据库的公式、来源与图表。

---

## 2. Round 1 → Round 2 产品实质升级矩阵

| 维度 | Round 1 (Gemini 4 Neon) | Round 2 实质升级 |
|---|---|---|
| **信息架构** | 首页 + 12 指标 + 散点探索 + 方法页 | **发现型研究门户**：首页 + **38+ 指标引擎** + **31 省独立页 (`/provinces/[code]`)** + **多省对比 (`/compare`)** + **高级统一 Explorer (`/explore`)** + **6 篇可复现 Data Stories (`/stories`)** + **Research Query Engine (`/assistant`)** + **审计与冲突中心 (`/audit`)** |
| **指标引擎** | 矩阵 + 折线 + 排名 + 区域 + CSV | 新增 **绝对值/变化率/指数化(Base=100)**、**线性/对数坐标**、**最新 vs 完整可比年切换**、**E0–E4 证据等级过滤**、**多版本修订抽屉 (Vintages)**、**异常值与分布统计** |
| **首屏性能** | 首页 Lighthouse 99，但指标页 77（ECharts 同步打包） | ECharts **动态懒加载 (`next/dynamic` ssr:false)** + 轻量化指标切片，指标页 Lighthouse Performance 目标 **≥ 90** |
| **数据透明度** | 全部标 `verified`（过宽）；无版本层 | 严格 **E0–E4 × extraction_method** 双轨标注、三层（Observation / Source / Vintage）仓库、公开跨模型冲突裁决记录 |
