const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const { slug } = req.query;
  const dataPath = path.join(process.cwd(), 'data', 'posts.json');
  let posts = [];
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    posts = JSON.parse(raw);
  } catch (e) {
    posts = [];
  }
  const found = posts.find(p => p.slug === slug);
  if (!found) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(404).end(JSON.stringify({ error: '未找到文章' }));
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).end(JSON.stringify(found));
};