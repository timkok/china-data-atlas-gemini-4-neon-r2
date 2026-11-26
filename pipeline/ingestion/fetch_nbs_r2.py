#!/usr/bin/env python3
"""
Round 2 Reproducible Official Data Ingestion Pipeline — National Bureau of Statistics of China
Source: https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData

Fetches all National (code=3, showType="1") and 31-Province (code=6, showType="3") raw official
JSON responses for all 44 Round 2 indicators (2000-2025), computes SHA-256 digests into
data/input_manifest/raw_evidence_hashes.csv, and logs every access to reports/source_access_log.csv.
Zero login/CAPTCHA/WAF bypassing; polite sequential fetching with 0.4s spacing.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw" / "nbs_r2"
HTML_LOCAL_DIR = ROOT / "data" / "raw" / "nbs_html_local"
ACCESS_LOG_CSV = ROOT / "reports" / "source_access_log.csv"
HASH_MANIFEST_CSV = ROOT / "data" / "input_manifest" / "raw_evidence_hashes.csv"

BASE = "https://data.stats.gov.cn/dg/website/publicrelease/web/external"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Referer": "https://data.stats.gov.cn/dg/website/page.html",
    "Content-Type": "application/json;charset=UTF-8",
    "Accept": "application/json, text/plain, */*",
}

NATIONAL_ROOT_ID = "884c062607104a91967b22742537f44f"
PROVINCIAL_ROOT_ID = "c4d82af16c3d4f0cb4f09d4af7d5888e"
PROVINCIAL_DA_CATALOG_ID = "a10dceae75d245008bf4b9a0e6fe1d55"

FETCH_SPECS = [
    # ==================== NATIONAL (showType="1", 2000-2025) ====================
    {"key": "nat_population", "scope": "national", "table_name": "国家数据-全国年度-人口-总人口",
     "cid": "6331ad868e8b4f55b8e9b6e765609ce1",
     "indicatorIds": [
         "806083491dbe46a08995783945a30b9d",  # 年末总人口 (万人)
         "07e1e3444cd34c43b4fd749f060bba5f",  # 城镇人口 (万人)
         "2dd9894936d448fcb88605863d90d85c",  # 乡村人口 (万人)
     ]},
    {"key": "nat_vital_rates", "scope": "national", "table_name": "国家数据-全国年度-人口-出生率死亡率自然增长率",
     "cid": "ffed4267bba24830beea5991d4c9bcfc",
     "indicatorIds": [
         "3d4006d356d94bdd9d75700b9788e230",  # 人口出生率 (‰)
         "ee4b8be1ad68498e81d9ecddf4d4f2de",  # 人口死亡率 (‰)
         "3969129b26a846968a7dddff5f326f55",  # 人口自然增长率 (‰)
     ]},
    {"key": "nat_age_structure", "scope": "national", "table_name": "国家数据-全国年度-人口-人口年龄结构和抚养比",
     "cid": "c7743eefda9d44b5ad2ab0b4f29ba969",
     "indicatorIds": [
         "9f39d77c761d4824940fc3c23d8281b0",  # 年末总人口 (万人)
         "067f5f3ec585402e9f31037e5f27eb17",  # 0-14岁人口 (万人)
         "c2627d8e6b5843bfa3372bacdf858804",  # 65岁及以上人口 (万人)
         "9d77e24ce8c94679937b07188f4e7fbc",  # 老年抚养比 (%)
     ]},
    {"key": "nat_life_expectancy", "scope": "national", "table_name": "国家数据-全国年度-人口-人口平均预期寿命",
     "cid": "0f6150cfa670407ab4a81669b9ed9dbc",
     "indicatorIds": ["d5ebe43c9aa3402299bfc780c40c7cc8"]},
    {"key": "nat_gdp", "scope": "national", "table_name": "国家数据-全国年度-国民经济核算-国内生产总值",
     "cid": "f7fd25aaad184414875632cf2327da60",
     "indicatorIds": [
         "7dc6a2ee6c614960b7059991e0cc4d96",  # 国内生产总值 (亿元)
         "fb00df5cde1c41509e681eff1c10f387",  # 第一产业增加值 (亿元)
         "95f6ceb2e6d147da83c3c5ad6a2e8bde",  # 第二产业增加值 (亿元)
         "30966f1491de4744b6e21b76867e983f",  # 第三产业增加值 (亿元)
         "eb4d93f19d57495c89f98875e03e01be",  # 人均国内生产总值 (元)
     ]},
    {"key": "nat_income_all", "scope": "national", "table_name": "国家数据-全国年度-人民生活-全国居民人均收入",
     "cid": "d153132154a549a78363017ef74ca784",
     "indicatorIds": ["305bba1e881e413b91f32a06a4be65fd"]},
    {"key": "nat_income_urban", "scope": "national", "table_name": "国家数据-全国年度-人民生活-城镇居民人均收入",
     "cid": "d310e3ead14b403d9d10d29391713783",
     "indicatorIds": ["c0908d6012a840dca82d2b362f7e2d69"]},
    {"key": "nat_income_rural", "scope": "national", "table_name": "国家数据-全国年度-人民生活-农村居民人均收入",
     "cid": "7bd16d8e47ee44109280d7e8ce4cafe9",
     "indicatorIds": ["b5040ecf88fd469591909ee04df59147"]},
    {"key": "nat_consumption", "scope": "national", "table_name": "国家数据-全国年度-人民生活-全国居民人均消费支出",
     "cid": "47e188eb48a840e4b7ee00c1d30a4792",
     "indicatorIds": ["aae3499756ee4863a472d1bbf191b471"]},
    {"key": "nat_retail_sales", "scope": "national", "table_name": "国家数据-全国年度-社会消费品零售总额",
     "cid": "d5b51c4a56d646b3b3f00f2c9e31a217",
     "indicatorIds": ["008350880eb14928acc53fe20b295415"]},
    {"key": "nat_wage", "scope": "national", "table_name": "国家数据-全国年度-就业工资-城镇非私营单位平均工资",
     "cid": "0aed53df47b14e7393a98718a320e238",
     "indicatorIds": ["759f53b2b5204c3d9dce7683db504576"]},
    {"key": "nat_fiscal", "scope": "national", "table_name": "国家数据-全国年度-财政-一般公共预算收支总额",
     "cid": "9ab4eeaba2264792b296b6658b6472dc",
     "indicatorIds": [
         "47768ef2d84343468356fcaf26fef62f",  # 一般公共预算收入 (亿元)
         "bd7a970226ff40a8b030c6b9a912560b",  # 一般公共预算支出 (亿元)
     ]},
    {"key": "nat_cpi", "scope": "national", "table_name": "国家数据-全国年度-价格指数-居民消费价格指数",
     "cid": "e5f37eced5de4d4c815f7ac5f59fc6c2",
     "indicatorIds": ["5e3053f110074dcdbcfa3c8428dd1367"]},
    {"key": "nat_edu_students", "scope": "national", "table_name": "国家数据-全国年度-教育-各级各类学历教育在校学生数",
     "cid": "cd6c5a735b7940aabdd7314dd97a1c69",
     "indicatorIds": [
         "864006d4253a4614a51bd355181775ed",  # 普通、职业本专科在校学生数 (万人)
         "43f162d3cc8f44c182b1513602a65d99",  # 研究生在校学生数 (万人)
         "498b7f1263f64afbb317c30361116c6a",  # 普通高中在校学生数 (万人)
         "3b57e38ca40f4bca9092f119922b43b3",  # 普通小学在校学生数 (万人)
     ]},
    {"key": "nat_edu_institutions", "scope": "national", "table_name": "国家数据-全国年度-教育-各级各类学校数",
     "cid": "eced9df6672943b983817ac63d29367d",
     "indicatorIds": ["8773f2871f904c4ab6312adb322aa3fc"]},
    {"key": "nat_rd_ind", "scope": "national", "table_name": "国家数据-全国年度-科技-规上工业企业R&D经费",
     "cid": "856b3e67a9da4913a4f0655eb0adba69",
     "indicatorIds": ["870da46092ba495383dda9dc9a468a67"]},
    {"key": "nat_patents", "scope": "national", "table_name": "国家数据-全国年度-科技-国内三种专利授权量",
     "cid": "60db3c31480d47e1b885f7c424b3913b",
     "indicatorIds": ["e9657218d8ba4770b0460d66a7b402b4"]},
    {"key": "nat_health_personnel", "scope": "national", "table_name": "国家数据-全国年度-卫生-卫生人员",
     "cid": "27fd1733fe6f4503aae77fb53d42b871",
     "indicatorIds": [
         "4b21604ce7644da1b9bb38eb044ae1a1",  # 执业(助理)医师数 (万人)
         "a59eb49cd8204ce7b18cca711737a0fa",  # 注册护士数 (万人)
     ]},
    {"key": "nat_health_per10k", "scope": "national", "table_name": "国家数据-全国年度-卫生-每万人口卫生技术人员数",
     "cid": "84b47ee0c42d4a568746fdfd3cc19744",
     "indicatorIds": [
         "1c419cf4a13f40f69a3476500e17c841",  # 每万人拥有执业(助理)医师数 (人)
         "1ef5cffc42364fc5aeb0faf9476b6b8a",  # 每万人拥有注册护士数 (人)
     ]},
    {"key": "nat_health_beds", "scope": "national", "table_name": "国家数据-全国年度-卫生-医疗卫生机构床位",
     "cid": "5eeed2da1ee748a1a035d3a6608ece67",
     "indicatorIds": ["bb0d2ff0b33441bbbf023b15803db641"]},
    {"key": "nat_health_institutions", "scope": "national", "table_name": "国家数据-全国年度-卫生-医疗卫生机构数",
     "cid": "e4a03f31f25c4d20823b6c2aec862df2",
     "indicatorIds": ["ecc1c2212e8a4beaa36f503cd602ceea"]},
    {"key": "nat_hospital_utilization", "scope": "national", "table_name": "国家数据-全国年度-卫生-医院病床使用率",
     "cid": "b7ff054466ac4c018b907ffde5d96eaf",
     "indicatorIds": ["dd4d569d37e0481cb15fb4e1773e3516"]},
    {"key": "nat_electricity", "scope": "national", "table_name": "国家数据-全国年度-能源-电力消费总量",
     "cid": "165b02e413b744a9976d4519eb5dd4f9",
     "indicatorIds": ["06683cfca8ef49f1af8a217fd09ce294"]},
    {"key": "nat_water", "scope": "national", "table_name": "国家数据-全国年度-资源环境-人均水资源量",
     "cid": "6634d2726b30408aada183324c19e077",
     "indicatorIds": ["9a3f32f8fbcd4401be2ce0b400d82a59"]},
    {"key": "nat_forest", "scope": "national", "table_name": "国家数据-全国年度-资源环境-森林覆盖率",
     "cid": "b4405904ff764bf0a4f49abef03a968c",
     "indicatorIds": ["1d520d4e58254f61917e152923cd53ce"]},
    {"key": "nat_highway", "scope": "national", "table_name": "国家数据-全国年度-运输邮电-公路里程",
     "cid": "69120b43489c4447854edaef32de4894",
     "indicatorIds": ["67f763444a9848e5a892c68570a6a45d"]},
    {"key": "nat_private_cars", "scope": "national", "table_name": "国家数据-全国年度-运输邮电-私人汽车拥有量",
     "cid": "e51edc97572d4bfb973cd4ef1621645f",
     "indicatorIds": ["72996389ae51432a892cb91f9392d9df"]},

    # ==================== PROVINCIAL (showType="3", all 31 provinces, 1 indicator per POST) ====================
    # Demographics (11)
    {"key": "prov_population", "scope": "provincial", "table_name": "国家数据-分省年度-人口-年末常住人口",
     "cid": "755d5f6efbcf41a6a411ad819aa93c17", "indicatorIds": ["4810ad6e9ddc41fc804a66134afe587f"]},
    {"key": "prov_urban_pop", "scope": "provincial", "table_name": "国家数据-分省年度-人口-城镇人口",
     "cid": "755d5f6efbcf41a6a411ad819aa93c17", "indicatorIds": ["1cca167b5743463886f3c18e4a4ae934"]},
    {"key": "prov_rural_pop", "scope": "provincial", "table_name": "国家数据-分省年度-人口-乡村人口",
     "cid": "755d5f6efbcf41a6a411ad819aa93c17", "indicatorIds": ["019c928598b44bb7a5fb52d8a9485175"]},
    {"key": "prov_birth_rate", "scope": "provincial", "table_name": "国家数据-分省年度-人口-人口出生率",
     "cid": "05d3864c379f469292a08f7061e59562", "indicatorIds": ["9e94affdd1484380b721710ddd17e93e"]},
    {"key": "prov_death_rate", "scope": "provincial", "table_name": "国家数据-分省年度-人口-人口死亡率",
     "cid": "05d3864c379f469292a08f7061e59562", "indicatorIds": ["1efd92374d9043a491b4d30bf9f3678f"]},
    {"key": "prov_natural_growth_rate", "scope": "provincial", "table_name": "国家数据-分省年度-人口-人口自然增长率",
     "cid": "05d3864c379f469292a08f7061e59562", "indicatorIds": ["85cd7d1210294d3d9350f7dc5d7f65b6"]},
    {"key": "prov_sample_total_pop", "scope": "provincial", "table_name": "国家数据-分省年度-人口抽样调查-总人口样本",
     "cid": "5a4602c60d764cc6adc7d88d9b512efc", "indicatorIds": ["cf6fe2ed074745648a1a5114e1e5594c"]},
    {"key": "prov_sample_0_14_pop", "scope": "provincial", "table_name": "国家数据-分省年度-人口抽样调查-0-14岁样本",
     "cid": "5a4602c60d764cc6adc7d88d9b512efc", "indicatorIds": ["c5ef6db9cb894f8f8402e0d0bccee615"]},
    {"key": "prov_sample_65plus_pop", "scope": "provincial", "table_name": "国家数据-分省年度-人口抽样调查-65岁及以上样本",
     "cid": "5a4602c60d764cc6adc7d88d9b512efc", "indicatorIds": ["7c25a7d860b7449ea612223ad2d749c0"]},
    {"key": "prov_old_age_dep", "scope": "provincial", "table_name": "国家数据-分省年度-人口抽样调查-老年人口抚养比",
     "cid": "5a4602c60d764cc6adc7d88d9b512efc", "indicatorIds": ["d65bc0f04b2e4f3aac70a02c33ce7e56"]},
    {"key": "prov_life_expectancy", "scope": "provincial", "table_name": "国家数据-分省年度-人口-平均预期寿命",
     "cid": "96c74b9bdfcf480192ff566bffc50bb0", "indicatorIds": ["292f0860a4c944bfab80e61eae661059"]},

    # Economy, Living Standards & Fiscal (16)
    {"key": "prov_gdp", "scope": "provincial", "table_name": "国家数据-分省年度-国民经济核算-地区生产总值",
     "cid": "6f8fbd415cbc40ffa7ecb7fd917f2598", "indicatorIds": ["aff57de5ee994283974705914fbed246"]},
    {"key": "prov_gdp_primary", "scope": "provincial", "table_name": "国家数据-分省年度-国民经济核算-第一产业增加值",
     "cid": "6f8fbd415cbc40ffa7ecb7fd917f2598", "indicatorIds": ["615ce248396a4a5fa52bca05f0633e95"]},
    {"key": "prov_gdp_secondary", "scope": "provincial", "table_name": "国家数据-分省年度-国民经济核算-第二产业增加值",
     "cid": "6f8fbd415cbc40ffa7ecb7fd917f2598", "indicatorIds": ["b8e109ec8d3f465fa39a0de909f730b3"]},
    {"key": "prov_gdp_tertiary", "scope": "provincial", "table_name": "国家数据-分省年度-国民经济核算-第三产业增加值",
     "cid": "6f8fbd415cbc40ffa7ecb7fd917f2598", "indicatorIds": ["b6ede904e72c41bba796c98d185e62c5"]},
    {"key": "prov_gdp_per_capita", "scope": "provincial", "table_name": "国家数据-分省年度-国民经济核算-人均地区生产总值",
     "cid": "6f8fbd415cbc40ffa7ecb7fd917f2598", "indicatorIds": ["779b419f7be14d8f823e5e61810a4909"]},
    {"key": "prov_disposable_income", "scope": "provincial", "table_name": "国家数据-分省年度-人民生活-全体居民人均可支配收入",
     "cid": "5c072e1073514e448de4132760308fcf", "indicatorIds": ["bda568266e4c445b867d25626e1f6b8a"]},
    {"key": "prov_urban_income", "scope": "provincial", "table_name": "国家数据-分省年度-人民生活-城镇居民人均可支配收入",
     "cid": "5c072e1073514e448de4132760308fcf", "indicatorIds": ["dd28563a8af84935bc8a010abf8b772c"]},
    {"key": "prov_rural_income", "scope": "provincial", "table_name": "国家数据-分省年度-人民生活-农村居民人均可支配收入",
     "cid": "5c072e1073514e448de4132760308fcf", "indicatorIds": ["5b21e9a08bf74a5c8ba184eb9e9cc195"]},
    {"key": "prov_consumption", "scope": "provincial", "table_name": "国家数据-分省年度-人民生活-全体居民人均消费支出",
     "cid": "7dbebcca62794c4da2b9ef9813d14564", "indicatorIds": ["462f6c41041b4721b78e50397b358af8"]},
    {"key": "prov_retail_sales", "scope": "provincial", "table_name": "国家数据-分省年度-社会消费品零售总额",
     "cid": "77cb81a53dd9438ab00f6b4f27196ad9", "indicatorIds": ["3512aeee72d74be7b4008817a4dd2d03"]},
    {"key": "prov_wage", "scope": "provincial", "table_name": "国家数据-分省年度-就业工资-城镇单位就业人员平均工资",
     "cid": "1e46e1057756495e856bd8fcd64598e2", "indicatorIds": ["2892a327f289418ca0719fec09c712ea"]},
    {"key": "prov_fiscal_revenue", "scope": "provincial", "table_name": "国家数据-分省年度-财政-地方财政一般公共预算收入",
     "cid": "bcd3d7159957431b8f3f5b7d10bdeceb", "indicatorIds": ["c8dafa31105e4b93850f3820cdd4eae8"]},
    {"key": "prov_fiscal_expenditure", "scope": "provincial", "table_name": "国家数据-分省年度-财政-地方财政一般公共预算支出",
     "cid": "f38245648b504602b851e27257f09d9b", "indicatorIds": ["1bc776bc77b44671a8f332fa80587fe2"]},
    {"key": "prov_cpi", "scope": "provincial", "table_name": "国家数据-分省年度-价格指数-居民消费价格指数",
     "cid": "d1345232d611428bb56474a4f9ce848d", "indicatorIds": ["dc68d688633d4806b3034821f0a3482d"]},

    # Education & Innovation (6 provincial)
    {"key": "prov_higher_ed_students", "scope": "provincial", "table_name": "国家数据-分省年度-教育-普通职业本专科在校生",
     "cid": "0d32f3c3fd114f1db7e30d0f3bc1e92d", "indicatorIds": ["c5a2f7741d934a1cb5471ef52044f810"]},
    {"key": "prov_higher_ed_institutions", "scope": "provincial", "table_name": "国家数据-分省年度-教育-普通职业高等学校数",
     "cid": "0d32f3c3fd114f1db7e30d0f3bc1e92d", "indicatorIds": ["620087c18a424d959f86e557be1472fe"]},
    {"key": "prov_senior_high_students", "scope": "provincial", "table_name": "国家数据-分省年度-教育-普通高中在校生",
     "cid": "8344b89313de4af1b4611e192fe51883", "indicatorIds": ["5bf3ed00a9e843ff94480abcf6a51b81"]},
    {"key": "prov_primary_students", "scope": "provincial", "table_name": "国家数据-分省年度-教育-普通小学在校生",
     "cid": "8194ce2ed2944974893b1708d206f927", "indicatorIds": ["1d27d01ecebc440897aaaf88099d4141"]},
    {"key": "prov_rd_ind", "scope": "provincial", "table_name": "国家数据-分省年度-科技-规上工业企业R&D经费",
     "cid": "f5ce874ae7164343a401b75d46809e60", "indicatorIds": ["e622487466704fd789a175641018fc8c"]},
    {"key": "prov_patents", "scope": "provincial", "table_name": "国家数据-分省年度-科技-国内专利申请授权量",
     "cid": "3ac6344551e04aefbcb26f7966d280a0", "indicatorIds": ["053bd4bf7d4b46e6bc769e4b8525823c"]},

    # Healthcare (6 provincial raw tables -> 5 indicators + per10k vintage)
    {"key": "prov_physicians_total", "scope": "provincial", "table_name": "国家数据-分省年度-卫生-执业助理医师数",
     "cid": "c990bce9913e47a2b6fc1c6eb596b411", "indicatorIds": ["320685cb8c8045b1bd60a261a1dabe12"]},
    {"key": "prov_physicians_per10k", "scope": "provincial", "table_name": "国家数据-分省年度-卫生-每万人拥有执业助理医师数",
     "cid": "e469513e184d43109318f06a51cb436e", "indicatorIds": ["c125142d51464f0fb9c82cc852d011fc"]},
    {"key": "prov_nurses_total", "scope": "provincial", "table_name": "国家数据-分省年度-卫生-注册护士数",
     "cid": "c990bce9913e47a2b6fc1c6eb596b411", "indicatorIds": ["a06a5cf86355406088309d261fc33e03"]},
    {"key": "prov_hospital_beds_total", "scope": "provincial", "table_name": "国家数据-分省年度-卫生-医疗卫生机构床位数",
     "cid": "5a83b0cc3d634774920fa41d656c478e", "indicatorIds": ["3b50b8cc0fe64e2fb3b91e344d2388d6"]},
    {"key": "prov_hospital_beds_per10k", "scope": "provincial", "table_name": "国家数据-分省年度-卫生-每万人医疗机构床位数",
     "cid": "abc171a8126647abbc1d8b0c69512b12", "indicatorIds": ["393831aacb9c4f428f2acb470d8c86af"]},
    {"key": "prov_health_institutions", "scope": "provincial", "table_name": "国家数据-分省年度-卫生-医疗卫生机构数",
     "cid": "6daeacc4807842718422ab8171525946", "indicatorIds": ["e2be9010acfe49549f1bf081458905a9"]},
    {"key": "prov_hospital_utilization", "scope": "provincial", "table_name": "国家数据-分省年度-卫生-医院病床使用率",
     "cid": "f38b5b3f3c6c44d99ab1df89c6774645", "indicatorIds": ["af63a3e8d78f45c6b8e587ec0529e778"]},

    # Energy, Environment & Infrastructure (5 provincial)
    {"key": "prov_electricity", "scope": "provincial", "table_name": "国家数据-分省年度-能源-电力消费量",
     "cid": "ccc1ef64e4a0485f840cd5f6fa192097", "indicatorIds": ["808cac47e5824d1f91af38c0962a336b"]},
    {"key": "prov_water", "scope": "provincial", "table_name": "国家数据-分省年度-资源环境-人均水资源量",
     "cid": "23a72a19bd3a4206a2cdd63aeefd77b4", "indicatorIds": ["56462963ef944c6297f411257dae8b8e"]},
    {"key": "prov_forest", "scope": "provincial", "table_name": "国家数据-分省年度-资源环境-森林覆盖率",
     "cid": "1f8851c9c718459d8040e7cae3b70f14", "indicatorIds": ["37572106fcdb49909789b122f9c08d94"]},
    {"key": "prov_highway", "scope": "provincial", "table_name": "国家数据-分省年度-运输邮电-公路里程",
     "cid": "d180695e985243c994eef6a7c3e58090", "indicatorIds": ["e56b0012f8c94a00bc16b040310561b0"]},
    {"key": "prov_private_cars", "scope": "provincial", "table_name": "国家数据-分省年度-运输邮电-私人汽车拥有量",
     "cid": "eea9014e5ac3458a9b98a9d11a74bb41", "indicatorIds": ["5a3ca38329444466b94d708d5048105d"]},
]

HTML_SOURCES = [
    ("communique_2025.html", "NBS_COMMUNIQUE_2025", "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html"),
    ("census7_bulletin5.html", "NBS_CENSUS7_B5", "https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902005.html"),
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-fetch all JSON files")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    HTML_LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    ACCESS_LOG_CSV.parent.mkdir(parents=True, exist_ok=True)
    HASH_MANIFEST_CSV.parent.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(HEADERS)

    access_logs: list[dict] = []
    hash_rows: list[dict] = []

    # 1. Fetch official HTML communiques into local non-redistributed cache
    for fname, sid, url in HTML_SOURCES:
        dest = HTML_LOCAL_DIR / fname
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if dest.exists() and not args.force:
            status = "cached_success"
            code = 200
        else:
            r = requests.get(url, headers={"User-Agent": HEADERS["User-Agent"]}, timeout=30)
            code = r.status_code
            if code == 200 and len(r.content) > 2000:
                dest.write_bytes(r.content)
                status = "success"
            else:
                status = f"http_{code}"
            time.sleep(0.5)
        access_logs.append({
            "timestamp_utc": ts, "source_id": sid, "url": url, "method": "GET",
            "http_status": code, "result": status, "records_fetched": 1 if dest.exists() else 0,
            "notes": f"Official NBS HTML saved locally (excluded from public git redistribution per DATA_RIGHTS_REVIEW.md): {fname}",
        })
        if dest.exists():
            hash_rows.append({
                "file_key": fname, "source_id": sid, "url": url,
                "local_path": str(dest.relative_to(ROOT)), "redistributed_in_repo": "false",
                "bytes": dest.stat().st_size, "sha256": sha256_file(dest), "retrieved_at_utc": ts,
            })

    # 2. Fetch all 69 NBS JSON payloads (27 national + 42 provincial)
    total_cells = 0
    errors = 0
    for idx, spec in enumerate(FETCH_SPECS, 1):
        is_nat = spec["scope"] == "national"
        out_path = RAW_DIR / f"{spec['key']}.json"
        if out_path.exists() and not args.force:
            saved = json.loads(out_path.read_text(encoding="utf-8"))
            val_cnt = sum(len(y.get("values", [])) for y in saved.get("response", {}).get("data", []))
            total_cells += val_cnt
            access_logs.append({
                "timestamp_utc": saved.get("retrieved_at", ""),
                "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
                "url": f"{BASE}/stream/esData", "method": "POST", "http_status": 200,
                "result": "cached_success", "records_fetched": val_cnt,
                "notes": f"{spec['table_name']} (cid={spec['cid']})",
            })
            hash_rows.append({
                "file_key": spec["key"], "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
                "url": f"{BASE}/stream/esData", "local_path": str(out_path.relative_to(ROOT)),
                "redistributed_in_repo": "true", "bytes": out_path.stat().st_size,
                "sha256": sha256_file(out_path), "retrieved_at_utc": saved.get("retrieved_at", ""),
            })
            continue

        payload = {
            "cid": spec["cid"],
            "indicatorIds": spec["indicatorIds"],
            "daCatalogId": "" if is_nat else PROVINCIAL_DA_CATALOG_ID,
            "das": [{"text": "全国", "value": "000000000000"}] if is_nat else [{"text": "北京市", "value": "110000000000"}],
            "showType": "1" if is_nat else "3",
            "dts": ["2000YY-2025YY"],
            "rootId": NATIONAL_ROOT_ID if is_nat else PROVINCIAL_ROOT_ID,
        }
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            r = session.post(f"{BASE}/stream/esData", json=payload, timeout=30)
            if r.status_code != 200:
                errors += 1
                print(f"[{idx:02d}/{len(FETCH_SPECS)}] ERROR {spec['key']} HTTP {r.status_code}")
                access_logs.append({
                    "timestamp_utc": ts, "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
                    "url": f"{BASE}/stream/esData", "method": "POST", "http_status": r.status_code,
                    "result": "error", "records_fetched": 0, "notes": r.text[:120],
                })
                time.sleep(0.8)
                continue
            data = r.json()
            years_data = data.get("data", [])
            non_empty = [v for y in years_data for v in y.get("values", []) if str(v.get("value", "")).strip() not in ("", "None", "null")]
            total_cells += len(non_empty)
            envelope = {
                "key": spec["key"], "scope": spec["scope"], "table_name": spec["table_name"],
                "cid": spec["cid"], "retrieved_at": ts, "request_payload": payload, "response": data,
            }
            out_path.write_text(json.dumps(envelope, ensure_ascii=False), encoding="utf-8")
            print(f"[{idx:02d}/{len(FETCH_SPECS)}] OK {spec['key']:30s} -> {len(non_empty):4d} non-empty cells")
            access_logs.append({
                "timestamp_utc": ts, "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
                "url": f"{BASE}/stream/esData", "method": "POST", "http_status": 200,
                "result": "success", "records_fetched": len(non_empty),
                "notes": f"{spec['table_name']} (cid={spec['cid']})",
            })
            hash_rows.append({
                "file_key": spec["key"], "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
                "url": f"{BASE}/stream/esData", "local_path": str(out_path.relative_to(ROOT)),
                "redistributed_in_repo": "true", "bytes": out_path.stat().st_size,
                "sha256": sha256_file(out_path), "retrieved_at_utc": ts,
            })
        except Exception as exc:
            errors += 1
            print(f"[{idx:02d}/{len(FETCH_SPECS)}] EXC {spec['key']}: {exc}")
        time.sleep(0.4)

    with ACCESS_LOG_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["timestamp_utc", "source_id", "url", "method", "http_status", "result", "records_fetched", "notes"])
        w.writeheader()
        w.writerows(access_logs)

    with HASH_MANIFEST_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["file_key", "source_id", "url", "local_path", "redistributed_in_repo", "bytes", "sha256", "retrieved_at_utc"])
        w.writeheader()
        w.writerows(hash_rows)

    print(f"\nDONE: {len(FETCH_SPECS)} NBS specs processed, {total_cells:,} non-empty cells, {errors} errors.")


if __name__ == "__main__":
    main()
