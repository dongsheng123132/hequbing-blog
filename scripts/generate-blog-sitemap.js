#!/usr/bin/env node
/**
 * 自动生成 blog.hequbing.com 的 sitemap.xml（从 data/posts.json 驱动）
 * 用法：node scripts/generate-blog-sitemap.js
 */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://blog.hequbing.com';
const POSTS_PATH = path.join(__dirname, '..', 'data', 'posts.json');
const OUTPUT = path.join(__dirname, '..', 'public', 'sitemap.xml');

function generateSitemap() {
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf-8'));

  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/archive', priority: '0.9', changefreq: 'daily' },
    { url: '/tags', priority: '0.7', changefreq: 'weekly' },
    { url: '/about', priority: '0.6', changefreq: 'monthly' },
  ];

  const today = new Date().toISOString().split('T')[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const page of staticPages) {
    xml += `  <url>
    <loc>${SITE_URL}${page.url}</loc>
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
