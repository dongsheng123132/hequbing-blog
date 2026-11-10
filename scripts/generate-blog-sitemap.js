#!/usr/bin/env node
/**
 * 生成 blog.hequbing.com 的站点地图：public/sitemap-blog.xml
 *
 * 为什么要单独一份（2026-11-10 修 GSC 告警）：
 * 1. www 与 blog 两个域名共用同一份 public/（同一个 Vercel 项目），过去只放一份 sitemap.xml，
 *    里面同时写着两个主机的 URL。sitemap 规范要求 <loc> 与 sitemap 同主机，跨主机条目会被忽略，
 *    并且 Google 会在另一个域名的资源里报「站点地图中的网页无法被编入索引：备用网页」。
 * 2. 现在分工：scripts/generate-sitemap.js → public/sitemap.xml（只 www），
 *    本脚本 → public/sitemap-blog.xml（只 blog）；
 *    vercel.json 用 has:host 把 blog.hequbing.com/sitemap.xml 改写到本文件。
 *
 * 用法：npm run sitemap
 */
const fs = require('fs');
const path = require('path');
const { postUrl, escapeHtml } = require('../lib/localization');

const BLOG = 'https://blog.hequbing.com';
const POSTS_PATH = path.join(__dirname, '..', 'data', 'posts.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUTPUT = path.join(PUBLIC_DIR, 'sitemap-blog.xml');

function today() {
  return new Date().toISOString().split('T')[0];
}

function generateSitemap() {
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf-8'));
  const date = today();

  // 只列 blog 主机的静态页
  const staticPages = [
    { url: BLOG + '/archive', changefreq: 'daily', priority: '0.9' },
    { url: BLOG + '/tags', changefreq: 'weekly', priority: '0.6' },
  ];
  if (fs.existsSync(path.join(PUBLIC_DIR, 'en', 'archive.html'))) {
    staticPages.push({ url: BLOG + '/en/archive', changefreq: 'daily', priority: '0.7' });
  }

  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  const push = (loc, lastmod, changefreq, priority) => {
    parts.push('  <url>');
    parts.push(`    <loc>${escapeHtml(loc)}</loc>`);
    parts.push(`    <lastmod>${escapeHtml(lastmod || date)}</lastmod>`);
    parts.push(`    <changefreq>${changefreq}</changefreq>`);
    parts.push(`    <priority>${priority}</priority>`);
    parts.push('  </url>');
  };

  for (const p of staticPages) push(p.url, date, p.changefreq, p.priority);

  const sorted = [...posts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const p of sorted) {
    push(postUrl(p.slug), p.dateModified || p.date || date, 'monthly', '0.8');
  }

  const translated = sorted.filter(p => p.translations && p.translations.en);
  for (const p of translated) {
    push(postUrl(p.slug, 'en'), p.translations.en.dateModified || p.translations.en.date || date, 'monthly', '0.7');
  }

  parts.push('</urlset>');
  const xml = parts.join('\n') + '\n';
  fs.writeFileSync(OUTPUT, xml, 'utf-8');
  const count = (xml.match(/<loc>/g) || []).length;
  console.log(`Blog sitemap generated: ${OUTPUT} (${count} URLs)`);
}

generateSitemap();
