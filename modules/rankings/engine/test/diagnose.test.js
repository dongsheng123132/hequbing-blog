import test from 'node:test';
import assert from 'node:assert/strict';

import { diagnoseEntity } from '../src/diagnose.js';

const E = [
  { id: 'a', name: '甲机构' },
  { id: 'b', name: '乙机构' },
  { id: 'c', name: '丙机构' },
];

const mk = (sid, pid, ids, extra = {}) => ({
  sampleId: sid,
  promptId: pid,
  prompt: `问题 ${pid}`,
  engine: extra.engine ?? 'doubao',
  region: extra.region ?? 'CN',
  mentions: ids.map((e, i) => ({ entityId: e, rank: i + 1, sentiment: 0, ...(extra.mentionExtra ?? {}) })),
});

test('认知缺口：AI 推荐了同行却没提到你', () => {
  const samples = [mk('s1', 'p1', ['b', 'c']), mk('s2', 'p2', ['a', 'b']), mk('s3', 'p3', ['a'])];
  const d = diagnoseEntity({ samples, entities: E, entityId: 'a', topK: 3 });
  assert.equal(d.gaps.length, 1);
  assert.equal(d.gaps[0].promptId, 'p1');
  assert.equal(d.gaps[0].rivals[0].name, '乙机构', '必须告诉客户"这个问题上 AI 推荐了谁"');
  assert.ok(d.gaps[0].isGap);
});

test('覆盖面完整时没有缺口，强项被正确识别', () => {
  const samples = [mk('s1', 'p1', ['a']), mk('s2', 'p2', ['a', 'b'])];
  const d = diagnoseEntity({ samples, entities: E, entityId: 'a', topK: 3 });
  assert.equal(d.gaps.length, 0);
  assert.equal(d.strengths.length, 2, '两题提及率都是 100%');
  assert.equal(d.weak.length, 0);
});

test('时有时无的场景归入 weak（最容易改的部分）', () => {
  const samples = [mk('s1', 'p1', ['a']), mk('s2', 'p1', ['b'])];
  const d = diagnoseEntity({ samples, entities: E, entityId: 'a', topK: 3 });
  assert.equal(d.weak.length, 1);
  assert.equal(d.weak[0].promptId, 'p1');
  assert.ok(Math.abs(d.weak[0].mentionRate - 0.5) < 1e-9);
});

test('分通道与分地域落差被量化（这就是"分布式 AI 调查"的商业价值）', () => {
  const samples = [
    mk('s1', 'p1', ['a'], { engine: 'doubao', region: 'CN' }),
    mk('s2', 'p1', ['a'], { engine: 'doubao', region: 'CN' }),
    mk('s3', 'p1', ['b'], { engine: 'chatgpt', region: 'US' }),
    mk('s4', 'p1', ['b'], { engine: 'chatgpt', region: 'US' }),
  ];
  const d = diagnoseEntity({ samples, entities: E, entityId: 'a', topK: 3 });
  assert.equal(d.byEngine.find((r) => r.engine === 'doubao').mentionRate, 1);
  assert.equal(d.byEngine.find((r) => r.engine === 'chatgpt').mentionRate, 0);
  assert.equal(d.engineSpread, 1, '落差应为 100 个百分点');
  assert.equal(d.regionSpread, 1);
  assert.match(d.headline, /doubao/);
  assert.match(d.headline, /chatgpt/);
});

test('AI 认错的样本被单列出来（"认错了谁"）', () => {
  const samples = [
    mk('s1', 'p1', ['a'], { mentionExtra: { hallucinated: true } }),
    mk('s2', 'p1', ['a']),
  ];
  const d = diagnoseEntity({ samples, entities: E, entityId: 'a', topK: 3 });
  assert.equal(d.hallucinations.length, 1);
  assert.equal(d.hallucinations[0].sampleId, 's1');
  assert.ok(d.metrics.hallucinationRate > 0);
});

test('未知实体直接报错，不静默返回空报告', () => {
  assert.throws(() => diagnoseEntity({ samples: [], entities: E, entityId: 'zzz' }), /未知实体/);
});

test('结论句包含提及率与缺口数量', () => {
  const samples = [mk('s1', 'p1', ['b']), mk('s2', 'p2', ['a'])];
  const d = diagnoseEntity({ samples, entities: E, entityId: 'a', topK: 3 });
  assert.match(d.headline, /甲机构/);
  assert.match(d.headline, /50%/);
  assert.match(d.headline, /1\/2/);
});
