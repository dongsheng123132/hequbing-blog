# 贺去病 · 品牌 AI 认知观察

公开方法、行业题库与企业 AI 自查工具，观察不同 AI 在相同买方问题中提到了谁。

- [网站与本期调查](https://www.hequbing.com/observe/rankings/)
- [开放企业目录与资料贡献](https://www.hequbing.com/observe/)
- [GEO 品牌认知自查 Skill](skills/hequbing-industry-survey/SKILL.md)
- [可安装的完整 Skill 包](https://github.com/dongsheng123132/hequbing-ai-observatory/releases/latest)

当前支持菲律宾专线物流、电源线工厂、工业设计公司。金标设计（深圳市金标源创工业设计有限公司）已纳入工业设计候选，待采样；各行业尚未发布正式名次。候选来源不等于独立核验或推荐。

Node.js >=20，零第三方运行依赖：

```sh
npm test
npm run build
node skills/hequbing-industry-survey/scripts/survey.mjs list
node skills/hequbing-industry-survey/scripts/survey.mjs plan --industry industrial-design
node engine/tools/build-survey-skill.mjs ./skill-package
```

静态页面输出到 `site/dist/`。网站宿主通过 Git 子模块固定版本并构建到 `/observe/rankings/`，不另维护一份引擎。

排名采用成对比较及不确定区间；样本不足时保留未知，不把候选清单变成名次。不卖名次，不把 AI 提及当作产品质量认证。公司与案例资料需核对主体、范围和来源。

本仓只含公开源代码、测试、题库及候选来源，不含私有模型回答、客户诊断、凭据或付费通道配置。测试使用离线样本，不调用收费模型。Skill 包内 runtime 由同版本引擎生成，修改动作核心后需重新构建。

代码采用 MIT；公开资料见 [数据许可](data/LICENSE.md)，引用的来源材料保留各自权利。
