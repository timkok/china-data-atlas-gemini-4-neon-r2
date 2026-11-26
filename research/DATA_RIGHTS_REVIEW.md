# Data Rights, Terms of Service & Redistribution Review — China Data Atlas (R2)

- **审查日期（UTC）**：2026-11-24
- **审查原则**：严格区分「数据真实性已核实」「原始来源允许合法访问」「是否具备公开再发布许可」三项独立属性（符合 Round 1 §4.3 与 Round 2 §13 要求）。

---

## 1. 主要官方来源条款核查

| 来源机构 | 官方 URL | 真实性核验 | 合法公开访问 | 再发布许可状态 (`redistribution_status`) | 关键条款与限制摘要 |
|---|---|---|---|---|---|
| **国家统计局（国家数据 & 官网）** | `https://www.stats.gov.cn/wzgl/202302/t20230217_1912857.html` (`服务条款`, 2022-09-02) | `true` | `true`（匿名公开接口，未绕过登录/验证码） | `attribution_required_noncommercial_review` | 允许用户依法下载和使用发布的统计数据，允许以**新闻性或资料性公共免费信息**为目的善意引用并显著注明「国家统计局网站 / www.stats.gov.cn」；禁止歪曲原意、禁止复制官网特有图形/标志/页面编排/程序，且**不得擅自同意他人继续转载引用**。 |
| **国务院第七次全国人口普查办公室** | `https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902005.html` | `true` | `true` | `attribution_required_noncommercial_review` | 政务公开普查公报，遵循国家统计局网站服务条款。本仓库**不公开发布原始 HTML 网页模板**，仅保留结构化统计事实、官方定位与可复现下载脚本。 |
| **中华人民共和国教育部** | `https://www.moe.gov.cn/` | `true` | `true` | `reference_verification_only` | 2024 年全国教育事业发展统计公报用于独立交叉验证（E3 核验），显著注明出处。 |
| **国家卫生健康委员会** | `https://www.nhc.gov.cn/` | `true` | `true` | `reference_verification_only` | 2024 年卫生健康事业发展统计公报及《2024 中国卫生健康统计年鉴》用于独立交叉验证与 2002 医师断点标注。 |

---

## 2. 本轮合规执行边界
1. **不宣称 CC0 / 商业无限制许可**：平台页面、数据字典与 `EVALUATION.json` 均诚实标注 `attribution_required_noncommercial_review`，并提醒商业再分发使用者须另行完成法务复核。
2. **排除 NBS 网页版式与受限原始材料**：GitHub 公开仓库、ZIP 与 Drive 仅分发标准化事实数值表、数据字典、可复现获取代码与必要结构化 JSON 响应证据，**排除 `www.stats.gov.cn` 原始网页 HTML/CSS 排版文件**（另提供 `fetch_nbs_html.py` 供评审员自行从官网直连验证）。
3. **不重复打包其他 Round 1 模型的原始交付**：仅在 `data/input_manifest/round1_files_manifest.csv` 中保留准确 Drive 文件 ID、路径、大小与 SHA-256 哈希，不侵占或重复分发其他模型的源码/原始文件。
4. **显著来源署名与单条溯源**：站点页脚、方法页、每张图表及每条 CSV 下载记录均强制保留 `source_agency`、`source_url`、`source_table`、`source_locator`、`evidence_level` 与推荐引用格式。
