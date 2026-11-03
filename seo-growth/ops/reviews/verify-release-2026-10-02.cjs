const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'data/posts.json'), 'utf8'));
const stamp = Date.now();
const checks = [
  { url: 'https://www.hequbing.com/', verify: t => t.includes('id="practice"') && t.includes('/post?slug=task-passport-ai-handoff') },
  { url: 'https://www.hequbing.com/geo', verify: t => t.includes('90 天是实施与复测周期') && !t.includes('主要依赖 Bing') },
  { url: 'https://www.hequbing.com/services', verify: t => t.includes('AI 开发与交付') && t.includes('AI 经营诊断') && t.includes('¥8,000') && t.includes('¥30,000') },
  { url: 'https://www.hequbing.com/about', verify: t => t.includes('id="practice"') && t.includes('贺方升') },
  { url: 'https://blog.hequbing.com/', verify: t => t.includes('文章归档') && t.includes('/post?slug=cad-ai-dwg-dxf-object-audit') },
  { url: 'https://blog.hequbing.com/api/posts', verify: t => JSON.parse(t).length === posts.length },
  { url: 'https://www.hequbing.com/sitemap.xml', verify: t => (t.match(/<loc>/g) || []).length === 41 },
  { url: 'https://blog.hequbing.com/post?slug=ai-housing-era', verify: t => t.includes(posts.find(p => p.slug === 'ai-housing-era').content) },
  { url: 'https://blog.hequbing.com/post?slug=missing-post-verify', status: 404, verify: t => t.includes('content="noindex"') },
  ...posts.filter(p => p.source).map(p => ({ url: 'https://blog.hequbing.com/post?slug=' + p.slug, verify: t => t.includes(p.content) && t.includes('data-rendered-slug="' + p.slug + '"') && JSON.parse(t.match(/id="schema-json">([\s\S]*?)<\/script>/)[1]).isBasedOn === p.source.url })),
];
async function main() {
  const results = [];
  for (let i = 0; i < checks.length; i += 4) {
    const batch = await Promise.all(checks.slice(i, i + 4).map(async check => {
      const url = check.url + (check.url.includes('?') ? '&' : '?') + 'release_verify=' + stamp;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'Cache-Control': 'no-cache' } });
        const text = await r.text();
        return { url: check.url, status: r.status, chars: text.length, passed: r.status === (check.status || 200) && check.verify(text), cache: r.headers.get('x-vercel-cache') };
      } catch (e) { return { url: check.url, passed: false, error: e.message }; }
    }));
    results.push(...batch);
  }
  const report = { checked_at: new Date().toISOString(), channel: 'public_https_via_local_proxy', expected_posts: posts.length, checks: results, passed: results.every(r => r.passed), ranking: 'not_measured', ai_citations: 'not_measured', inquiries: 'not_measured' };
  fs.writeFileSync(path.join(__dirname, '2026-10-02-production-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
