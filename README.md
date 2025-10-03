# 贺去病 · 博客部署说明（Vercel）

本项目已适配 Vercel 的 Serverless API：
- 静态页面在 `public/`
- 接口位于 `api/`（`/api/posts`、`/api/posts/[slug]`）读取 `data/posts.json`

## 一、准备环境

1. 安装 Node.js（建议 18+）
2. 全局安装 Vercel CLI：

```
npm i -g vercel
```

3. 登录 Vercel：

```
vercel login
```

## 二、部署到 Vercel

在项目根目录执行：

```
vercel       # 首次会进行项目链接/创建
vercel --prod
```

执行成功后，Vercel 会给出预览与生产地址，例如：
- 预览：`https://<project>-<user>.vercel.app`
- 生产：`https://<project>.vercel.app`

也可以将仓库连接到 Vercel（GitHub/GitLab/Bitbucket），每次推送自动构建部署。

## 三、绑定自定义域名

建议博客使用子域名：`blog.hequbing.com`（保留 `www.hequbing.com` 指向现有官网）。

步骤：
1. 在 Vercel 项目设置的 Domains 中，添加 `blog.hequbing.com`。
2. 到你的域名 DNS 服务商（阿里云/腾讯云/Cloudflare/Namecheap 等）添加 CNAME 记录：
   - 主机记录（Name）：`blog`
   - 记录类型（Type）：`CNAME`
   - 记录值（Value）：`cname.vercel-dns.com`（或 Vercel 提示的专属值）
   - TTL：默认或自动
3. 等待 DNS 生效（通常几分钟到 1 小时）。在 Vercel 项目中可点击 “Verify” 验证。

如需暂时用 `www.hequbing.com` 指向博客：
- 在 Vercel 项目中也添加 `www.hequbing.com` 域名。
- 在 DNS 将 `www` 的 CNAME 改为 `cname.vercel-dns.com`。
- 注意：这会把 `www.hequbing.com` 的现有官网流量切到博客，请谨慎操作。更稳妥的方案是先用 `blog.hequbing.com`。

## 四、内容维护

- 新增/修改文章：编辑 `data/posts.json`，字段包括 `title`、`date`、`summary`、`tags`、`content`（HTML）。
- 样式与品牌：修改 `public/styles.css` 与 `public/favicon.svg`。

## 五、本地开发

本地可继续使用 `node server.js` 进行预览；或直接打开 `public` 下的静态文件并将 API 改为本地函数模拟。