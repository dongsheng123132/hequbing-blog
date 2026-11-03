'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { WWW, BLOG, pagePairs, postUrl, alternateLinks } = require('../../../lib/localization');
const root = path.join(__dirname, '../../..');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'data/posts.json'), 'utf8'));
const selected = posts.filter(p => p.translations && p.translations.en);
const checks = [];
function requireValue(condition, description) { if (!condition) throw new Error(description); }
function schema(html) {
  for (const m of html.matchAll(/type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) if (m[1].trim()) JSON.parse(m[1]);
}
function add(url, verify) { checks.push({ url, verify }); }
for (const pair of pagePairs) {
  for (const [language, url] of [['zh-CN', pair.zh], ['en', pair.en]]) {
    add(url, (r, html) => {
      requireValue(r.status === 200, 'Expected 200');
      requireValue(html.includes('<html lang="' + language + '">'), 'Wrong page language');
      requireValue(html.includes('rel="canonical" href="' + url + '"'), 'Wrong canonical');
      requireValue(html.includes(alternateLinks(pair.zh, pair.en)), 'Missing reciprocal hreflang');
      requireValue(html.includes('href="' + (language === 'en' ? pair.zh : pair.en) + '" lang="' + (language === 'en' ? 'zh-CN' : 'en') + '"'), 'Missing language switch');
      schema(html);
      if (pair.file === 'services.html' && language === 'en') {
        requireValue(html.includes('id="consulting"') && html.includes('id="dev"'), 'Service tracks mixed');
        for (const p of ['CNY 30,000', 'CNY 180,000', 'From CNY 600,000', 'From CNY 8,000']) requireValue(html.includes(p), 'Missing price ' + p);
      }
      if (pair.file === 'archive.html' && language === 'en') for (const p of selected) requireValue(html.includes(postUrl(p.slug, 'en')), 'Missing English archive entry');
    });
  }
}
for (const p of selected) {
  add(postUrl(p.slug, 'en'), (r, html) => {
    requireValue(r.status === 200, 'Expected English article 200');
    requireValue(html.includes(p.translations.en.content), 'English content missing or changed');
    requireValue(html.includes('<html lang="en">'), 'Wrong language');
    requireValue(html.includes(alternateLinks(postUrl(p.slug), postUrl(p.slug, 'en'))), 'Wrong language pair');
    requireValue(!html.includes('content="noindex"'), 'Article marked noindex');
    const data = JSON.parse(html.match(/id="schema-json">([\s\S]*?)<\/script>/)[1]);
    requireValue(data.mainEntityOfPage === postUrl(p.slug, 'en'), 'Wrong article canonical');
    requireValue(data.headline === p.translations.en.title && data.inLanguage === 'en', 'Wrong structured data');
    requireValue(data.isBasedOn === p.source.url, 'Source missing');
    requireValue(!/\{\{[A-Z_]+\}\}/.test(html.replace(/<!--.*?-->/gs, '')), 'Unfilled template');
  });
}
add(postUrl(selected[0].slug), (r, html) => {
  requireValue(r.status === 200 && html.includes(selected[0].content), 'Chinese article regressed');
  requireValue(html.includes(alternateLinks(postUrl(selected[0].slug), postUrl(selected[0].slug, 'en'))), 'Chinese article missing English pair');
});
add(BLOG + '/en', r => {
  requireValue(r.status === 308 && r.headers.get('location') === BLOG + '/en/archive', 'Blog English root redirect failed');
});
const untranslated = posts.find(p => !p.translations);
add(postUrl(untranslated.slug, 'en'), (r, html) => {
  requireValue(r.status === 404 && html.includes('content="noindex"'), 'Missing translation should be 404/noindex');
  requireValue(!html.includes(untranslated.content) && html.includes(postUrl(untranslated.slug)), 'Wrong untranslated fallback');
});
add(WWW + '/sitemap.xml', (r, html) => {
  const urls = Array.from(html.matchAll(/<loc>(.*?)<\/loc>/g), m => m[1]);
  requireValue(r.status === 200 && urls.length === 55 && new Set(urls).size === 55, 'Expected 55 unique URLs');
  for (const p of selected) requireValue(urls.includes(postUrl(p.slug, 'en')), 'English article missing from sitemap');
});
for (const file of ['styles.css', 'post.js', 'site.js']) add(WWW + '/' + file, (r, html) => {
  requireValue(r.status === 200 && html.length > 500, 'Asset missing: ' + file);
});

(async () => {
  const results = [];
  // Keep network concurrency modest and every request bounded.
  for (let i = 0; i < checks.length; i += 4) {
    const batch = await Promise.allSettled(checks.slice(i, i + 4).map(async check => {
      const started = Date.now();
      const response = await fetch(check.url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
      const html = await response.text();
      const record = { url: check.url, status: response.status, bytes: Buffer.byteLength(html), elapsedMs: Date.now() - started };
      try { check.verify(response, html); return { ...record, passed: true }; }
      catch (error) { return { ...record, passed: false, error: error.message }; }
    }));
    batch.forEach((result, index) => results.push(result.status === 'fulfilled' ? result.value : { url: checks[i + index].url, passed: false, error: result.reason.message }));
  }
  const report = { checkedAt: new Date().toISOString(), scope: 'English release and Chinese regressions; public HTTP through local proxy', passed: results.every(r => r.passed), checks: results, outcomes: { indexing: 'not_measured', rankings: 'not_measured', aiCitations: 'not_measured', inquiries: 'not_measured' } };
  fs.writeFileSync(path.join(__dirname, '2026-10-02-english-production-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: results.length, failed: results.filter(r => !r.passed) }, null, 2));
  if (!report.passed) process.exitCode = 1;
})();
