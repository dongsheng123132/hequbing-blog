# 贺去病 · 博客部署说明（Vercel）

域名是：https://blog.hequbing.com/

本项目已适配 Vercel 的 Serverless API：
- 静态页面在 `public/`
- 接口位于 `api/`（`/api/posts`、`/api/posts/[slug]`）读取 `data/posts.json`

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

- **新增/修改文章**：编辑 `data/posts.json`，字段包括 `title`、`date`、`summary`、`tags`、`content`（HTML）。
- **样式与品牌**：修改 `public/styles.css` 与 `public/favicon.svg`。

## 本地开发

本地预览：
```bash
node server.js
```
访问 http://localhost:3000
