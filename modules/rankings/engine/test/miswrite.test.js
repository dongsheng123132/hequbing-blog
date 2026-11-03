import test from 'node:test';
import assert from 'node:assert/strict';

import { editDistanceAtMost, findSuspectedMiswrites, summarizeMiswrites } from '../src/miswrite.js';

const E = [
  { id: 'jjl', name: '金吉列留学', aliases: ['金吉列', 'JJL'] },
  { id: 'eic', name: '启德教育', aliases: ['启德'] },
  { id: 'md', name: '美的', aliases: [] },
];

test('编辑距离带提前退出', () => {
  assert.equal(editDistanceAtMost('金吉列', '金吉利', 1), 1);
  assert.equal(editDistanceAtMost('金吉列', '金吉列', 1), 0);
  assert.equal(editDistanceAtMost('金吉列留学', '启德教育', 1), 2, '差距过大时返回 limit+1');
});

test('抓住真实案例：AI 把「金吉列」写成「金吉利」', () => {
  const raw = '## 4. 金吉利教育：综合服务较全，但要看港校专项能力';
  const hits = findSuspectedMiswrites(raw, E);
  const jjl = hits.find((h) => h.entityId === 'jjl');
  assert.ok(jjl, '必须能抓到这个误写');
  assert.equal(jjl.surface, '金吉利');
  assert.ok(jjl.expected.includes('金吉列'), `期望指向「金吉列」系列别名，实际 ${jjl.expected}`);
  assert.equal(jjl.distance, 1);
  assert.equal(raw.slice(jjl.start, jjl.end), '金吉利', '偏移量要能定位回原文');
});

test('精确写对时不报误写（不制造假阳性）', () => {
  const raw = '推荐金吉列留学和启德教育，这两家都不错。';
  const hits = findSuspectedMiswrites(raw, E);
  assert.equal(hits.length, 0);
});

test('两字别名默认不参与比对（误报率太高）', () => {
  const raw = '美地电器和小来科技都是品牌。';
  const hits = findSuspectedMiswrites(raw, E);
  assert.equal(hits.filter((h) => h.entityId === 'md').length, 0, '"美的"两字，编辑距离 1 会误报');
});

test('繁体写法不会被误报为误写（繁简折叠先行）', () => {
  const raw = '推薦啟德教育，是老牌機構。';
  const hits = findSuspectedMiswrites(raw, E);
  assert.equal(hits.length, 0, '繁简差异不是误写');
});

test('同一段文字只保留距离最小的解释（去重叠）', () => {
  const entities = [
    { id: 'x', name: '金吉列留学' },
    { id: 'y', name: '金吉利留学' },
  ];
  const raw = '金吉利留学不错。';
  const hits = findSuspectedMiswrites(raw, entities);
  const starts = hits.map((h) => h.start);
  assert.equal(new Set(starts).size, starts.length, '同一位置不应重复报');
});

test('汇总：哪家被叫错了几次、在哪些通道', () => {
  const samples = [
    { sampleId: 's1', engine: 'qwen', raw: '金吉利教育不错。' },
    { sampleId: 's2', engine: 'qwen', raw: '还有金吉利。' },
    { sampleId: 's3', engine: 'doubao', raw: '金吉利也可以看看。' },
    { sampleId: 's4', engine: 'doubao', raw: '金吉列留学很专业。' },
  ];
  const sum = summarizeMiswrites(samples, E);
  const jjl = sum.find((r) => r.entityId === 'jjl');
  assert.ok(jjl);
  assert.equal(jjl.count, 3);
  assert.deepEqual(jjl.engines.sort(), ['doubao', 'qwen']);
  assert.equal(jjl.surface, '金吉利');
});

test('空输入不崩溃', () => {
  assert.deepEqual(findSuspectedMiswrites('', E), []);
  assert.deepEqual(findSuspectedMiswrites(null, E), []);
  assert.deepEqual(findSuspectedMiswrites('随便一段话', []), []);
});
