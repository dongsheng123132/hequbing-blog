# 英文版发布记录 · 2026-10-02

英文首页：https://www.hequbing.com/en
英文文章：https://blog.hequbing.com/en/archive

## 已发布

- 5 个英文页面：首页、服务、GEO、关于、文章归档。
- 9 篇英文文章；原有 34 个中文文章记录（除新增 translations.en）与发布前完全相同。
- 中英文可切换到对应页；各自 canonical + 双向 zh-CN/en hreflang + 中文 x-default。
- 未翻译文章的英文地址返回 404/noindex，并提供中文原文入口。
- 英文正文和导航直接由服务器返回；前端不请求中文列表或覆盖译文。
- sitemap 共 55 个唯一 canonical 地址，新增 14 个英文地址。
- 服务保持经营咨询、开发交付两类，人民币 CNY 报价；英语页面报价数字从 data/services.json 读取。
- 历史版本、项目目标和已验证范围随译文保留。未声称本次发布获得排名、引用或询盘增长。

## 实际验证

- npm run build 通过；npm test 9 组通过，包含全部中英文正文、真实 HTTP 路由、缺失译文、前端回退、语言对应、报价及构建幂等检查。
- Vercel 预览三个公开页面内容检查通过（通过已授权 CLI 读取受保护预览）：首页、服务、CAD 完整英文正文。
- 正式域名 26 项 HTTP 检查通过；详见 ../reviews/2026-10-02-english-production-checks.json。
- 新加坡服务器禁用代理，4 个正式英文地址返回 200 且包含预期内容；详见 ../reviews/2026-10-02-english-singapore-checks.json。仅说明该网络的可达性。
- 本地浏览器实际查看英文首页和服务页，版式与两类报价正常。正式站浏览器自动化超时，没有把它记为 UI 验证通过；正式地址由 HTTP 与新加坡直连检查确认。

## 发布与维护

- Git 提交：e473528（main 已推送）。
- 预览：dpl_5p9bvnA1S4YRuzhXDnbDVvRGoAYw，Ready。
- 生产：dpl_ABncdBHJcec2wx6AEmSVDfq2pFG3，target=production、Ready，绑定 www.hequbing.com、blog.hequbing.com、hequbing.com。
- 前一生产版本：dpl_H7S8YqZFHmiNWydNLtUnaMNuQAJ6，可作为回滚参照。
- 英文静态文案：scripts/build-english.js；文章英文译文：data/posts.json 中的 translations.en；语言映射：lib/localization.js。
- 操作说明：README.md。不要直接编辑生成的 public/en/*.html；改源后 npm run build，再 npm test。
- Google 语言版本文档：https://developers.google.com/search/docs/specialty/international/localized-versions 。对应版本均使用独立 URL，并列出自身与另一语言的完整地址。
- 索引、排名、AI 引用、询盘：not_measured。本次验证为内容和发布可用性，不代表搜索或业务效果。

## 英文文章

- [CAD AI auditing: traceable window and door inventories from DWG and DXF](https://blog.hequbing.com/en/post?slug=cad-ai-dwg-dxf-object-audit)
- [Task Passport: handing a task between Claude, Codex and DSH](https://blog.hequbing.com/en/post?slug=task-passport-ai-handoff)
- [OpenCodex: a local multi-terminal workspace for AI coding](https://blog.hequbing.com/en/post?slug=opencodex-multi-terminal-workbench)
- [Building U-King: configuration, processes and real-machine failures](https://blog.hequbing.com/en/post?slug=uking-installation-engineering)
- [Hequbing Business Consulting: diagnosis, pilots and delivery](https://blog.hequbing.com/en/post?slug=ai-business-consulting-process)
- [Companion FDE: implementing AI with a business team](https://blog.hequbing.com/en/post?slug=companion-fde-delivery)
- [AnythingChina: connecting logistics experience with AI-assisted sourcing](https://blog.hequbing.com/en/post?slug=anythingchina-logistics-to-ai)
- [U-Hermes portable AI environment: versions, setup and operating requirements](https://blog.hequbing.com/en/post?slug=u-hermes-portable-ai-environment)
- [How to evaluate GEO: delivery, discoverability and business results](https://blog.hequbing.com/en/post?slug=geo-delivery-discovery-business)
