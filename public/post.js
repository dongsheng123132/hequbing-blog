function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function fetchPost(slug) {
  const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('获取文章失败');
  return res.json();
}

(async function init() {
  const slug = getQueryParam('slug');
  const titleEl = document.getElementById('post-title');
  const dateEl = document.getElementById('post-date');
  const contentEl = document.getElementById('post-content');

  if (!slug) {
    titleEl.textContent = '未指定文章';
    contentEl.innerHTML = '<p>请从首页选择一篇文章。</p>';
    return;
  }

  try {
    const post = await fetchPost(slug);
    titleEl.textContent = post.title;
    dateEl.textContent = post.date;
    contentEl.innerHTML = post.content;
  } catch (e) {
    titleEl.textContent = '文章加载失败';
    contentEl.innerHTML = `<p style="color:#ff6b6b">${e.message}</p>`;
  }
})();