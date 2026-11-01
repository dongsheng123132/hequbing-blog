const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const dataPath = path.join(process.cwd(), 'data', 'posts.json');
  let posts = [];
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    posts = JSON.parse(raw);
  } catch (e) {
    posts = [];
  }
  const list = posts.map(p => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    date: p.date,
    summary: p.summary,
    tags: p.tags || [],
  }));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).end(JSON.stringify(list));
};