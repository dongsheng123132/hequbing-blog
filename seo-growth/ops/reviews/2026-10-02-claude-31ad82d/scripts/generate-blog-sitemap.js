#!/usr/bin/env node
/**
 * 自动生成 sitemap.xml（主站页面 + 从 data/posts.json 驱动的博客文章）
 * www 和 blog 两个域名共用同一份 public/，robots.txt 在两边都声明了这份 sitemap，
 * 所以一份文件里可以同时列两个域名的 URL。只列 canonical 地址，避免重复。
 * 用法：npm run sitemap
 */
const fs = require('fs');
const path = require('path');

const WWW_URL = 'https://www.hequbing.com';
const SITE_URL = 'https://blog.hequbing.com';
const POSTS_PATH = path.join(__dirname, '..', 'data', 'posts.json');
const OUTPUT = path.join(__dirname, '..', 'public', 'sitemap.xml');

function generateSitemap() {
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf-8'));

  const staticPages = [
    { url: WWW_URL + '/', priority: '1.0', changefreq: 'weekly' },
    { url: WWW_URL + '/services', priority: '0.9', changefreq: 'monthly' },
    { url: WWW_URL + '/geo', priority: '0.9', changefreq: 'monthly' },
    { url: WWW_URL + '/about', priority: '0.8', changefreq: 'monthly' },
    { url: WWW_URL + '/cases', priority: '0.6', changefreq: 'daily' },
    { url: SITE_URL + '/archive', priority: '0.9', changefreq: 'daily' },
    { url: SITE_URL + '/tags', priority: '0.6', changefreq: 'weekly' },
  ];

  const today = new Date().toISOString().split('T')[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const page of staticPages) {
    xml += `  <url>
    <loc>${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // 文章按日期倒序，最新在前
  const sorted = [...posts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const p of sorted) {
    xml += `  <url>
    <loc>${SITE_URL}/post?slug=${p.slug}</loc>
    <lastmod>${p.date || today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  fs.writeFileSync(OUTPUT, xml, 'utf-8');
  console.log(`Sitemap generated: ${OUTPUT} (${staticPages.length + sorted.length} URLs)`);
}

generateSitemap();
