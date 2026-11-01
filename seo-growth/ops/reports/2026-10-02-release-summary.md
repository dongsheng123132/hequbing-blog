# 贺去病网站：精选文章发布与改版补齐

完成日期：2026-10-02。生产部署已验收。主站：https://www.hequbing.com/；博客：https://blog.hequbing.com/archive。

## 本轮完成

- 同步Claude的4个已提交改版，保留原有25篇文章、用户语料及公众号原始导出。
- 固定Node.js 24，补自动构建，解决原Node.js 20停用导致的Vercel部署失败。
- 文章服务端输出完整正文、标题、作者、canonical和BlogPosting数据；有正文时不再请求详情API。列表不可用仍能阅读，旧空模板失败时显示提示。
- 新增9篇公众号网站整理版，文章库共34篇。补作者贺去病／贺方升、原文来源、服务与相关作品链接；网站发布日期2026-10-02，不冒充原公众号日期。
- 首页和作者页从文章库自动生成精选入口，服务页连接实施方法与技术实践，更新归档、sitemap及内容导航。
- 经营咨询与AI开发／POC分开，保留已批准的3万元诊断、18万元试点、60万元／年起，以及技术POC 8000元起的范围。
- GEO页改用可定位官方资料与实际观测条件，90天表述为实施／复测周期；移除固定平台索引、公众号读取限制和2–3月结果稳定的断言。
- 补博客首页到/archive的永久跳转；主站仍显示商业咨询首页。
- 发布上传排除原始语料、seo-growth审查材料及本地环境文件。

## 已上线的9篇

| 原文编号 | 网站文章 |
| --- | --- |
| 022 | [CAD AI对象清单](https://blog.hequbing.com/post?slug=cad-ai-dwg-dxf-object-audit) |
| 021 | [Task Passport任务护照](https://blog.hequbing.com/post?slug=task-passport-ai-handoff) |
| 038 | [OpenCodex多终端工作台](https://blog.hequbing.com/post?slug=opencodex-multi-terminal-workbench) |
| 030 | [U-King安装与配置开发实践](https://blog.hequbing.com/post?slug=uking-installation-engineering) |
| 003 | [经营咨询合作流程](https://blog.hequbing.com/post?slug=ai-business-consulting-process) |
| 004 | [陪伴式FDE交付与复盘](https://blog.hequbing.com/post?slug=companion-fde-delivery) |
| 012 | [AnythingChina中国通](https://blog.hequbing.com/post?slug=anythingchina-logistics-to-ai) |
| 083 | [U-Hermes便携AI环境](https://blog.hequbing.com/post?slug=u-hermes-portable-ai-environment) |
| 001 | [GEO三层验收](https://blog.hequbing.com/post?slug=geo-delivery-discovery-business) |

保留的重要边界：CAD两种输入不能作为公平模型排名，194候选与190实际对象分别说明，轮廓／bbox未完成，没有十倍效率盲测；中国通10万站点／100万工厂为愿景；U-Hermes的199元与许可范围为历史口径；经营咨询正在起步，不包装成已有增长案例。原文图示通过出处链接保留，本轮未迁移或逐张独立复核图片。

## 交付证据

- Git主分支提交：fdaed99（修复与9篇文章）、49ed266（博客域名入口）。均已推送；最终检查时受跟踪源码无未提交变更。
- Vercel最终生产部署：dpl_H7S8YqZFHmiNWydNLtUnaMNuQAJ6，target=production，status=Ready，绑定www.hequbing.com和blog.hequbing.com。[部署详情](https://vercel.com/hfshfgs-projects/hequbing-blog/H7S8YqZFHmiNWydNLtUnaMNuQAJ6)。
- 本地npm run build成功，npm test的6组验证通过：34篇SSR、元数据与来源、链接、API降级阅读、静态生成、真实HTTP及域名入口。
- 2026-10-02 14:19（北京时间）生产18项检查全部通过，包含9篇新文章的完整正文、原有文章、页面、列表、sitemap和未知文章404／noindex。证据：../reviews/2026-10-02-production-checks.json。
- 新加坡服务器通过无代理直连读取GEO页、博客首页、文章列表和CAD正文，均200；博客最终地址/archive，列表34篇，CAD有服务端正文标记。
- 主站和博客robots.txt均200且Allow: /；CAD文章没有noindex元标签或X-Robots-Tag。

浏览器控制工具在页面导航时超时，本轮没有可靠的视觉截图或手机布局验收。上述完成证据来自实际构建、程序、HTTP、生产部署及服务器直连，不称浏览器交互验收已经通过。

## 效果与后续

排名、收录、AI引用和有效询盘均未测量。完成的是可访问内容、个人作品资料、站内关联与发布，不据此报告流量增长。后续应使用站长平台数据、真实联网回答和询盘来源分别复盘；本轮未创建定时任务、外链投稿或群发。

当前文章正文唯一编辑源：data/posts.json。之后改正文，再运行npm run build与npm test；审查快照和历史导出仅供对照，不回写覆盖网站。

政策依据：[Vercel Node版本覆盖](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)、[Vercel静态配置与路由优先级](https://vercel.com/docs/project-configuration/vercel-json)、[Google AI搜索优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。
