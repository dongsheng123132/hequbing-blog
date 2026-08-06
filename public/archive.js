/**
 * 博客归档页逻辑
 * - 支持 ?tag=xxx 参数（从标签页跳入时自动选中）
 * - 搜索框按标题/摘要过滤
 * - 标签筛选 + 按年份分组，卡片化展示
 */
(function () {
  'use strict';

  let allPosts = [];
  let activeTag = '';

  function fetchPosts() {
    return fetch('/api/posts').then(function (r) {
      if (!r.ok) throw new Error('获取文章列表失败');
      return r.json();
    });
  }

  // 判断某天是否在「最近 30 天」内（相对最新文章）
  function isNew(post, newestDate) {
    if (!post.date || !newestDate) return false;
    const d = new Date(post.date).getTime();
    const n = new Date(newestDate).getTime();
    return !isNaN(d) && !isNaN(n) && n - d <= 30 * 24 * 3600 * 1000 && d <= n;
  }

  function render() {
    const container = document.getElementById('archive');
    const q = (document.getElementById('search').value || '').toLowerCase().trim();

    const filtered = allPosts.filter(function (p) {
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.summary || '').toLowerCase().includes(q);
      const matchTag = activeTag ? (p.tags || []).includes(activeTag) : true;
      return matchSearch && matchTag;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-hint">没有匹配的文章，换个关键词或标签试试。</p>';
      return;
    }

    // 按年份分组（年份倒序，组内日期倒序）
    const byYear = {};
    filtered.forEach(function (p) {
      const year = (p.date || '').slice(0, 4) || '未标注';
      (byYear[year] = byYear[year] || []).push(p);
    });

    const newestDate = allPosts
      .map(function (p) { return p.date; })
      .filter(Boolean)
      .sort()
      .reverse()[0];

    const years = Object.keys(byYear).sort(function (a, b) { return b.localeCompare(a); });

    container.innerHTML = '';
    years.forEach(function (year) {
      const group = document.createElement('div');
      group.className = 'archive-year-group';

      const title = document.createElement('div');
      title.className = 'archive-year';
      title.textContent = year;
      group.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'archive-cards';

      byYear[year]
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
        .forEach(function (p) {
          grid.appendChild(renderCard(p, isNew(p, newestDate)));
        });

      group.appendChild(grid);
      container.appendChild(group);
    });
  }

  function renderCard(p, isNewPost) {
    const card = document.createElement('article');
    card.className = 'archive-card';

    const head = document.createElement('div');
    head.className = 'archive-card-head';
    head.innerHTML =
      '<span class="archive-date">' + (p.date || '') + '</span>' +
      (isNewPost ? '<span class="badge-new">NEW</span>' : '');

    const title = document.createElement('h3');
    title.className = 'archive-card-title';
    const a = document.createElement('a');
    a.href = '/post?slug=' + encodeURIComponent(p.slug);
    a.textContent = p.title;
    title.appendChild(a);

    const summary = document.createElement('p');
    summary.className = 'archive-card-summary';
    summary.textContent = p.summary || '';

    const tags = document.createElement('div');
    tags.className = 'archive-card-tags';
    (p.tags || []).forEach(function (t) {
      const chip = document.createElement('a');
      chip.className = 'tag-chip';
      chip.href = '/archive?tag=' + encodeURIComponent(t);
      chip.textContent = t;
      tags.appendChild(chip);
    });

    card.appendChild(head);
    card.appendChild(title);
    card.appendChild(summary);
    card.appendChild(tags);
    return card;
  }

  function buildTagFilters() {
    const container = document.getElementById('tag-filters');
    const counts = {};
    allPosts.forEach(function (p) {
      (p.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });

    const tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    container.innerHTML = '<span class="tag-chip active" data-tag="">全部</span>';
    tags.forEach(function (t) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = t + ' · ' + counts[t];
      chip.dataset.tag = t;
      container.appendChild(chip);
    });

    container.addEventListener('click', function (e) {
      const chip = e.target.closest('.tag-chip');
      if (!chip) return;
      activeTag = chip.dataset.tag || '';
      // 保持 URL 可分享
      const url = activeTag ? '/archive?tag=' + encodeURIComponent(activeTag) : '/archive';
      history.replaceState(null, '', url);
      [...container.querySelectorAll('.tag-chip')].forEach(function (c) {
        c.classList.remove('active');
      });
      chip.classList.add('active');
      render();
    });
  }

  async function init() {
    try {
      allPosts = await fetchPosts();
      // 按日期倒序排
      allPosts.sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });

      document.getElementById('archive-sub').textContent =
        '共 ' + allPosts.length + ' 篇文章 · AI 状态工程、可验证创作与实战记录';

      buildTagFilters();

      // 读取 URL 里的 tag 参数并激活对应筛选
      const urlTag = new URLSearchParams(window.location.search).get('tag');
      if (urlTag && allPosts.some(function (p) { return (p.tags || []).includes(urlTag); })) {
        activeTag = urlTag;
        document.querySelectorAll('#tag-filters .tag-chip').forEach(function (c) {
          c.classList.toggle('active', c.dataset.tag === urlTag);
        });
      }

      document.getElementById('search').addEventListener('input', render);
      render();
    } catch (e) {
      document.getElementById('archive').innerHTML =
        '<p class="empty-hint" style="color:#ff6b6b">' + e.message + '</p>';
    }
  }

  init();
})();
