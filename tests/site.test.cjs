'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { renderPostPage } = require('../api/render-post');
const { pagePairs, postUrl, alternateLinks } = require('../lib/localization');
const root = path.join(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'data/posts.json'), 'utf8'));
const selected = posts.filter(p => p.source && p.source.type === 'author_wechat');

test('全部文章直接返回正文、唯一 canonical 和与正文对应的元数据', () => {
  assert.equal(new Set(posts.map(p => p.slug)).size, posts.length);
  assert.equal(new Set(posts.map(p => p.id)).size, posts.length);
  for (const p of posts) {
    const { status, html } = renderPostPage(p.slug);
    assert.equal(status, 200);
    assert.ok(html.includes(p.content), p.slug);
    assert.ok(html.includes('data-rendered-slug="' + p.slug + '"'));
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    const schema = JSON.parse(html.match(/id="schema-json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema.headline, p.title);
    assert.equal(schema.datePublished, p.date);
    assert.equal(schema.author.alternateName, '贺方升');
    assert.equal(schema.mainEntityOfPage, 'https://blog.hequbing.com/post?slug=' + p.slug);
    if (p.source) assert.equal(schema.isBasedOn, p.source.url);
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html.replace(/<!--.*?-->/gs, '')));
  }
  assert.equal(renderPostPage('missing-post').status, 404);
  assert.ok(renderPostPage('missing-post').html.includes('content="noindex"'));
  assert.ok(renderPostPage('').html.includes('content="noindex"'));
});

test('9篇来源可追溯，站内正文链接与精选入口没有丢失', () => {
  assert.equal(selected.length, 9);
  assert.deepEqual(selected.map(p => p.source.id).sort(), ['001','003','004','012','021','022','030','038','083']);
  const sitemap = fs.readFileSync(path.join(root, 'public/sitemap.xml'), 'utf8');
  const archive = fs.readFileSync(path.join(root, 'public/archive.html'), 'utf8');
  for (const p of posts) {
    assert.ok(sitemap.includes('/post?slug=' + p.slug));
    assert.ok(archive.includes('/post?slug=' + p.slug));
  }
  for (const p of selected) {
    assert.ok(p.content.includes(p.source.url));
    assert.ok(p.content.includes('hecare888'));
    assert.ok(p.content.length > 900);
    assert.ok(!/<script\b|onerror\s*=|mmbiz\.qpic/i.test(p.content));
    for (const match of p.content.matchAll(/href="https:\/\/blog\.hequbing\.com\/post\?slug=([^"]+)"/g)) {
      assert.ok(posts.some(q => q.slug === match[1]), 'Broken article link: ' + match[1]);
    }
    for (const file of ['index.html', 'about.html']) {
      assert.ok(fs.readFileSync(path.join(root, 'public', file), 'utf8').includes('/post?slug=' + p.slug));
    }
  }
});

