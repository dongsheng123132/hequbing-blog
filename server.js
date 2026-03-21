const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('未找到资源');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.xml': 'application/xml; charset=utf-8',
    };
    const contentType = typeMap[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function readJSON(filename) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname || '/');
  const query = parsed.query || {};

  // --- API: Cases ---
  if (pathname === '/api/cases' && req.method === 'GET') {
    let cases = readJSON('cases.json');
    if (query.industry) cases = cases.filter(c => c.industry === query.industry);
    if (query.scenario) cases = cases.filter(c => c.scenario === query.scenario);
    if (query.tag) cases = cases.filter(c => (c.tags || []).includes(query.tag));

    if (query.sort === 'date') {
      cases.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      cases.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
    }

    if (query.limit && !isNaN(parseInt(query.limit))) {
      cases = cases.slice(0, parseInt(query.limit));
    }

    const list = cases.map(c => ({
      id: c.id, slug: c.slug, title: c.title, date: c.date,
      industry: c.industry, scenario: c.scenario, tags: c.tags || [],
      summary: c.summary, hot_score: c.hot_score || 0, source: c.source || '',
    }));
    return sendJson(res, 200, list);
  }

  if (pathname.startsWith('/api/cases/') && req.method === 'GET') {
    const slug = pathname.replace('/api/cases/', '').trim();
    const cases = readJSON('cases.json');
    const found = cases.find(c => c.slug === slug);
    if (!found) return sendJson(res, 404, { error: '未找到案例' });
    return sendJson(res, 200, found);
  }

  // --- API: Posts (legacy blog) ---
  if (pathname === '/api/posts' && req.method === 'GET') {
    const posts = readJSON('posts.json');
    const list = posts.map(p => ({
      id: p.id, slug: p.slug, title: p.title,
      date: p.date, summary: p.summary, tags: p.tags || [],
    }));
    return sendJson(res, 200, list);
  }

  if (pathname.startsWith('/api/posts/') && req.method === 'GET') {
    const slug = pathname.replace('/api/posts/', '').trim();
    const posts = readJSON('posts.json');
    const found = posts.find(p => p.slug === slug);
    if (!found) return sendJson(res, 404, { error: '未找到文章' });
    return sendJson(res, 200, found);
  }

  // --- Static pages (clean URLs) ---
  const pageMap = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/cases': 'cases.html',
    '/case': 'case.html',
    '/services': 'services.html',
    '/about': 'about.html',
    '/post': 'post.html',
    '/archive': 'archive.html',
    '/tags': 'tags.html',
  };

  if (pageMap[pathname]) {
    return sendFile(res, path.join(PUBLIC_DIR, pageMap[pathname]));
  }

  // --- Sitemap ---
  if (pathname === '/sitemap.xml') {
    return sendFile(res, path.join(PUBLIC_DIR, 'sitemap.xml'));
  }

  // --- Static files from public ---
  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('禁止访问');
  }
  return sendFile(res, safePath);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
