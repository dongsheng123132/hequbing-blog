#!/usr/bin/env node
/**
 * 自动生成 sitemap.xml
 */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://hequbing.com';
const OUTPUT = path.join(__dirname, '..', 'public', 'sitemap.xml');
const CASES_PATH = path.join(__dirname, '..', 'data', 'cases.json');

function generateSitemap() {
  let cases = [];
  try {
    cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf-8'));
  } catch {}

  const today = new Date().toISOString().split('T')[0];

  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/cases', priority: '0.9', changefreq: 'daily' },
    { url: '/services', priority: '0.8', changefreq: 'weekly' },
    { url: '/about', priority: '0.7', changefreq: 'monthly' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const page of staticPages) {
    xml += `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  for (const c of cases) {
    xml += `  <url>
    <loc>${SITE_URL}/case?slug=${c.slug}</loc>
    <lastmod>${c.date || today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
  }

  xml += `</urlset>`;

  fs.writeFileSync(OUTPUT, xml, 'utf-8');
  console.log(`Sitemap generated: ${OUTPUT} (${staticPages.length + cases.length} URLs)`);
}

generateSitemap();
