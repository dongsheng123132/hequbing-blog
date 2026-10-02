const fs = require('fs');
const path = require('path');
const { escapeHtml, localizedPost, postUrl, alternateLinks, WWW, BLOG } = require('../lib/localization');

// /post?slug=xxx 由这里服务端渲染（vercel.json 把 /post 改写到本函数）。
// 正文直接写进 HTML，爬虫和 AI 引擎不执行 JS 也能读到；post.js 照常在浏览器里补上下篇、相关文章和分享。

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

function articleLinks(posts, post, english) {
  if (!post) return { nav: '', related: '' };
  const sorted = [...posts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const index = sorted.findIndex(p => p.slug === post.slug);
  const language = english ? 'en' : 'zh-CN';
  const link = (p, label, className) => p ? '<a class="post-nav-link ' + className + '" href="' + postUrl(p.slug, language) + '"><span>' + label + '</span><b>' + escapeHtml(p.title) + '</b></a>' : '';
  const nav = link(sorted[index + 1], english ? '← Previous' : '← 上一篇', 'prev') + link(sorted[index - 1], english ? 'Next →' : '下一篇 →', 'next');
  const related = sorted.filter(p => p.slug !== post.slug)
    .map(p => ({ post: p, score: (p.tags || []).filter(t => (post.tags || []).includes(t)).length }))
    .filter(p => p.score).sort((a, b) => b.score - a.score).slice(0, 3)
    .map(({ post: p }) => '<a class="related-card" href="' + postUrl(p.slug, language) + '"><b class="related-title">' + escapeHtml(p.title) + '</b><span class="related-summary">' + escapeHtml(p.summary) + '</span></a>').join('');
  return { nav, related };
}

function renderPostPage(slug, language = 'zh-CN') {
  const english = language === 'en';
  const template = fs.readFileSync(path.join(process.cwd(), 'data', 'post-template.html'), 'utf-8');
  const all = readPosts();
  const original = slug ? all.find(p => p.slug === slug) : null;
  const post = localizedPost(original, language);
  const archive = BLOG + (english ? '/en/archive' : '/archive');
  const about = WWW + (english ? '/en/about' : '/about');
  const home = WWW + (english ? '/en' : '/');
  const bothLanguages = original && original.translations && original.translations.en;

  let status = 200;
  let vars;
  if (post) {
    const url = postUrl(post.slug, language);
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.summary,
      datePublished: post.date,
      ...(post.dateModified ? { dateModified: post.dateModified } : {}),
      keywords: (post.tags || []).join(', '),
      inLanguage: english ? 'en' : 'zh-CN',
      author: { '@type': 'Person', '@id': WWW + '/about#person', name: english ? 'Hequbing (He Fangsheng)' : '贺去病', alternateName: english ? ['贺去病', '贺方升', 'Dosen'] : '贺方升', url: about },
      publisher: { '@type': 'Person', name: english ? 'Hequbing' : '贺去病' },
      mainEntityOfPage: url,
      ...(post.source && post.source.url ? { isBasedOn: post.source.url } : {}),
    };
    vars = {
      PAGE_TITLE: escapeHtml(post.title + (english ? ' | Hequbing' : ' | 贺去病 · 博客')),
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
        '<a href="' + about + '">' + (english ? 'By Hequbing (He Fangsheng)' : '作者：贺去病（贺方升）') + '</a>' +
        '<span>' + (english ? estimateReadTime(post.content) + ' min read' : '阅读约 ' + estimateReadTime(post.content) + ' 分钟') + '</span>' +
        (post.tags || []).map(t =>
          '<a class="case-card-tag" style="text-decoration:none" href="' + archive + (english ? '' : '?tag=' + encodeURIComponent(t)) + '">#' + escapeHtml(t) + '</a>'
        ).join(''),
      POST_CONTENT: post.content || '',
    };
  } else {
    // 没有 slug 或找不到文章：返回空壳，交给 post.js 显示提示；不让搜索引擎收录
    status = slug ? 404 : 200;
    vars = {
      PAGE_TITLE: english ? 'Article unavailable | Hequbing' : '文章详情 | 贺去病 · 博客',
      OG_TITLE: english ? 'Hequbing' : '贺去病 · 博客',
      DESCRIPTION: english ? 'This article is not available in English.' : '贺去病博客文章详情页。',
      URL: BLOG + (english ? '/en/post' : '/post'),
      ROBOTS: '<meta name="robots" content="noindex" />\n  ',
      SCHEMA: '{}',
      POST_TITLE: english ? 'Article not available in English' : '',
      POST_SLUG: '',
      POST_META: '',
      POST_CONTENT: english ? '<p>Browse <a href="' + archive + '">English articles</a>' + (original ? ' or read <a href="' + postUrl(original.slug) + '">the Chinese original</a>' : '') + '.</p>' : '',
    };
  }

  const links = articleLinks(all.map(p => localizedPost(p, language)).filter(Boolean), post, english);
  Object.assign(vars, {
    LANG: english ? 'en' : 'zh-CN',
    ALTERNATES: post && bothLanguages ? alternateLinks(postUrl(post.slug), postUrl(post.slug, 'en')) : '',
    LANGUAGE_SWITCH: post && bothLanguages ? '<a href="' + postUrl(post.slug, english ? 'zh-CN' : 'en') + '" lang="' + (english ? 'zh-CN' : 'en') + '">' + (english ? '中文' : 'English') + '</a>' : '',
    BRAND: english ? 'Hequbing · Articles' : '贺去病 · 博客',
    ARCHIVE_URL: archive, ABOUT_URL: about, MAIN_URL: home,
    EXTRA_NAV: english ? '' : '<a href="' + BLOG + '/tags">标签</a><a href="' + BLOG + '/ai-nav/">AI导航</a>',
    ARCHIVE_LABEL: english ? 'Articles' : '归档', ABOUT_LABEL: english ? 'About' : '关于',
    HOME_LABEL: english ? 'Business consulting' : '商业咨询', BACK_LABEL: english ? '← All articles' : '← 返回归档',
    SHARE_LABEL: english ? 'Share:' : '分享：', COPY_LABEL: english ? 'Copy link' : '复制链接',
    WEIBO_LABEL: english ? 'Weibo' : '微博', WEIBO_TITLE: english ? 'Share on Weibo' : '分享到微博',
    X_TITLE: english ? 'Share on X' : '分享到 X',
    RELATED_LABEL: english ? 'Related articles' : '相关文章',
    POST_NAV: links.nav, RELATED_POSTS: links.related,
  });

  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => (key in vars ? vars[key] : m));
  return { status, html };
}

function handleRequest(req, res, language = 'zh-CN') {
  const slug = (req.query && req.query.slug) ||
    new URL(req.url, 'http://localhost').searchParams.get('slug') || '';
  const { status, html } = renderPostPage(String(slug), language);
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.end(html);
}

module.exports = (req, res) => handleRequest(req, res);
module.exports.handleRequest = handleRequest;
module.exports.renderPostPage = renderPostPage;
