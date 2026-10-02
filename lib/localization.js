'use strict';
const WWW = 'https://www.hequbing.com';
const BLOG = 'https://blog.hequbing.com';
const pagePairs = [
  { file: 'index.html', zh: WWW + '/', en: WWW + '/en' },
  { file: 'services.html', zh: WWW + '/services', en: WWW + '/en/services' },
  { file: 'about.html', zh: WWW + '/about', en: WWW + '/en/about' },
  { file: 'geo.html', zh: WWW + '/geo', en: WWW + '/en/geo' },
  { file: 'archive.html', zh: BLOG + '/archive', en: BLOG + '/en/archive' },
];
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function postUrl(slug, language = 'zh-CN') {
  return BLOG + (language === 'en' ? '/en/post' : '/post') + '?slug=' + encodeURIComponent(slug);
}
function localizedPost(post, language = 'zh-CN') {
  if (!post) return null;
  if (language !== 'en') return post;
  const translation = post.translations && post.translations.en;
  return translation ? { ...post, ...translation } : null;
}
function alternateLinks(zh, en) {
  return [['zh-CN', zh], ['en', en], ['x-default', zh]].map(([lang, url]) =>
    '<link rel="alternate" hreflang="' + lang + '" href="' + escapeHtml(url) + '" />'
  ).join('\n  ');
}
module.exports = { WWW, BLOG, pagePairs, escapeHtml, postUrl, localizedPost, alternateLinks };
