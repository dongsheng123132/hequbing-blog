let allPosts = [];

async function fetchPosts() {
  const res = await fetch('/api/posts');
  if (!res.ok) throw new Error('获取文章列表失败');
  return res.json();
}

function renderPosts(posts) {
  const container = document.getElementById('posts');
  container.innerHTML = '';
  posts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'post-card';

    const title = document.createElement('h3');
    title.className = 'post-card-title';
    title.textContent = p.title;

    const date = document.createElement('div');
    date.className = 'post-card-date';
    date.textContent = p.date;

    const summary = document.createElement('div');
    summary.className = 'post-card-summary';
    summary.textContent = p.summary || '';

    const link = document.createElement('a');
    link.className = 'post-card-link';
    link.href = `/post?slug=${encodeURIComponent(p.slug)}`;
    link.textContent = '阅读全文 →';

    card.appendChild(title);
    card.appendChild(date);
    card.appendChild(summary);
    card.appendChild(link);

    container.appendChild(card);
  });
}

function buildTagFilters(posts) {
  const tagSet = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
  const filters = document.getElementById('tag-filters');
  filters.innerHTML = '';
  const allChip = document.createElement('span');
  allChip.className = 'tag-chip active';
  allChip.textContent = '全部';
  allChip.dataset.tag = '';
  filters.appendChild(allChip);

  tagSet.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = tag;
    chip.dataset.tag = tag;
    filters.appendChild(chip);
  });
}

function setupInteractions() {
  const searchInput = document.getElementById('search');
  const filters = document.getElementById('tag-filters');
  let activeTag = '';

  function applyFilter() {
    const q = (searchInput.value || '').toLowerCase();
    const filtered = allPosts.filter(p => {
      const matchText = p.title.toLowerCase().includes(q) || (p.summary || '').toLowerCase().includes(q);
      const matchTag = activeTag ? (p.tags || []).includes(activeTag) : true;
      return matchText && matchTag;
    });
    renderPosts(filtered);
  }

  searchInput.addEventListener('input', applyFilter);

  filters.addEventListener('click', (e) => {
    const target = e.target.closest('.tag-chip');
    if (!target) return;
    activeTag = target.dataset.tag || '';
    [...filters.querySelectorAll('.tag-chip')].forEach(c => c.classList.remove('active'));
    target.classList.add('active');
    applyFilter();
  });
}

(async function init() {
  try {
    allPosts = await fetchPosts();
    // 按日期倒序显示最新文章在前
    allPosts.sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return db - da;
    });
    renderPosts(allPosts);
    buildTagFilters(allPosts);
    setupInteractions();
  } catch (e) {
    const container = document.getElementById('posts');
    container.innerHTML = `<div style="color:#ff6b6b">${e.message}</div>`;
  }
})();