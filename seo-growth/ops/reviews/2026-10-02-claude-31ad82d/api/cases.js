const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const dataPath = path.join(process.cwd(), 'data', 'cases.json');
  let cases = [];
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    cases = JSON.parse(raw);
  } catch (e) {
    cases = [];
  }

  const { industry, scenario, tag, sort, limit } = req.query || {};

  // Filter
  let filtered = cases;
  if (industry) {
    filtered = filtered.filter(c => c.industry === industry);
  }
  if (scenario) {
    filtered = filtered.filter(c => c.scenario === scenario);
  }
  if (tag) {
    filtered = filtered.filter(c => (c.tags || []).includes(tag));
  }

  // Sort
  if (sort === 'hot') {
    filtered.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
  } else if (sort === 'date') {
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else {
    // Default: hot score
    filtered.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
  }

  // Limit
  if (limit && !isNaN(parseInt(limit))) {
    filtered = filtered.slice(0, parseInt(limit));
  }

  // Return list without full content
  const list = filtered.map(c => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    date: c.date,
    industry: c.industry,
    scenario: c.scenario,
    tags: c.tags || [],
    summary: c.summary,
    hot_score: c.hot_score || 0,
    source: c.source || '',
  }));

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).end(JSON.stringify(list));
};
