# 贺去病 · GEO 品牌认知自查

「贺去病 · 品牌 AI 认知榜」的免费自查入口：AI brand visibility / GEO audit / competitor analysis。覆盖菲律宾专线物流、电源线工厂、工业设计公司，帮助老板的 AI 核对提及、同行差异与官网资料；不自动生成公开行业名次。Node.js >=20，零依赖；使用方法见 [SKILL.md](SKILL.md)。

安装分发包后运行 `node scripts/survey.mjs list`。题库和报告计算离线运行；本包不提供自动付费采样或收款。

开发树的动作核心在 `engine/src/survey-actions.js`。从项目根执行 `node engine/tools/build-survey-skill.mjs <新输出目录>` 生成完整包；包内 runtime 是生成副本，勿单独维护。

代码采用 MIT；导入的客户资料与模型回答不因使用本包而变成公开数据。贡献入口：https://www.hequbing.com/observe/SKILL.md