function runClient({ rendered, listFails = true, english = false }) {
  const p = selected[0];
  const copy = english ? p.translations.en : p;
  const elements = {
    post: { dataset: { renderedSlug: rendered ? p.slug : '', language: english ? 'en' : 'zh-CN' } },
    'post-title': { textContent: rendered ? copy.title : '' },
    'post-content': { innerHTML: rendered ? copy.content : '' },
    'post-nav': { innerHTML: '' },
    'related-section': { style: {} },
    'related-posts': { innerHTML: '' },
  };
  const requests = [];
  const context = {
    URLSearchParams,
    window: { location: { search: '?slug=' + p.slug, href: 'https://blog.hequbing.com/post?slug=' + p.slug } },
    document: { getElementById: id => elements[id], querySelectorAll: () => [] },
    fetch: async url => {
      requests.push(url);
      if (listFails || url !== '/api/posts') throw new Error('API unavailable');
      return { ok: true, json: async () => posts };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/post.js'), 'utf8'), context);
  return new Promise(resolve => setImmediate(() => resolve({ p, elements, requests })));
}

test('API全不可用时保留服务端正文，旧空模板仍显示明确错误', async () => {
  const ssr = await runClient({ rendered: true });
  assert.equal(ssr.elements['post-title'].textContent, ssr.p.title);
  assert.equal(ssr.elements['post-content'].innerHTML, ssr.p.content);
  assert.deepEqual(ssr.requests, ['/api/posts']);
  const legacy = await runClient({ rendered: false });
  assert.equal(legacy.elements['post-title'].textContent, '文章加载失败');
  assert.ok(legacy.elements['post-content'].innerHTML.includes('返回归档'));
});

test('服务端正文就绪时，只用列表增强导航而不再请求详情', async () => {
  const ssr = await runClient({ rendered: true, listFails: false });
  assert.equal(ssr.elements['post-content'].innerHTML, ssr.p.content);
  assert.ok(ssr.elements['post-nav'].innerHTML.includes('/post?slug='));
  assert.ok(ssr.elements['related-posts'].innerHTML.includes('/post?slug='));
  assert.deepEqual(ssr.requests, ['/api/posts']);
});

test('静态生成可重复运行，页面JSON-LD可解析且GEO不使用旧规则', () => {
  const files = [...fs.readdirSync(path.join(root, 'public')).filter(f => f.endsWith('.html')), ...fs.readdirSync(path.join(root, 'public/en')).filter(f => f.endsWith('.html')).map(f => 'en/' + f)];
  const before = files.map(f => fs.readFileSync(path.join(root, 'public', f), 'utf8'));
  const build = spawnSync(process.execPath, ['scripts/build-static.js'], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.equal(build.status, 0, build.stderr);
  files.forEach((file, i) => {
    const html = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.equal(html, before[i], 'Non-idempotent: ' + file);
    for (const match of html.matchAll(/type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      if (match[1].trim()) JSON.parse(match[1]);
    }
  });
  const geo = fs.readFileSync(path.join(root, 'public/geo.html'), 'utf8');
  assert.ok(!/主要依赖 Bing|基本读不到公众号|结果才会相对稳定/.test(geo));
});

test('英文正文与元数据对应，中英文hreflang互指，未翻译文章返回404', () => {
  assert.equal(posts.filter(p => p.translations && p.translations.en).length, 9);
  for (const p of selected) {
    const t = p.translations.en;
    assert.ok(t.content.length > 1800, p.slug);
    assert.ok(t.content.includes(p.source.url));
    const { status, html } = renderPostPage(p.slug, 'en');
    assert.equal(status, 200);
    assert.ok(html.includes('<html lang="en">'));
    assert.ok(html.includes(t.content));
    assert.ok(!html.includes(p.content));
    assert.ok(html.includes('href="' + postUrl(p.slug) + '" lang="zh-CN"'));
    const alternates = alternateLinks(postUrl(p.slug), postUrl(p.slug, 'en'));
    assert.ok(html.includes(alternates));
    assert.ok(renderPostPage(p.slug).html.includes(alternates));
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html.replace(/<!--.*?-->/gs, '')));
    const schema = JSON.parse(html.match(/id="schema-json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema.headline, t.title);
    assert.equal(schema.inLanguage, 'en');
    assert.equal(schema.mainEntityOfPage, postUrl(p.slug, 'en'));
    assert.equal(schema.author['@id'], 'https://www.hequbing.com/about#person');
    assert.equal(schema.isBasedOn, p.source.url);
    for (const match of html.matchAll(/href="https:\/\/blog\.hequbing\.com\/en\/post\?slug=([^"]+)"/g)) {
      assert.ok(selected.some(q => q.slug === match[1]), 'Missing English link: ' + match[1]);
    }
  }
  const untranslated = posts.find(p => !p.translations);
  const missing = renderPostPage(untranslated.slug, 'en');
  assert.equal(missing.status, 404);
  assert.ok(missing.html.includes('content="noindex"'));
  assert.ok(missing.html.includes(postUrl(untranslated.slug)));
  assert.ok(!missing.html.includes(untranslated.content));
  assert.ok(!missing.html.includes('hreflang='));
  assert.equal(renderPostPage('missing-post', 'en').status, 404);
});

test('英文前端保留服务端译文，列表API不可用也不请求或覆盖中文数据', async () => {
  const result = await runClient({ rendered: true, english: true });
  assert.deepEqual(result.requests, []);
  assert.equal(result.elements['post-title'].textContent, result.p.translations.en.title);
  assert.equal(result.elements['post-content'].innerHTML, result.p.translations.en.content);
});

test('静态双语页面、观察入口、canonical 地址和两类报价完整', () => {
  const sitemap = fs.readFileSync(path.join(root, 'public/sitemap.xml'), 'utf8');
  const urls = Array.from(sitemap.matchAll(/<loc>(.*?)<\/loc>/g), m => m[1]);
  assert.equal(urls.length, 9 + pagePairs.length + posts.length + posts.filter(p => p.translations && p.translations.en).length);
  assert.ok(urls.includes('https://www.hequbing.com/observe'));
  assert.ok(urls.includes('https://www.hequbing.com/observe/rankings'));
  assert.equal(new Set(urls).size, urls.length);
  for (const pair of pagePairs) {
    const zh = fs.readFileSync(path.join(root, 'public', pair.file), 'utf8');
    const en = fs.readFileSync(path.join(root, 'public/en', pair.file), 'utf8');
    assert.ok(zh.includes(alternateLinks(pair.zh, pair.en)));
    assert.ok(en.includes(alternateLinks(pair.zh, pair.en)));
    assert.ok(zh.includes('href="' + pair.en + '" lang="en"'));
    assert.ok(en.includes('href="' + pair.zh + '" lang="zh-CN"'));
    assert.ok(en.includes('<html lang="en">'));
    assert.ok(en.includes('rel="canonical" href="' + pair.en + '"'));
    assert.ok(urls.includes(pair.en));
    assert.equal((en.match(/<h1\b/g) || []).length, 1);
  }
  const archive = fs.readFileSync(path.join(root, 'public/en/archive.html'), 'utf8');
  for (const p of selected) {
    assert.ok(archive.includes(postUrl(p.slug, 'en')));
    assert.ok(urls.includes(postUrl(p.slug, 'en')));
  }
  const services = fs.readFileSync(path.join(root, 'public/en/services.html'), 'utf8');
  const graph = JSON.parse(services.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const offers = graph[0].itemListElement.map(p => p.item.offers);
  assert.deepEqual(offers.map(o => o.price || o.priceSpecification.minPrice), ['30000', '180000', 600000, 8000]);
  assert.ok(offers.every(o => (o.priceCurrency || o.priceSpecification.priceCurrency) === 'CNY'));
  assert.ok(services.includes('id="consulting"') && services.includes('id="dev"'));
});

test('真实HTTP路由返回新GEO、服务页和完整文章，未知文章404', async () => {
  const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const ready = new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Server start timed out: ' + log)), 10000);
    child.stdout.on('data', data => {
      log += data;
      const m = log.match(/localhost:(\d+)/);
      if (m) { clearTimeout(timer); resolve('http://127.0.0.1:' + m[1]); }
    });
    child.once('error', e => { clearTimeout(timer); reject(e); });
  });
  try {
    const base = await ready;
    const blogRoot = await new Promise((resolve, reject) => {
      const req = http.get(base + '/', { headers: { Host: 'blog.hequbing.com' } }, res => {
        res.resume();
        resolve({ status: res.statusCode, location: res.headers.location });
      });
      req.setTimeout(5000, () => req.destroy(new Error('Host routing timed out')));
      req.on('error', reject);
    });
    assert.equal(blogRoot.status, 308);
    assert.equal(blogRoot.location, 'https://blog.hequbing.com/archive');
    const englishBlogRoot = await new Promise((resolve, reject) => {
      const req = http.get(base + '/en', { headers: { Host: 'blog.hequbing.com' } }, res => {
        res.resume();
        resolve({ status: res.statusCode, location: res.headers.location });
      });
      req.setTimeout(5000, () => req.destroy(new Error('English host routing timed out')));
      req.on('error', reject);
    });
    assert.equal(englishBlogRoot.status, 308);
    assert.equal(englishBlogRoot.location, 'https://blog.hequbing.com/en/archive');
    const mainRoot = await fetch(base + '/', { signal: AbortSignal.timeout(5000) });
    assert.equal(mainRoot.status, 200);
    assert.ok((await mainRoot.text()).includes('id="practice"'));
    for (const route of ['/geo', '/services', '/archive', '/observe', '/observe/rankings']) {
      const r = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
      assert.equal(r.status, 200, route);
    }
    const observe = await (await fetch(base + '/observe/manifest.json', { signal: AbortSignal.timeout(5000) })).json();
    assert.equal(observe.transport, 'github');
    assert.equal(observe.api, null);
    const catalog = await (await fetch(base + '/observe/catalog.json', { signal: AbortSignal.timeout(5000) })).json();
    for (const id of ['cpent', 'phibong', 'kingbill-design']) assert.ok(catalog.records.some(r => r.company.id === id));
    const rankings = await (await fetch(base + '/observe/rankings')).text();
    assert.match(rankings, /<base href="\/observe\/rankings\/">/);
    const design = await (await fetch(base + '/observe/rankings/data/2026-10/industrial-design.json')).json();
    assert.equal(design.status, 'planned');
    assert.equal(design.reportable, false);
    assert.deepEqual(design.rows, []);
    assert.equal(design.candidateReview.entities[0].id, 'kingbill-design');
    assert.equal((await fetch(base + '/observe/SKILL.md', { signal: AbortSignal.timeout(5000) })).status, 200);
    const r = await fetch(base + '/post?slug=' + selected[0].slug, { signal: AbortSignal.timeout(5000) });
    assert.equal(r.status, 200);
    assert.ok((await r.text()).includes(selected[0].content));
    assert.equal((await fetch(base + '/post?slug=missing-post', { signal: AbortSignal.timeout(5000) })).status, 404);
    for (const route of ['/en', '/en/services', '/en/geo', '/en/about', '/en/archive', ...selected.map(p => '/en/post?slug=' + p.slug)]) {
      const r = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
      assert.equal(r.status, 200, route);
      assert.ok((await r.text()).includes('<html lang="en">'), route);
    }
    assert.equal((await fetch(base + '/en/post?slug=' + posts.find(p => !p.translations).slug, { signal: AbortSignal.timeout(5000) })).status, 404);
  } finally {
    child.kill();
    if (child.exitCode === null) await once(child, 'exit');
  }
});
