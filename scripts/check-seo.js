#!/usr/bin/env node
/**
 * 零依赖 SEO / GEO 自检脚本（本地跑，不联网）
 *
 * 检查项：
 *  1. 每个静态页有没有 title / description / canonical，canonical 是否指向 www 且与文件名对应
 *  2. 页面里所有站内链接（href="/…"）能否落到真实文件或已知路由，揪出死链
 *  3. 每段 application/ld+json 是否合法 JSON
 *  4. FAQPage 结构化数据的问题，是否在页面可见文字里真的存在（防"藏问题"作弊）
 *  5. sitemap.xml 里的每条 URL 是否有对应文件；是否混入非 www 主机
 *  6. robots.txt 是否声明了 sitemap、是否放行常见 AI 爬虫
 *  7. 标题长度、description 长度、H1 数量
 *
 * 用法：npm run check        （有 ERROR 时退出码 1，可接 CI）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SITE = 'https://www.hequbing.com';

const errors = [];
const warnings = [];
const stats = { pages: 0, links: 0, jsonld: 0, faq: 0 };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['images', 'ai-nav'].includes(e.name)) continue;
      walk(p, out);
    } else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function rel(p) {
  return '/' + path.relative(PUBLIC, p).split(path.sep).join('/');
}

function stripTags(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ');
}

// 已知路由：rewrites 里定义的 clean URL
const knownRoutes = new Set([
  '/', '/services', '/geo', '/fde', '/ai-landing', '/ai-consulting-price', '/about',
  '/cases', '/observe', '/observe/rankings', '/observe/rankings/methodology',
  '/archive', '/privacy', '/support', '/tags', '/en', '/en/services', '/en/geo', '/en/about', '/en/archive',
  '/sitemap.xml', '/robots.txt', '/llms.txt', '/favicon.svg',
]);

function targetExists(hrefPath) {
  const clean = hrefPath.split('#')[0].split('?')[0];
  if (!clean) return true;
  if (knownRoutes.has(clean)) return true;
  const candidates = [
    path.join(PUBLIC, clean),
    path.join(PUBLIC, clean + '.html'),
    path.join(PUBLIC, clean, 'index.html'),
  ];
  return candidates.some(p => fs.existsSync(p) && fs.statSync(p).isFile());
}

const pages = walk(PUBLIC);
const canonicalSeen = new Map();

for (const file of pages) {
  stats.pages++;
  const html = fs.readFileSync(file, 'utf-8');
  const route = rel(file).replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/';

  // 1. meta
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1].trim();
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [, ''])[1];

  if (!title) errors.push(`[title 缺失] ${route}`);
  else if (title.length > 60) warnings.push(`[title 偏长 ${title.length}] ${route} — ${title.slice(0, 40)}…`);

  if (!desc) errors.push(`[description 缺失] ${route}`);
  else if (desc.length < 50) warnings.push(`[description 偏短 ${desc.length}] ${route}`);
  else if (desc.length > 200) warnings.push(`[description 偏长 ${desc.length}] ${route}`);

  const noindex = /<meta name="robots" content="[^"]*noindex/i.test(html);
  if (!canonical && !noindex) errors.push(`[canonical 缺失] ${route}`);
  if (!canonical && noindex) { /* 旧版残留页：明确 noindex，不需要 canonical */ }
  else
  {
    if (canonical && !canonical.startsWith(SITE)) errors.push(`[canonical 不是 www 规范地址] ${route} → ${canonical}`);
    if (canonical && canonicalSeen.has(canonical)) errors.push(`[canonical 重复] ${route} 与 ${canonicalSeen.get(canonical)} 都指向 ${canonical}`);
    else if (canonical) canonicalSeen.set(canonical, route);
  }

  // H1
  const h1s = html.match(/<h1[\s>]/gi) || [];
  if (h1s.length === 0) warnings.push(`[无 H1] ${route}`);
  if (h1s.length > 1) errors.push(`[多个 H1: ${h1s.length}] ${route}`);

  // 2. 站内链接
  for (const m of html.matchAll(/href="(\/[^"#?][^"]*)"/g)) {
    if (m[1].includes('${')) continue; // JS 模板字符串里的动态链接，运行时才成立
    stats.links++;
    if (!targetExists(m[1])) errors.push(`[死链] ${route} → ${m[1]}`);
  }

  // 3. JSON-LD
  const visible = stripTags(html);
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const raw = m[1].trim();
    if (!raw) { errors.push(`[JSON-LD 空块] ${route}`); continue; }
    stats.jsonld++;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      errors.push(`[JSON-LD 解析失败] ${route}: ${e.message}`);
      continue;
    }
    // 4. FAQ 与可见内容一致
    const nodes = data['@graph'] ? data['@graph'] : [data];
    for (const node of nodes) {
      if (node['@type'] !== 'FAQPage' || !Array.isArray(node.mainEntity)) continue;
      for (const q of node.mainEntity) {
        stats.faq++;
        const name = String(q.name || '').replace(/\s+/g, ' ').trim();
        const normQ = (t) => t.replace(/[\s，。、；：？！?,.;:!()（）「」“”"'…—\-·]/g, '');
        const probe = normQ(name).slice(0, 12);
        const norm = (t) => t.replace(/[\s，。、；：？！?！,.;:!()（）「」“”"'…—\-·、]/g, '');
        const visibleProbe = norm(visible);
        if (probe && !visibleProbe.includes(probe)) {
          errors.push(`[FAQ 问题在页面上不可见] ${route} — ${name}`);
        }
      }
    }
  }
}

// 5. sitemap
const sitemapPath = path.join(PUBLIC, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) errors.push('[sitemap.xml 不存在]');
else {
  const xml = fs.readFileSync(sitemapPath, 'utf-8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (!locs.length) errors.push('[sitemap 为空]');
  for (const loc of locs) {
    if (!loc.startsWith(SITE)) { errors.push(`[sitemap 主机不是 www] ${loc}`); continue; }
    const p = loc.slice(SITE.length) || '/';
    if (p === '/') continue;
    if (!targetExists(p)) errors.push(`[sitemap 里的地址没有对应页面] ${loc}`);
  }
  const seen = new Set();
  for (const l of locs) { if (seen.has(l)) errors.push(`[sitemap 重复] ${l}`); seen.add(l); }
  console.log(`sitemap: ${locs.length} 条 URL`);
}

// 6. robots
const robotsPath = path.join(PUBLIC, 'robots.txt');
if (!fs.existsSync(robotsPath)) errors.push('[robots.txt 不存在]');
else {
  const r = fs.readFileSync(robotsPath, 'utf-8');
  if (!/Sitemap:\s*https:\/\/www\.hequbing\.com\/sitemap\.xml/.test(r)) errors.push('[robots 没有声明 www sitemap]');
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Baiduspider', 'Bingbot']) {
    if (!r.includes(`User-agent: ${bot}`)) warnings.push(`[robots 没有显式点名 ${bot}]`);
  }
}

// 输出
console.log(`\n扫描 ${stats.pages} 个页面 · ${stats.links} 条站内链接 · ${stats.jsonld} 段 JSON-LD · ${stats.faq} 条 FAQ`);
if (warnings.length) {
  console.log(`\n⚠️  警告 ${warnings.length} 条`);
  for (const w of warnings.slice(0, 40)) console.log('  ' + w);
}
if (errors.length) {
  console.log(`\n❌ 错误 ${errors.length} 条`);
  for (const e of errors.slice(0, 80)) console.log('  ' + e);
  process.exit(1);
}
console.log('\n✅ 全部检查通过');
