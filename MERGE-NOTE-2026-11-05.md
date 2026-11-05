# hequbing-blog 双线合并记录（2026-11-05）

## 为什么有两份

Windows → Mac 迁移时留下了两条独立演进的历史：

| 线 | 原路径 | 情况 |
|---|---|---|
| 主站线 | `~/code/hequbing-blog` | 完整 72 提交，tip `23ce7e6`（后本地又有一笔 `81e0c77` 客户项目区块），= 线上 `origin/main` |
| SEO 改版线 | `~/claude/hequbing-blog` | 浅克隆，32 提交，tip `dcc3a0b`，含案例页/落地页/百度验证/IndexNow/FAQ 结构化 |

两条线共同基线是 `caab8a4`（2026-03-25），之后各自走了 52 / 11 个提交。

## 怎么合的

以**主站线为基线**（`81e0c77`），合入 SEO 线的 11 个独有提交，merge commit：

```
4879294 merge: 并入 SEO 改版线（案例页/落地页/百度+IndexNow验证/FAQ结构化/observe榜单）
├─ 父1: 81e0c77 主站线
└─ 父2: dcc3a0b SEO 线
21e6525 test: sitemap 断言适配合并后的 99 条
```

带入的内容：
- `public/case/*` 25 个案例页 + `scripts/build-cases.js` / `case-redirects.json` / `check-seo.js`
- `public/ai-landing.html`、`public/ai-consulting-price.html`、`public/fde.html` 三个落地页
- 百度 ownership 验证文件、IndexNow 密钥文件
- About 页「贺去病≠霍去病」同名澄清 FAQ + `FAQPage` 结构化数据（同时改 `lib/personal-pages.js` 源，重新 build 不会丢）
- `vercel.json` 合并：headers 9 / redirects 25 / rewrites 21
- `sitemap.xml` 合并：85 + 14 = 99 条
- `seo-growth/` 109 个 SEO 过程档案

保留主站的内容：62 篇文章、GEO 81 张配图、HackerPodcasts 英文页、客户项目区块、`modules/observe` / `modules/rankings` 两个 submodule（保持 gitlink）。

## 现在的状态

- 本地唯一副本：`~/code/族-sites/hequbing-blog`（`main` = `21e6525`，含合并）
- 远程备份分支：`origin/merge/seo-line-2026-11-05` = `21e6525`
- **`origin/main` 仍是 `81e0c77`，尚未上线合并结果**。要上线：
  ```bash
  git push origin main          # Vercel 会自动部署
  ```
- 回滚：`git revert -m 1 4879294` 或把 main 指回 `81e0c77`

## 验证

- `node tests/site.test.cjs && node tests/contact.test.cjs && node tests/projects.test.cjs` 全过
- 本地静态服务器冒烟：`/`、`/about.html`、`/ai-landing.html`、`/ai-consulting-price.html`、`/fde.html`、`/case/ai-proposal-writing.html`、`/observe/index.html` 全 200
