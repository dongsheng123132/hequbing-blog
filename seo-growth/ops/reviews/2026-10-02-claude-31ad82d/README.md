# 贺去病商业咨询 · 网站（Vercel）

- 主站：https://www.hequbing.com/ （首页、服务与报价 /services、GEO 优化 /geo、关于 /about、AI 落地情报 /cases）
- 博客：https://blog.hequbing.com/ （同一套代码，按域名分流）

结构：
- 静态页面在 `public/`；文章页 `/post?slug=xxx` 由 `api/render-post.js` 服务端渲染（模板 `data/post-template.html`）
- 接口位于 `api/`（`/api/posts`、`/api/posts/[slug]`、`/api/cases`）读取 `data/*.json`
- GEO 相关的做法和待办见 `GEO-PLAN.md`

改价格时要同步改：`public/index.html`（页面 + JSON-LD）、`public/services.html`、`public/geo.html`、`public/llms.txt`、`data/services.json`。

## 版本与回滚

- 改版前（2026-09，「AI 落地实战派」绿色版）的完整代码在分支 `old-site-2026-09`（commit 1805616）。要整站回到旧版：把 main 恢复成这个分支，或在 Vercel 后台对旧部署点 Instant Rollback。
- 旧版首页、服务页、关于页的存档在线上 `/old`、`/old/services`、`/old/about`（noindex，不进 sitemap）。

## 注意：Vercel Hobby 的提交者校验

Hobby 计划下，Vercel 只部署作者是账号本人的提交。作者是别人、或带 `Co-authored-by` AI 署名的提交会被拦下，不会上线。用 AI 工具改完后，最后一个提交要以本人身份提交，再推送到 main。

## 推荐：使用 GitHub 自动部署（最简单）

这是维护成本最低的方式。

1. **推送代码到 GitHub**：
   本项目已经配置好 Git，直接提交推送即可。

2. **在 Vercel 导入项目**：
   - 登录 [Vercel](https://vercel.com)
   - 点击 **Add New...** -> **Project**
   - 选择 **Import** 你的 GitHub 仓库 `hequbing-blog`
   - 点击 **Deploy**

以后每次更新文章（修改 `data/posts.json`），只需提交并推送到 GitHub，Vercel 会自动更新线上网站。

---

## 手动部署（使用 CLI）

如果你不想走 GitHub，也可以用命令行：

1. 安装 Vercel CLI：`npm i -g vercel`
2. 登录：`vercel login`
3. 部署：`vercel --prod`

## 内容维护

- **新增/修改文章**：编辑 `data/posts.json`，字段包括 `title`、`date`、`summary`、`tags`、`content`（HTML）。改完跑 `npm run sitemap`：更新 sitemap、首页和归档页的静态文章列表、FAQ 结构化数据。
- **改 FAQ**：直接改页面里的 `<details>` 问答，再跑 `npm run sitemap`，结构化数据会自动同步。
- **样式与品牌**：修改 `public/styles.css` 与 `public/favicon.svg`。

## 本地开发

本地预览：
```bash
node server.js
```
访问 http://localhost:3000
