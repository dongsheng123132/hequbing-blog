# Claude 网站改版审查

审查日期：2026-10-02（Asia/Shanghai）。审查对象为远端 main 的 31ad82dfc1c20ef125d5540b01eef035dbedeafd，对照本地原版本 1805616e712cdbd7cead9790617994f9fda51067。

结论：商业咨询定位、两类服务报价、静态页面与文章服务端渲染的方向基本正确，但当前部署失败，线上仍是旧版；之前选定的9篇公众号文章也尚未加入。不能把这次代码改版认定为已完成文章发布或已经提升GEO效果。

## 已完成且验证的部分

- 远端有4个新提交，3个署名Claude、1个人工提交，涉及28个文件。新增商业咨询首页、服务页、GEO页、作者资料及旧版存档。
- 服务页分别展示经营咨询（3万元诊断、18万元试点、60万元/年起）与AI开发/交付（POC 8000元起及按范围报价），符合用户本轮选择的两类展示方向。
- 新增api/render-post.js及data/post-template.html，保留/post?slug=...地址。vercel.json把文章路由交给服务端函数，data/**包含模板文件。
- 在隔离的远端代码快照中，25篇现有文章全部能直接生成带完整正文的HTML；检查了标题、canonical、BlogPosting JSON-LD和正文。未知文章返回404并含noindex。
- 新首页、报价与FAQ是可直接读取的HTML；非空JSON-LD均可解析。静态构建脚本运行成功。初次写回仅有换行格式差异，逐行比较没有语义变化，未列为缺陷。
- /old相关存档含noindex，提供了旧版查看及回滚资料。

## 需要处理的问题

### P1：新版没有部署成功，线上仍不具备新版功能

GitHub最新提交的Vercel状态为failure，对应部署为dpl_D3mCdZA2udQZHo56J29wMCgDCtVq。Vercel CLI读取到的决定性构建日志：

    2026-10-01T07:23:52.162Z  Node.js Version "20.x" is discontinued and must be upgraded. Please set Node.js Version to 24.x in your Project Settings to use Node.js 24.

构建在运行网站代码前停止。日志中的构建来源分支是claude/laughing-ptolemy-ucbfwu，提交31ad82d；同一提交现在也存在于远端main。这不能证明已经成功创建生产部署。

通过实际HTTP请求及追加查询参数复查：

| 地址 | 当前结果 |
| --- | --- |
| https://www.hequbing.com/geo | 404 |
| https://www.hequbing.com/services | 200，但仍是旧版标题和报价页面 |
| https://blog.hequbing.com/post?slug=ai-housing-era | 200，但返回的正文容器为空，仍是旧版JS加载模板 |
| https://blog.hequbing.com/api/posts | 200，25篇文章 |

建议在远端新版本的package.json明确设置engines.node为24.x，再验证构建并创建生产部署；上线验收应重查上述页面的状态和实际正文，不能仅凭push或人工空提交判断已上线。[Vercel Node 20停用公告](https://vercel.com/changelog/node-js-20-is-being-deprecated)、[版本覆盖方式](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)。

来源：[部署详情](https://vercel.com/hfshfgs-projects/hequbing-blog/D3mCdZA2udQZHo56J29wMCgDCtVq)。本轮Connector无此团队权限，但本机CLI已成功读取该部署日志，未修改团队或项目设置。

### P1：9篇精选文章没有迁移

data/posts.json在这4个提交中未变化，仍为原来的25篇。022 CAD、021任务护照、038 OpenCodex、030 U-King开发实践、003商业咨询、004陪伴式FDE、012中国通、083 U-Hermes、001 GEO验收均未作为新网站文章加入。

首页/服务页吸收咨询定位，不等于9篇文章已发布。下一步应保留这些文章的独特过程、证据和边界，并连接作者页、作品仓库与服务入口，避免只增加通用营销页面。

### P2：客户端会在API失败时覆盖已经渲染的完整正文

位置：public/post.js约192–206行，配合新api/render-post.js。

页面已由服务端输出正文后，旧post.js仍无条件请求/api/posts/:slug；请求失败则把文章标题改为“文章加载失败”，用错误提示替换正文。在隔离测试里，初始完整正文存在；模拟API不可用后，原正文确实被清除。

建议给服务端页面标记已渲染的slug，浏览器优先使用该正文；仅在没有预渲染内容时获取详情，或至少在API失败时保留已经显示的文章。列表接口失败也应只影响上下篇/相关文章，不影响正文阅读。

### 内容建议：GEO页的平台规则和效果周期需要更准确的依据

public/geo.html中把“ChatGPT主要依赖Bing”“DeepSeek/Kimi基本读不到公众号”“通常2–3个月结果稳定”写得较确定，引用却仅笼统称公开报道。平台、地区、登录状态、是否联网及日期都会影响观察结果。

建议把平台覆盖改为带日期和来源的观测，把周期写成服务实施/复测周期而非通常效果保证；补可定位官方资料，不把平台生态对应关系写成固定规则。OpenAI当前搜索说明描述多个第三方搜索提供方，不能据此确认一个固定的主要索引。[OpenAI搜索说明](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)。

Google官方强调原创、有用、独特经验和SEO基础，并不要求为了AI统一改成问答结构或添加特殊AI文件；问答可以帮助读者，但不应当成稳定引用公式。[Google生成式AI搜索优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。这条说明适用于Google，不是其他平台的算法证明。

关于页的日均4–10亿token、身份及荣誉不在本轮做真伪结论；发布时建议给可公开数字标注统计口径，给身份提供可定位的介绍或原始资料。当前没有独立核验这些经历，不能称已证实或已证伪。

## 本轮证据与边界

- check-claude-31ad82d.cjs / 2026-10-02-claude-checks.json：隔离代码快照的服务端渲染、JSON-LD、静态构建及API失败测试。
- live-2026-10-02/observations.json：实际公开页面与API观察。
- live-2026-10-02/fresh-and-deployment.json：追加参数的线上复查、GitHub部署状态及检查记录。Preview Comments检查成功只说明无未解决评论，不能抵消Vercel部署失败。
- 2026-10-02-claude-31ad82d/：用于验证的远端提交快照，不是当前工作树的同步或部署。

本轮只fetch远端Git记录、读取构建日志、测试隔离快照并生成审查材料；没有合并或覆盖当前工作文件，没有改网站源码、价格、外部账号，也没有部署。当前本地main仍落后远端4个提交；原有未跟踪语料及上一轮报告保留。

审查后的处理顺序：先修Node版本并验收生产部署，再完成9篇文章迁移，再修正文在API失败时被覆盖的问题和GEO描述。排名、收录、AI引用和有效询盘均未测量。
