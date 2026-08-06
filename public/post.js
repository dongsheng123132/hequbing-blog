/**
 * 文章详情页逻辑
 * - 渲染文章、阅读时长、标签
 * - 上一篇 / 下一篇 / 相关文章
 * - 分享（微博 / X / 复制链接）
 * - 阅读进度条 + 动态 meta / JSON-LD
 */
(function () {
  'use strict';

  let currentSlug = null;

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('获取数据失败');
      return r.json();
    });
  }

  // 估算阅读时长：中文字符按 ~350 字/分钟，英文单词按 ~200 词/分钟
  function estimateReadTime(html) {
    const text = (html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const cjk = (text.match(/[一-鿿]/g) || []).length;
    const words = (text.replace(/[一-鿿]/g, ' ').match(/\b[\w'-]+\b/g) || []).length;
    const minutes = Math.ceil(cjk / 350 + words / 200);
    return Math.max(1, minutes);
  }

  function renderMeta(post) {
    const title = document.getElementById('post-title');
    const meta = document.getElementById('post-meta');
    const content = document.getElementById('post-content');

    document.title = post.title + ' | 贺去病 · 博客';
    document.getElementById('meta-desc').content = post.summary || '';
    document.getElementById('og-title').content = post.title;
    document.getElementById('og-desc').content = post.summary || '';
    document.getElementById('og-url').content =
      'https://blog.hequbing.com/post?slug=' + encodeURIComponent(post.slug);

    document.getElementById('schema-json').textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.summary,
      datePublished: post.date,
      keywords: (post.tags || []).join(', '),
      author: { '@type': 'Person', name: '贺去病' },
      publisher: { '@type': 'Person', name: '贺去病' },
      mainEntityOfPage: 'https://blog.hequbing.com/post?slug=' + encodeURIComponent(post.slug)
    });

    const minutes = estimateReadTime(post.content);
    meta.innerHTML =
      '<span>' + (post.date || '') + '</span>' +
      '<span>阅读约 ' + minutes + ' 分钟</span>' +
      (post.tags || []).map(function (t) {
        return '<a class="case-card-tag" style="text-decoration:none" href="/archive?tag=' +
          encodeURIComponent(t) + '">#' + t + '</a>';
      }).join('');

    title.textContent = post.title;
    content.innerHTML = post.content;
  }

  function renderNav(posts) {
    const nav = document.getElementById('post-nav');
    if (!posts || posts.length < 2) {
      nav.innerHTML = '';
      return;
    }
    const idx = posts.findIndex(function (p) { return p.slug === currentSlug; });
    if (idx < 0) {
      nav.innerHTML = '';
      return;
    }
    const prev = posts[idx + 1];
    const next = posts[idx - 1];
    const prevHtml = prev
      ? '<a class="post-nav-link prev" href="/post?slug=' + encodeURIComponent(prev.slug) + '">' +
        '<span>← 上一篇</span><b>' + prev.title + '</b></a>'
      : '<span class="post-nav-link empty"></span>';
    const nextHtml = next
      ? '<a class="post-nav-link next" href="/post?slug=' + encodeURIComponent(next.slug) + '">' +
        '<span>下一篇 →</span><b>' + next.title + '</b></a>'
      : '<span class="post-nav-link empty"></span>';
    nav.innerHTML = prevHtml + nextHtml;
  }

  function renderRelated(posts) {
    const section = document.getElementById('related-section');
    const grid = document.getElementById('related-posts');
    const current = posts.find(function (p) { return p.slug === currentSlug; });
    if (!current) {
      section.style.display = 'none';
      return;
    }
    const currentTags = current.tags || [];
    const scored = posts
      .filter(function (p) { return p.slug !== currentSlug; })
      .map(function (p) {
        const shared = (p.tags || []).filter(function (t) { return currentTags.includes(t); }).length;
        return { post: p, score: shared };
      })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });

    const picks = scored.slice(0, 3).map(function (x) { return x.post; });
    if (picks.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    grid.innerHTML = picks.map(function (p) {
      return '<a class="related-card" href="/post?slug=' + encodeURIComponent(p.slug) + '">' +
        '<span class="related-date">' + (p.date || '') + '</span>' +
        '<b class="related-title">' + p.title + '</b>' +
        '<span class="related-summary">' + (p.summary || '') + '</span>' +
        '</a>';
    }).join('');
  }

  function setupShare() {
    const url = window.location.href;
    document.querySelectorAll('.share-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const type = btn.dataset.share;
        const title = document.getElementById('post-title').textContent;
        if (type === 'weibo') {
          window.open(
            'https://service.weibo.com/share/share.php?url=' + encodeURIComponent(url) +
            '&title=' + encodeURIComponent('【' + title + '】贺去病博客'),
            '_blank', 'width=600,height=520'
          );
        } else if (type === 'x') {
          window.open(
            'https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) +
            '&text=' + encodeURIComponent(title),
            '_blank', 'width=600,height=520'
          );
        } else if (type === 'copy') {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(function () {
              btn.textContent = '已复制 ✓';
              setTimeout(function () { btn.textContent = '复制链接'; }, 1500);
            });
          } else {
            btn.textContent = '复制失败';
          }
        }
      });
    });
  }

  function setupProgress() {
    const bar = document.getElementById('post-progress');
    if (!bar) return;
    function update() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
      bar.style.width = (ratio * 100).toFixed(2) + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  async function init() {
    currentSlug = getQueryParam('slug');
    const titleEl = document.getElementById('post-title');
    const contentEl = document.getElementById('post-content');

    if (!currentSlug) {
      titleEl.textContent = '未指定文章';
      contentEl.innerHTML = '<p>请从<a href="/archive">归档</a>选择一篇文章。</p>';
      return;
    }

    try {
      const post = await fetchJSON('/api/posts/' + encodeURIComponent(currentSlug));
      renderMeta(post);

      let posts = [];
      try {
        posts = await fetchJSON('/api/posts');
        posts.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      } catch (e) { /* 列表失败不影响正文 */ }

      renderNav(posts);
      renderRelated(posts);
      setupShare();
      setupProgress();
    } catch (e) {
      titleEl.textContent = '文章加载失败';
      contentEl.innerHTML = '<p style="color:#ff6b6b">' + e.message + '</p>' +
        '<p><a href="/archive">返回归档</a></p>';
    }
  }

  init();
})();
