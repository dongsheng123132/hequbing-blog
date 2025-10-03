const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_PATH = path.join(__dirname, 'data', 'posts.json');

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
    };
    const contentType = typeMap[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function readPosts() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname || '/');

  // API routes
  if (pathname === '/api/posts' && req.method === 'GET') {
    const posts = readPosts();
    // 返回列表（不包含全文）
    const list = posts.map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      date: p.date,
      summary: p.summary,
      tags: p.tags || [],
    }));
    return sendJson(res, 200, list);
  }

  if (pathname.startsWith('/api/posts/') && req.method === 'GET') {
    const slug = pathname.replace('/api/posts/', '').trim();
    const posts = readPosts();
    const found = posts.find(p => p.slug === slug);
    if (!found) {
      return sendJson(res, 404, { error: '未找到文章' });
    }
    return sendJson(res, 200, found);
  }

  // Static files
  if (pathname === '/' || pathname === '/index.html') {
    return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }

  // 强制仅在 public 下提供静态资源
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