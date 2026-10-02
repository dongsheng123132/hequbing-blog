#!/usr/bin/env node
/**
 * 把「靠 JS 才显示」的内容预先写进 HTML，让不执行 JS 的爬虫和 AI 引擎也能读到：
 *
 * 1. 文章列表：<!-- AUTO:POSTS:START limit=6 --> … <!-- AUTO:POSTS:END -->
 *    从 data/posts.json 生成（limit 省略 = 全部）。归档页的 archive.js 加载后会照常替换成可筛选的卡片。
 * 2. FAQ 结构化数据：<!-- AUTO:FAQ-JSONLD:START --> … <!-- AUTO:FAQ-JSONLD:END -->
 *    从同一页面里 .faq-details 的 <details><summary>问</summary><p>答</p></details> 生成 FAQPage JSON-LD，
 *    保证结构化数据和页面上看得到的问答永远一致。改 FAQ 只改 HTML，再跑一次本脚本。
 *
 * 用法：npm run sitemap（会先生成 sitemap，再跑本脚本）
 */
const fs = require('fs');
const path = require('path');
const { pagePairs, alternateLinks } = require('../lib/localization');
const { buildEnglish } = require('./build-english');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const POSTS_PATH = path.join(__dirname, '..', 'data', 'posts.json');
const BLOG_URL = 'https://blog.hequbing.com';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderPostList(posts, limit, indent) {
  const items = (limit ? posts.slice(0, limit) : posts).map(p =>
    `${indent}  <li><time datetime="${escapeHtml(p.date)}">${escapeHtml(p.date)}</time>` +
    `<a href="${BLOG_URL}/post?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></li>`
  );
  return `${indent}<ul class="post-list-static">\n${items.join('\n')}\n${indent}</ul>`;
}

function renderSelectedWorks(posts, indent) {
  const selected = posts.filter(p => p.source && p.source.type === 'author_wechat');
  return `${indent}<div class="mini-grid">\n` + selected.map(p =>
    `${indent}  <div class="mini-card"><h3><a href="${BLOG_URL}/post?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h3><p>${escapeHtml(p.summary)}</p></div>`
  ).join('\n') + `\n${indent}</div>`;
}

function renderFaqJsonLd(html, indent) {
  const faqBlock = html.match(/<div class="faq-details">([\s\S]*?)\n\s*<\/div>/);
  if (!faqBlock) return null;
  const qa = [];
  const re = /<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
  let m;
  while ((m = re.exec(faqBlock[1]))) {
    qa.push({
      '@type': 'Question',
      name: stripTags(m[1]),
      acceptedAnswer: { '@type': 'Answer', text: stripTags(m[2]) },
    });
  }
  if (!qa.length) return null;
  const json = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa }, null, 2)
    .replace(/</g, '\\u003c')
    .split('\n')
    .map(line => indent + '  ' + line)
    .join('\n');
  return `${indent}<script type="application/ld+json">\n${json}\n${indent}</script>`;
}

function build() {
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf-8'))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const files = fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html'));
  for (const f of files) {
    const file = path.join(PUBLIC_DIR, f);
    const before = fs.readFileSync(file, 'utf-8');
    let html = before;

    const pair = pagePairs.find(p => p.file === f);
    if (pair) {
      const head = '<!-- AUTO:LANGUAGE:START -->\n  ' + alternateLinks(pair.zh, pair.en) + '\n  <!-- AUTO:LANGUAGE:END -->';
      const nav = '<!-- AUTO:LANGUAGE-NAV:START --><a href="' + pair.en + '" lang="en">English</a><!-- AUTO:LANGUAGE-NAV:END -->';
      html = html.includes('<!-- AUTO:LANGUAGE:START -->')
        ? html.replace(/<!-- AUTO:LANGUAGE:START -->[\s\S]*?<!-- AUTO:LANGUAGE:END -->/, head)
        : html.replace('</head>', '  ' + head + '\n</head>');
      html = html.includes('<!-- AUTO:LANGUAGE-NAV:START -->')
        ? html.replace(/<!-- AUTO:LANGUAGE-NAV:START -->[\s\S]*?<!-- AUTO:LANGUAGE-NAV:END -->/, nav)
        : html.replace(/(<nav class="nav">[\s\S]*?)(\s*<\/nav>)/, '$1\n          ' + nav + '$2');
    }

    html = html.replace(
      /^([ \t]*)<!-- AUTO:SELECTED-WORKS:START -->[\s\S]*?<!-- AUTO:SELECTED-WORKS:END -->/gm,
      (all, indent) => `${indent}<!-- AUTO:SELECTED-WORKS:START -->\n` +
        renderSelectedWorks(posts, indent) + `\n${indent}<!-- AUTO:SELECTED-WORKS:END -->`
    );

    html = html.replace(
      /^([ \t]*)<!-- AUTO:POSTS:START(?: limit=(\d+))? -->[\s\S]*?<!-- AUTO:POSTS:END -->/gm,
      (all, indent, limit) =>
        `${indent}<!-- AUTO:POSTS:START${limit ? ' limit=' + limit : ''} -->\n` +
        renderPostList(posts, limit ? parseInt(limit, 10) : 0, indent) +
        `\n${indent}<!-- AUTO:POSTS:END -->`
    );

    html = html.replace(
      /^([ \t]*)<!-- AUTO:FAQ-JSONLD:START -->[\s\S]*?<!-- AUTO:FAQ-JSONLD:END -->/gm,
      (all, indent) => {
        const block = renderFaqJsonLd(html, indent);
        return `${indent}<!-- AUTO:FAQ-JSONLD:START -->\n` +
          (block ? block + '\n' : '') +
          `${indent}<!-- AUTO:FAQ-JSONLD:END -->`;
      }
    );

    if (html !== before) {
      fs.writeFileSync(file, html, 'utf-8');
      console.log('updated', f);
    }
  }
  buildEnglish(posts);
}

build();
