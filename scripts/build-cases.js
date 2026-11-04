#!/usr/bin/env node
/**
 * 把「AI 落地情报」从客户端渲染改成静态页：
 *
 * 背景：/cases 和 /case?slug=… 以前全靠 /site.js + fetch 渲染，爬虫和 AI 引擎拿到的是空壳
 *（原始 HTML 里正文约 270 字符）。本脚本把每一条案例预渲染成 public/case/<slug>.html，
 * 并把列表页的卡片也写进静态 HTML，JS 只用来做筛选，不再负责首屏内容。
 *
 * 产出：
 *   1. public/case/<slug>.html   —— 22 个静态详情页，URL 为 /case/<slug>
 *   2. public/cases.html         —— <!-- AUTO:CASES:START/END --> 之间写入静态卡片
 *   3. scripts/case-redirects.json —— /case?slug=xxx → /case/xxx 的 301 规则，供 vercel.json 合并
 *
 * 用法：npm run cases
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CASES_PATH = path.join(ROOT, 'data', 'cases.json');
const SITE = 'https://www.hequbing.com';
const WECHAT = 'hecare888';
const EMAIL = 'hefangsheng@gmail.com';

const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf-8'));

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function isOwnWork(c) {
  return c.source === '自有交付' || c.source === '自研项目';
}

const HEADER = `  <header class="site-header">
    <div class="container">
      <div class="header-row">
        <div class="site-title"><a href="/" class="brand"><span class="brand-name">贺去病商业咨询<small>HEQUBING BUSINESS CONSULTING</small></span></a></div>
        <nav class="nav">
          <a href="/services">服务与报价</a>
          <a href="/geo">GEO 优化</a>
          <a href="/fde">FDE</a>
          <a href="/#delivered">真实交付</a>
          <a href="/about">关于贺去病</a>
          <a href="https://blog.hequbing.com/archive">文章</a>
        </nav>
      </div>
    </div>
  </header>`;

const WECHAT_FLOAT = `  <div class="wechat-float">
    <div class="wechat-popup" id="wechat-popup"><button type="button" class="wechat-popup-close" data-wechat-popup-close aria-label="关闭微信联系窗口">×</button>
      <h4>预约免费 30 分钟沟通</h4>
      <div class="wechat-qr-frame"><a class="wechat-image-link" href="/images/hequbing-wechat-original.jpg" data-wechat-image aria-label="点击放大微信二维码"><img src="/images/hequbing-wechat-original.jpg" width="888" height="1131" alt="贺去病本人提供的微信名片二维码" loading="lazy" decoding="async"></a></div><div class="wechat-popup-actions" data-contact-card><p class="wechat-account">微信号 <strong data-wechat-id>${WECHAT}</strong></p><div class="wechat-card-actions"><button type="button" data-copy-wechat>复制微信号</button><a href="/images/hequbing-wechat-original.jpg" download="hequbing-wechat.jpg">保存二维码</a></div><p data-copy-status aria-live="polite" role="status"></p></div>
      <p>复制微信号，备注「咨询」</p>
    </div>
    <button class="wechat-float-btn" onclick="toggleWechat()" title="微信咨询">💬</button>
  </div>`;

const LIGHTBOX = `<dialog id="wechat-lightbox" class="wechat-lightbox" aria-labelledby="wechat-lightbox-title">
  <div class="wechat-lightbox-bar"><h2 id="wechat-lightbox-title">添加贺去病的微信</h2><button type="button" data-wechat-close aria-label="关闭二维码">×</button></div>
  <img src="/images/hequbing-wechat-original.jpg" width="888" height="1131" alt="贺去病微信名片原图，扫描二维码添加好友">
  <p>微信号：<strong>${WECHAT}</strong> · <a href="/images/hequbing-wechat-original.jpg" download="hequbing-wechat.jpg">保存原图</a></p>
</dialog>`;

function renderCasePage(c) {
  const own = isOwnWork(c);
  const url = `${SITE}/case/${c.slug}`;
  const summary = c.summary || stripTags(c.content).slice(0, 120);
  const sourceLabel = c.source || '行业研究';
  const srcLink = c.source_url
    ? ` · <a href="${esc(c.source_url)}" target="_blank" rel="noopener">查看原文</a>`
    : '';

  const notice = own
    ? `<div class="intel-notice"><strong>✅ 自研项目 · 本人交付。</strong>这是我自己做的项目，可以点开代码或链接核验。${srcLink}</div>`
    : `<div class="intel-notice"><strong>📊 这是行业研究，不是我的交付案例。</strong>来源：${esc(sourceLabel)}${srcLink}。整理它是为了帮你判断同类场景值不值得上 AI；本文提到的公司与我没有合作关系。<em>我自己交付的项目在 <a href="/#delivered">首页「我做过什么」</a>。</em></div>`;

  const tags = (c.tags || []).map(t => `<span class="case-card-tag">${esc(t)}</span>`).join('');

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: c.title,
        description: summary,
        datePublished: c.date,
        dateModified: c.date,
        inLanguage: 'zh-CN',
        author: { '@id': `${SITE}/about#person` },
        publisher: { '@id': `${SITE}/#org` },
        mainEntityOfPage: url,
        url,
        isPartOf: { '@id': `${SITE}/cases#page` },
        about: [c.industry, c.scenario].filter(Boolean).map(n => ({ '@type': 'Thing', name: n })),
        disambiguatingDescription: own
          ? '本文为作者本人交付的项目记录。'
          : `本文为公开行业研究整理，来源：${sourceLabel}；文中企业与作者无合作关系。`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'AI 落地情报', item: SITE + '/cases' },
          { '@type': 'ListItem', position: 3, name: c.title, item: url },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(c.title)} | 贺去病商业咨询</title>
  <meta name="description" content="${esc(summary).slice(0, 180)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:title" content="${esc(c.title)}" />
  <meta property="og:description" content="${esc(summary).slice(0, 180)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/contact.css" />
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
  <style>.case-detail h1{font-size:28px;line-height:1.35;margin:0 0 12px}</style>
</head>
<body>
${HEADER}

  <main class="container">
    <nav aria-label="面包屑" style="margin-top:16px;font-size:14px;color:var(--muted)">
      <a href="/" style="color:var(--muted);text-decoration:none">首页</a> ›
      <a href="/cases" style="color:var(--muted);text-decoration:none">AI 落地情报</a> ›
      <span>${esc(c.title)}</span>
    </nav>

    <article class="case-detail">
      <h1>${esc(c.title)}</h1>
      <div class="meta">
        <span>${esc(c.date)}</span>
        <span class="case-card-tag industry">${esc(c.industry || '')}</span>
        <span class="case-card-tag scenario">${esc(c.scenario || '')}</span>
        ${tags}
      </div>
      ${notice}
      <div class="content">${c.content || ''}</div>
    </article>

    <div class="case-cta">
      <h3>${own ? '想在你的企业复制这套做法？' : '你的业务适不适合上 AI？'}</h3>
      <p>先说清你的行业、客户和现在最卡的一步，我给你一个判断，能做的说怎么做，不能做的直说。</p>
      <button class="btn btn-primary" data-wechat-trigger onclick="toggleWechat()">微信咨询 →</button>
    </div>

    <p class="note" style="margin:24px 0 8px">延伸阅读：<a href="/fde">FDE 是什么</a> · <a href="/ai-landing">企业 AI 落地怎么做</a> · <a href="/ai-consulting-price">AI 咨询收费</a> · <a href="/services">服务与报价</a></p>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-content">
        <span>© <span id="year">2026</span> 贺去病商业咨询 · 立足中国 · 服务全球</span>
        <div class="footer-links">
          <a href="/cases">行业情报</a>
          <a href="/services">服务与报价</a>
          <a href="/geo">GEO 优化</a>
          <a href="/fde">FDE</a>
          <a href="/ai-landing">AI 落地</a>
          <a href="/ai-consulting-price">收费标准</a>
          <a href="/about">关于</a>
        </div>
      </div>
    </div>
  </footer>

${WECHAT_FLOAT}
  <script src="/site.js"></script>
${LIGHTBOX}
</body>
</html>
`;
}

function renderCard(c) {
  const own = isOwnWork(c);
  const tags = (c.tags || []).map(t => `<span class="case-card-tag">${esc(t)}</span>`).join('');
  return `        <div class="case-card">
          <div class="case-card-header">
            <div>
              <span class="case-card-tag industry">${esc(c.industry || '')}</span>
              <span class="case-card-tag scenario">${esc(c.scenario || '')}</span>
            </div>
            <span class="case-card-score">🔥 ${esc(c.hot_score || 0)}</span>
          </div>
          <h3 class="case-card-title"><a href="/case/${esc(c.slug)}" style="color:inherit;text-decoration:none">${esc(c.title)}</a></h3>
          <div class="case-card-meta">${tags}</div>
          <p class="case-card-summary">${esc(c.summary || '')}</p>
          <div class="case-card-source">${own ? '✅ 自研项目 · 本人交付' : '📊 ' + esc(c.source || '行业研究') + ' · 非本人交付'}</div>
          <a class="case-card-link" href="/case/${esc(c.slug)}">查看情报详情 →</a>
        </div>`;
}

function build() {
  const outDir = path.join(PUBLIC_DIR, 'case');
  fs.mkdirSync(outDir, { recursive: true });
  for (const c of cases) {
    fs.writeFileSync(path.join(outDir, `${c.slug}.html`), renderCasePage(c), 'utf-8');
  }

  // 列表页静态卡片
  const listPath = path.join(PUBLIC_DIR, 'cases.html');
  let html = fs.readFileSync(listPath, 'utf-8');
  const sorted = [...cases].sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
  const cards = sorted.map(renderCard).join('\n');

  if (!html.includes('<!-- AUTO:CASES:START -->')) {
    html = html.replace(
      /<div id="cases-grid" class="cases-grid">\s*<\/div>/,
      `<div id="cases-grid" class="cases-grid">\n    <!-- AUTO:CASES:START -->\n${cards}\n    <!-- AUTO:CASES:END -->\n    </div>`
    );
  } else {
    html = html.replace(
      /<!-- AUTO:CASES:START -->[\s\S]*?<!-- AUTO:CASES:END -->/,
      `<!-- AUTO:CASES:START -->\n${cards}\n    <!-- AUTO:CASES:END -->`
    );
  }
  // 链接改指向静态地址
  html = html.replace(/href="\/case\?slug=\$\{c\.slug\}"/g, 'href="/case/${c.slug}"');
  html = html.replace(/href="\/case\?slug=/g, 'href="/case/');
  fs.writeFileSync(listPath, html, 'utf-8');

  // 旧地址 301 规则
  const redirects = cases.map(c => ({
    source: '/case',
    has: [{ type: 'query', key: 'slug', value: c.slug }],
    destination: `/case/${c.slug}`,
    permanent: true,
  }));
  fs.writeFileSync(
    path.join(__dirname, 'case-redirects.json'),
    JSON.stringify(redirects, null, 2),
    'utf-8'
  );

  console.log(`Built ${cases.length} static case pages → public/case/`);
  console.log(`Injected ${cases.length} cards into public/cases.html`);
  console.log('Wrote scripts/case-redirects.json');
}

build();
