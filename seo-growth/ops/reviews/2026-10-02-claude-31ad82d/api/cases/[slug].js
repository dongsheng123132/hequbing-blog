const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const { slug } = req.query;
  const dataPath = path.join(process.cwd(), 'data', 'cases.json');
  let cases = [];
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    cases = JSON.parse(raw);
  } catch (e) {
    cases = [];
  }
  const found = cases.find(c => c.slug === slug);
  if (!found) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(404).end(JSON.stringify({ error: '未找到案例' }));
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).end(JSON.stringify(found));
};
