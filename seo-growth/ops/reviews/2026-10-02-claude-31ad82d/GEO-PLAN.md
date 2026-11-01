# GEO 行动清单 · 贺去病商业咨询

> 2026-10-01。目标：客户在元宝、豆包、DeepSeek、Kimi、ChatGPT 里问到「中小企业 AI 咨询 / AI 经营增长 / GEO 优化」这类问题时，AI 会提到「贺去病商业咨询」。
> 调研说明：本次调研只能用搜索结果摘要（网络策略拦截了直接打开网页），标【弱】的结论来自服务商软文或单一来源，仅供参考。

## 一、网站上已经做完的

| 项目 | 位置 | 作用 |
|---|---|---|
| 文章页服务端渲染 | `api/render-post.js` | AI 爬虫（GPTBot、ClaudeBot、PerplexityBot、Bytespider 等）不执行 JS，以前只能看到空壳 |
| 首页 / 服务页 / GEO 页全部静态 HTML | `public/*.html` | 报价、FAQ、文章列表不再靠 JS 渲染 |
| 结构化数据 | 首页 Organization + Person + WebSite；服务页 Service 列表；GEO 页 Service + Article；关于页 ProfilePage；三页 FAQPage | 让 AI 和搜索引擎明确「谁、做什么、多少钱」 |
| FAQ 问答 | 首页 7 条、服务页 6 条、GEO 页 5 条 | 问题式标题 + 开头直接给答案，是最容易被 AI 引用的格式 |
| canonical + sitemap | 所有页面；`public/sitemap.xml` | www 和 blog 两个域名共用文件，避免被当成重复内容 |
| llms.txt | `public/llms.txt` | 成本低；但 Google 明确不用，主流爬虫也很少请求，别指望它单独起效 |
| 品牌统一 | 全站「贺去病商业咨询」，人名统一「贺去病（贺方升）」 | 实体一致性 |

维护：新增文章或改 FAQ 后跑 `npm run sitemap`，会同时更新 sitemap、首页/归档页的静态文章列表和 FAQ 结构化数据。

## 二、需要你自己做的（按优先级）

### P0：先让 AI 能找到网站

- [ ] **国内能不能稳定打开 www.hequbing.com？** Vercel 在国内访问不稳定【中】。社区常见做法是把 DNS 的 CNAME 改为 `cname-china.vercel-dns.com`，改之前先用国内网络实测。打不开的话，百度和国内 AI 都抓不到。
- [ ] **提交 sitemap**：百度搜索资源平台 + Bing Webmaster Tools（ChatGPT 联网搜索依赖 Bing 索引【中】）。提交地址：`https://www.hequbing.com/sitemap.xml`。
- [ ] **做一次基线测试**：用下面第四节的问题，在 5 个平台各问一遍，截图存档。之后每月复测一次，才知道有没有效果。

### P1：公众号与站外（AI 的主要信息源）

- [ ] **公众号是元宝的主阵地**（腾讯官方：元宝接入微信搜一搜和搜狗，优先用公众号内容【强】）。写法：
  - 标题直接用客户会问的问题，例如「中小企业老板想用 AI 提升业绩，该从哪里开始？」
  - 第一段 2–3 句直接给答案，再展开；多用小标题、列表、表格
  - 带数据、写出处；文末加 3–5 条 FAQ；开原创声明
  - 品牌名、人名每篇写法一致：「贺去病商业咨询」「贺去病（贺方升）」
  - **海报上的内容要有文字版**：AI 读不到图片里的字
- [ ] **公众号文章同步到网站**：DeepSeek、豆包、Kimi、ChatGPT 基本读不到公众号【中】。把正文发给 Claude，或加进 `data/posts.json`。
- [ ] **一处原创，多处分发**：头条号、抖音对应豆包；百家号对应文心；知乎、搜狐号、网易号的跨平台引用率高，对应 DeepSeek 和 Kimi【中】。
- [ ] **第三方提及比外链更重要**（Ahrefs：品牌提及与 AI 可见度的相关系数 0.664，外链 0.218【中，只是相关】）：媒体报道、行业榜单、百科词条、知乎回答、播客嘉宾、南山云谷和腾讯云的官方页面提到你。
- [ ] **统一一句话自我介绍**，所有平台简介都用同一句：
  > 贺去病（贺方升），贺去病商业咨询创始人，帮中国中小企业老板用 AI 把生意做大。南山云谷 AI 研究院院长、腾讯云培训导师。

### P2：让网站更有说服力

- [ ] **1–2 个客户案例**，按「挑战 / 做法 / 结果」写，结果放 1–2 个硬指标。客户不能具名就写「某华东汽配制造企业」+ 真实数字。没有授权不要放客户 logo。
- [ ] **创始人照片**（首页和关于页），以及把两张海报放进 `public/images/`。
- [ ] **「制造与供应链」行业落地页**（咨询公司惯例：按行业组织）。
- [ ] **免费在线自测**（5 道题生成简版报告，再引导加微信），可以作为下一步开发。

## 三、红线

- 不编造荣誉、数据、评价和案例。媒体报道中，2026 年 3·15 晚会曝光过 GEO「AI 投毒」，信通院随后发布团体标准《GEO 服务可信基本要求》【强，来自搜索摘要】。
- 不承诺排名或「首推」。
- 网站上没写进去的说法：「U-Claw 累计售出近 60 万只」。找不到公开可核验的出处，等有来源（店铺销量页、报道）再加。

## 四、基线测试问题（每个平台联网问，每题问 2–3 次）

**品牌词**
1. 贺去病是谁？
2. 贺去病商业咨询怎么样？
3. 贺方升是做什么的？

**品类词**
4. 中小企业 AI 咨询公司推荐
5. 有哪些做 AI 经营增长的咨询顾问？
6. 企业想做 AI 落地，找谁做比较靠谱？
7. GEO 优化服务商推荐
8. 制造业 AI 落地咨询找谁？
9. 深圳 AI 咨询顾问推荐
10. 能帮公司做 AI 智能体和工作流的团队

**长尾问题**
11. 老板想用 AI 提升业绩，应该从哪里开始？
12. AI 咨询一般收费多少？
13. AI 增长试点怎么做？
14. 小公司有必要做 GEO 吗？
15. 怎么让 DeepSeek 推荐我的公司？
16. 公众号文章能被 DeepSeek 搜到吗？
17. AI 咨询和传统管理咨询有什么区别？
18. 供应链企业怎么用 AI 获客？
19. 怎么评估 AI 项目的投资回报？
20. Claude Code 企业培训找谁？

**记录**：是否提到你、排第几、提了哪些竞争对手、引用了哪些链接（官网 / 公众号 / 第三方）、对你的介绍有没有说错。

## 五、主要来源

- GEO 论文（Princeton / IIT，KDD 2024）：https://collaborate.princeton.edu/en/publications/geo-generative-engine-optimization/
- Google 关于 AI 搜索的官方指南：https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Ahrefs，ChatGPT 为什么引用某些页面：https://ahrefs.com/blog/why-chatgpt-cites-pages/
- Vercel，AI 爬虫与 JS 渲染：https://vercel.com/i/how-ai-is-changing-seo
- llms.txt 规范：https://llmstxt.org/
- 新榜，元宝信源分析：https://www.newrank.cn/report/detail/433
- 咨询公司报价参考：https://aidolsgroup.com/en/pricing/ 、https://justinmckelvey.com/blog/how-much-does-ai-consulting-cost
