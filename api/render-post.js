const fs = require('fs');
const path = require('path');

// /post?slug=xxx 由这里服务端渲染（vercel.json 把 /post 改写到本函数）。
// 正文直接写进 HTML，爬虫和 AI 引擎不执行 JS 也能读到；post.js 照常在浏览器里补上下篇、相关文章和分享。
const SITE_URL = 'https://blog.hequbing.com';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 与 public/post.js 的估算保持一致：中文 ~350 字/分钟，英文 ~200 词/分钟
function estimateReadTime(html) {
  const text = (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  const words = (text.replace(/[一-鿿]/g, ' ').match(/\b[\w'-]+\b/g) || []).length;
  return Math.max(1, Math.ceil(cjk / 350 + words / 200));
}

function readPosts() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'posts.json'), 'utf-8'));
  } catch (e) {
    return [];
  }
}

function renderPostPage(slug) {
  const template = fs.readFileSync(path.join(process.cwd(), 'data', 'post-template.html'), 'utf-8');
  const post = slug ? readPosts().find(p => p.slug === slug) : null;

  let status = 200;
  let vars;
  if (post) {
    const url = SITE_URL + '/post?slug=' + encodeURIComponent(post.slug);
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.summary,
      datePublished: post.date,
      ...(post.dateModified ? { dateModified: post.dateModified } : {}),
      keywords: (post.tags || []).join(', '),
      author: { '@type': 'Person', '@id': 'https://www.hequbing.com/about#person', name: '贺去病', alternateName: '贺方升', url: 'https://www.hequbing.com/about' },
      publisher: { '@type': 'Person', name: '贺去病' },
      mainEntityOfPage: url,
      ...(post.source && post.source.url ? { isBasedOn: post.source.url } : {}),
    };
    vars = {
      PAGE_TITLE: escapeHtml(post.title + ' | 贺去病 · 博客'),
      OG_TITLE: escapeHtml(post.title),
      DESCRIPTION: escapeHtml(post.summary || ''),
      URL: escapeHtml(url),
      ROBOTS: '',
      // 防止正文里出现 </script> 截断 JSON-LD
      SCHEMA: JSON.stringify(schema).replace(/</g, '\\u003c'),
      POST_TITLE: escapeHtml(post.title),
      POST_SLUG: escapeHtml(post.slug),
      POST_META:
        '<span>' + escapeHtml(post.date || '') + '</span>' +
        '<a href="https://www.hequbing.com/about">作者：贺去病（贺方升）</a>' +
        '<span>阅读约 ' + estimateReadTime(post.content) + ' 分钟</span>' +
        (post.tags || []).map(t =>
          '<a class="case-card-tag" style="text-decoration:none" href="/archive?tag=' +
          encodeURIComponent(t) + '">#' + escapeHtml(t) + '</a>'
        ).join(''),
      POST_CONTENT: post.content || '',
    };
  } else {
    // 没有 slug 或找不到文章：返回空壳，交给 post.js 显示提示；不让搜索引擎收录
    status = slug ? 404 : 200;
    vars = {
      PAGE_TITLE: '文章详情 | 贺去病 · 博客',
      OG_TITLE: '贺去病 · 博客',
      DESCRIPTION: '贺去病博客文章详情页。',
      URL: SITE_URL + '/post',
      ROBOTS: '<meta name="robots" content="noindex" />\n  ',
      SCHEMA: '{}',
      POST_TITLE: '',
      POST_SLUG: '',
      POST_META: '',
      POST_CONTENT: '',
    };
  }

  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => (key in vars ? vars[key] : m));
  return { status, html };
}

function handler(req, res) {
  const slug = (req.query && req.query.slug) ||
    new URL(req.url, 'http://localhost').searchParams.get('slug') || '';
  const { status, html } = renderPostPage(String(slug));
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.end(html);
}

module.exports = handler;
module.exports.renderPostPage = renderPostPage;
