'use strict';
// Read/test the isolated remote-commit snapshot; never write the live source tree.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const root = path.join(__dirname, '2026-10-02-claude-31ad82d');
process.chdir(root);
const { renderPostPage } = require(path.join(root, 'api/render-post.js'));
const posts = JSON.parse(fs.readFileSync('data/posts.json', 'utf8'));
for (const p of posts) {
  const { status, html } = renderPostPage(p.slug);
  assert.equal(status, 200);
  assert.ok(html.includes(p.content), 'Missing body: ' + p.slug);
  assert.ok(html.includes('rel="canonical"'));
  const match = html.match(/id="schema-json">([\s\S]*?)<\/script>/);
  const schema = JSON.parse(match[1]);
  assert.equal(schema.headline, p.title);
  assert.equal(schema.datePublished, p.date);
  assert.equal(schema.mainEntityOfPage, 'https://blog.hequbing.com/post?slug=' + encodeURIComponent(p.slug));
  assert.ok(!/\{\{(?:PAGE_TITLE|DESCRIPTION|POST_CONTENT|SCHEMA)\}\}/.test(html));
}
const missing = renderPostPage('not-an-article');
assert.equal(missing.status, 404);
assert.ok(missing.html.includes('content="noindex"'));
const htmlPaths = fs.readdirSync('public').filter(f => f.endsWith('.html'));
const emptyJsonLdContainers = [];
for (const file of htmlPaths) {
  const text = fs.readFileSync(path.join('public', file), 'utf8');
  const scripts = text.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  for (const m of scripts) {
    if (m[1].trim()) JSON.parse(m[1]);
    else emptyJsonLdContainers.push(file);
  }
}
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = Object.fromEntries(htmlPaths.map(f => [f, digest(path.join('public', f))]));
const build = spawnSync(process.execPath, ['scripts/build-static.js'], { cwd: root, encoding: 'utf8', timeout: 10000 });
assert.equal(build.status, 0, build.stderr);
const buildChanged = htmlPaths.filter(f => before[f] !== digest(path.join('public', f)));
// Check the newly introduced SSR response survives the existing client's API failure.
const p = posts.find(p => p.slug === 'ai-housing-era');
const elements = {
  'post-title': { textContent: p.title },
  'post-content': { innerHTML: p.content },
};
const context = {
  URLSearchParams,
  window: { location: { search: '?slug=' + p.slug } },
  document: { getElementById: id => elements[id] },
  fetch: async () => { throw new Error('Simulated API unavailable'); },
};
vm.runInNewContext(fs.readFileSync('public/post.js', 'utf8'), context);
setImmediate(() => {
  const result = {
    commit: '31ad82dfc1c20ef125d5540b01eef035dbedeafd',
    postsWithFullServerRenderedBody: posts.length,
    missingPostStatus: missing.status,
    jsonLdParsed: true,
    emptyJsonLdContainers,
    staticBuildChangedFiles: buildChanged,
    buildOutput: build.stdout.trim(),
    apiFailureResult: {
      initialBodyExists: true,
      titleAfterFailure: elements['post-title'].textContent,
      bodyPreserved: elements['post-content'].innerHTML === p.content,
    },
    sourceTreeModified: false,
  };
  fs.writeFileSync(path.join(__dirname, '2026-10-02-claude-checks.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
});
