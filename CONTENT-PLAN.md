# 内容计划 · hequbing.com 博客 × GitHub 互动推广

> 更新：2026-08-06。机制：**每篇文章 = 一个 GitHub 仓库的故事**。正文链仓库 → 仓库 homepage 链回文章（`gh repo edit <repo> --homepage <post-url>`）→ 主站 Latest Builds 区自动拉 GitHub 活动 → sitemap 补 URL。三向互推闭环。

## 发布队列（按优先级）

| # | 文章 | 仓库 | 角度 / 关键词 | 状态 |
|---|---|---|---|---|
| 1 | 本象协议开源：给 AI 一套不会失忆的世界状态层 | dongsheng123132/2origin | 持久对象层、状态追踪、语义事务 | ✅ 已发（2026-08-06，homepage 已互链） |
| 2 | media-publish：一份文案 → 20+ 平台一键发布 | dongsheng123132/media-publish | 多平台发布、自媒体工具、宣发 | 📝 待写（最新发布，热度高） |
| 3 | Open365：隐私优先的 Windows 维护工具 | dongsheng123132/Open365 | Windows 清理、隐私、开源工具 | 📝 待写（NEW Jul 2026） |
| 4 | Codex CLI 中文教程（蓝皮书）：保姆级上手 | dongsheng123132/codex-handbook-zh | Codex CLI、AI 编程教程 | 📝 待写（长尾 SEO 主力） |
| 5 | Hermes Agent 中文教程：38 章 14 万字 | dongsheng123132/hermes-agent-zh | Hermes、Agent 教程、自动化 | 📝 待写 |
| 6 | noone：内容不再被平台绑架 | dongsheng123132/noone | 多平台生成、公众号/小红书/抖音 | 📝 待写 |
| 7 | AI 作图中文教程（红皮书） | dongsheng123132/ai-image-handbook-zh | AI 作图、gpt-image、教程 | 📝 待写 |
| 8 | PaperGuard：开源论文体检工具 | dongsheng123132/paperguard | 科研诚信、论文查重、AI 科研 | 📝 待写 |
| 9 | OpenCodex：本地多终端 AI 编程工作台 | dongsheng123132/opencodex | 本地工作台、Claude Code、Codex | 📝 待写 |
| 10 | U-Claw 虾盘旗舰深度文：离线 AI 装机实战 | dongsheng123132/u-claw | 离线 AI、U 盘、装机（1.7k★ 主力） | 📝 待写 |
| 11 | PhoneBody：闲置 Mac 变竖屏手机义体 | dongsheng123132/phonebody | 远程写代码、macOS | 📝 待写 |
| 12 | TeacherKit：AI 备课助手 | dongsheng123132/teacher-kit | 教育、备课、教师 | 📝 待写（可兼转案例库卡片） |

## 写作体例（对齐现有 8 篇 + 本象文）

- 标题 ≤ 26 字，含核心关键词（SEO）
- 正文 HTML：h3 分节、strong 强调、ul 列表、blockquote 金句；600–2700 字
- 文末必带：GitHub 仓库链接（target=_blank）+ 微信 CTA
- summary 字段 = meta description（≤120 字，含关键词）
- tags 3–5 个，与 archive/tags 页联动

## SEO 清单（每篇发布时执行）

- [ ] `gh repo edit <repo> --homepage <post-url>`（GitHub About 区互链）
- [ ] sitemap.xml 追加 post URL（blog.hequbing.com/post?slug=<slug>）
- [ ] 正文链仓库 + README 徽章位（README 侧等下次仓库推送时补）
- [ ] 案例库交叉：适合的（如 TeacherKit/文档处理类）加 case 卡片（data/cases.json）
- [ ] 发布后验证：curl /api/posts/<slug> + 归档页出现

## 已有互动（2026-08-06 完成）

- 主站 4 页导航/页脚加"博客"入口（commit 9843ed8）
- sitemap + robots 补博客 URL
- 2origin homepage → 本象博客文
- ConStory-Bench issue #1（评测参与，外链曝光）
