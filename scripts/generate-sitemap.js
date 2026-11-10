#!/usr/bin/env node
/**
 * 生成 www.hequbing.com 的 sitemap.xml
 *
 * 规则：
 * 1. 只放 www.hequbing.com 的页面。文章与归档/标签页在 blog.hequbing.com，由
 *    scripts/generate-blog-sitemap.js 生成 sitemap-blog.xml 负责
 *    （sitemap 里的 URL 必须与 sitemap 同主机，跨主机写进去会被忽略，还会让另一个域名的
 *     GSC 资源报「备用网页 / 重复网页」——见 2026-11-10 收录告警）。
 *    两个域名共用同一份 public/，但 vercel.json 里按 host 条件各发各的 sitemap 与 robots。
 * 2. 中英成对的页面写 xhtml:link hreflang，帮助爬虫理解语言版本。
 * 3. 案例页（/case?slug=）默认不进 sitemap：那是行业研究转述，不是本人交付案例，
 *    只在 /cases 列表页里做内链，避免低原创度页面被大量索引。需要时用 INCLUDE_CASES=1 打开。
 *
 * 用法：npm run sitemap
 */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://www.hequbing.com';
const OUTPUT = path.join(__dirname, '..', 'public', 'sitemap.xml');
const INCLUDE_CASES = process.env.INCLUDE_CASES === '1';

// [路径, changefreq, priority, 对应的英文页（可选）]
const PAGES = [
  ['/', 'weekly', '1.0', '/en'],
  ['/services', 'monthly', '0.9', '/en/services'],
  ['/geo', 'monthly', '0.9', '/en/geo'],
  ['/fde', 'monthly', '0.9', null],
  ['/u-link', 'monthly', '0.8', null],
  ['/ai-landing', 'monthly', '0.9', null],
  ['/ai-consulting-price', 'monthly', '0.9', null],
  ['/about', 'monthly', '0.8', '/en/about'],
  ['/cases', 'weekly', '0.7', null],
  ['/observe', 'weekly', '0.7', null],
  ['/observe/rankings', 'weekly', '0.7', null],
  ['/observe/rankings/methodology', 'monthly', '0.5', null],
  ['/support', 'monthly', '0.4', null],
  ['/privacy', 'yearly', '0.3', null],
];

// 独立应用页（存在才收）：public/apps/<name>/index.html
const fsPath = path.join(__dirname, '..', 'public');
for (const app of ['ai-optimize-master']) {
  if (require('fs').existsSync(path.join(fsPath, 'apps', app, 'index.html'))) {
    PAGES.push([`/apps/${app}/`, 'monthly', '0.6', null]);
  }
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function buildSitemap() {
  const date = today();
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  const push = (loc, changefreq, priority, alternates) => {
    parts.push('  <url>');
    parts.push(`    <loc>${loc}</loc>`);
    if (alternates) {
      for (const [lang, href] of alternates) {
        parts.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}" />`);
      }
    }
    parts.push(`    <lastmod>${date}</lastmod>`);
    parts.push(`    <changefreq>${changefreq}</changefreq>`);
    parts.push(`    <priority>${priority}</priority>`);
    parts.push('  </url>');
  };

  for (const [zhPath, changefreq, priority, enPath] of PAGES) {
    const zhUrl = SITE_URL + (zhPath === '/' ? '/' : zhPath);
    const alternates = enPath
      ? [['zh-CN', zhUrl], ['en', SITE_URL + enPath], ['x-default', zhUrl]]
      : null;
    push(zhUrl, changefreq, priority, alternates);

    if (enPath) {
      const enUrl = SITE_URL + enPath;
      const enFile = path.join(__dirname, '..', 'public', enPath.replace(/^\//, '') + '.html');
      if (fs.existsSync(enFile)) {
        push(enUrl, changefreq, priority, [['zh-CN', zhUrl], ['en', enUrl], ['x-default', zhUrl]]);
      }
    }
  }

  // 静态案例详情页：本人交付 + 内容够厚的才进 sitemap，薄的行业研究留在 /cases 列表里做内链
  let cases = [];
  try {
    cases = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cases.json'), 'utf-8'));
  } catch {}
  for (const c of cases) {
    const own = c.source === '自有交付' || c.source === '自研项目';
    const bodyLen = String(c.content || '').replace(/<[^>]+>/g, '').length;
    if (own || bodyLen > 800 || INCLUDE_CASES) {
      push(`${SITE_URL}/case/${c.slug}`, 'monthly', own ? '0.7' : '0.4', null);
    }
  }

  parts.push('</urlset>');
  const xml = parts.join('\n') + '\n';
  fs.writeFileSync(OUTPUT, xml, 'utf-8');
  const count = (xml.match(/<loc>/g) || []).length;
  console.log(`Sitemap generated: ${OUTPUT} (${count} URLs)`);
}

buildSitemap();
