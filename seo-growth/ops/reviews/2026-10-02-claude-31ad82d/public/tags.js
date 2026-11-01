/**
 * 标签页逻辑
 * 标签按文章数由多到少排列，字号随文章数分级（标签云效果）。
 * 点击跳转到归档页 ?tag=xxx 做筛选。
 */
(async function () {
  'use strict';

  function fetchPosts() {
    return fetch('/api/posts').then(function (r) {
      if (!r.ok) throw new Error('获取文章列表失败');
      return r.json();
    });
  }

  try {
    const posts = await fetchPosts();
    const counts = posts.reduce(function (acc, p) {
      (p.tags || []).forEach(function (t) { acc[t] = (acc[t] || 0) + 1; });
      return acc;
    }, {});

    const tags = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
    const maxCount = tags.length ? tags[0][1] : 1;

    const container = document.getElementById('tags');
    if (tags.length === 0) {
      container.innerHTML = '<p class="empty-hint">还没有标签。</p>';
      return;
    }

    container.innerHTML = '';
    tags.forEach(function (entry) {
      const tag = entry[0];
      const count = entry[1];
      const size = 0.85 + 0.5 * (count / maxCount); // 1.0~1.35 倍字号
      const chip = document.createElement('a');
      chip.className = 'tag-chip tag-cloud-chip';
      chip.href = '/archive?tag=' + encodeURIComponent(tag);
      chip.style.fontSize = size.toFixed(2) + 'em';
      chip.textContent = tag;
      const c = document.createElement('span');
      c.className = 'tag-count';
      c.textContent = ' (' + count + ')';
      chip.appendChild(c);
      container.appendChild(chip);
    });
  } catch (e) {
    document.getElementById('tags').innerHTML =
      '<p style="color:#ff6b6b">' + e.message + '</p>';
  }
})();
