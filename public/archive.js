async function fetchPosts() {
  const res = await fetch('/api/posts');
  if (!res.ok) throw new Error('获取文章列表失败');
  return res.json();
}

function renderArchive(posts) {
  const container = document.getElementById('archive');
  const byYear = posts.reduce((acc, p) => {
    const year = (p.date || '').slice(0, 4);
    acc[year] = acc[year] || [];
    acc[year].push(p);
    return acc;
  }, {});

  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
  container.innerHTML = '';
  years.forEach(y => {
    const title = document.createElement('div');
    title.className = 'archive-year';
    title.textContent = y;
    container.appendChild(title);

    byYear[y].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .forEach(p => {
        const row = document.createElement('div');
        row.className = 'archive-post';

        const left = document.createElement('span');
        left.innerHTML = `${p.date} · <a href="/post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a>`;

        const right = document.createElement('span');
        right.textContent = (p.tags || []).join(', ');
        right.className = 'meta';

        row.appendChild(left);
        row.appendChild(right);
        container.appendChild(row);
      });
  });
}

(async function init() {
  try {
    const posts = await fetchPosts();
    renderArchive(posts);
  } catch (e) {
    const container = document.getElementById('archive');
    container.innerHTML = `<div style="color:#ff6b6b">${e.message}</div>`;
  }
})();