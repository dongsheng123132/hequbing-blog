async function fetchPosts() {
  const res = await fetch('/api/posts');
  if (!res.ok) throw new Error('获取文章列表失败');
  return res.json();
}

function renderTags(posts) {
  const container = document.getElementById('tags');
  const counts = posts.reduce((acc, p) => {
    (p.tags || []).forEach(t => acc[t] = (acc[t] || 0) + 1);
    return acc;
  }, {});
  const tags = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  container.innerHTML = '';
  tags.forEach(([tag, count]) => {
    const chip = document.createElement('a');
    chip.className = 'tag-chip';
    chip.href = `/?tag=${encodeURIComponent(tag)}`;
    chip.textContent = tag;
    const c = document.createElement('span');
    c.className = 'tag-count';
    c.textContent = `(${count})`;
    chip.appendChild(c);
    container.appendChild(chip);
  });
}

(async function init() {
  try {
    const posts = await fetchPosts();
    renderTags(posts);
  } catch (e) {
    const container = document.getElementById('tags');
    container.innerHTML = `<div style="color:#ff6b6b">${e.message}</div>`;
  }
})();