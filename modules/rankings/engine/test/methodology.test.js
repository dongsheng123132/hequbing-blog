import test from 'node:test';
import assert from 'node:assert/strict';

import { betaQuantile, jeffreysLowerBound, logGamma, regularizedIncompleteBeta } from '../src/beta.js';
import { headToHead, winRateMatrix, headToHeadBootstrap } from '../src/head2head.js';
import { computeMetrics } from '../src/metrics.js';
import { computeARS, DEFAULT_WEIGHTS } from '../src/score.js';
import { METHODOLOGY_VERSION, methodologyFingerprint } from '../src/methodology.js';
import { mulberry32 } from '../src/rng.js';

const ENTITIES = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
];

const S = (id, ids) => ({ sampleId: id, promptId: 'p1', mentions: ids.map((e) => ({ entityId: e, rank: 1 })) });

/* ---------- Jeffreys 后验下界（小样本惩罚） ---------- */

test('logGamma 基本值', () => {
  assert.ok(Math.abs(logGamma(1)) < 1e-9);
  assert.ok(Math.abs(logGamma(5) - Math.log(24)) < 1e-9);
  assert.ok(Math.abs(logGamma(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-9);
});

test('Beta 分布分位数：均匀分布 Beta(1,1) 的中位数是 0.5', () => {
  assert.ok(Math.abs(betaQuantile(0.5, 1, 1) - 0.5) < 1e-6);
  assert.ok(Math.abs(regularizedIncompleteBeta(0.5, 1, 1) - 0.5) < 1e-9);
});

test('Beta 分布实现经解析式验证（这是 CAV 可信的前提）', () => {
  // 解析式 1：Beta(0.5,0.5) 是反正弦分布，CDF(x) = (2/π)·asin(√x)
  const x1 = 0.3;
  const exact1 = (2 / Math.PI) * Math.asin(Math.sqrt(x1));
  assert.ok(Math.abs(regularizedIncompleteBeta(x1, 0.5, 0.5) - exact1) < 1e-12);
  // 解析式 2：整数参数 I_x(2,3) = 6x²(1−x)² + 4x³(1−x) + x⁴
  const x2 = 0.5;
  const exact2 = 6 * x2 * x2 * (1 - x2) ** 2 + 4 * x2 ** 3 * (1 - x2) + x2 ** 4;
  assert.ok(Math.abs(regularizedIncompleteBeta(x2, 2, 3) - exact2) < 1e-12);
  // 对称性
  assert.ok(Math.abs(regularizedIncompleteBeta(0.7, 2.5, 4) + regularizedIncompleteBeta(0.3, 4, 2.5) - 1) < 1e-12);
});

test('CAV：小样本下全中也不能报 100%（这是不许拿三次采样编第一名的机制保证）', () => {
  const n3 = jeffreysLowerBound(3, 3);
  const n5 = jeffreysLowerBound(5, 5);
  const n10 = jeffreysLowerBound(10, 10);
  // 本实现取 α=0.05 的单侧下界：N=3→0.5559、N=5→0.6943、N=10→0.8292。
  // 注：调研报告给出的示例量级（0.44/0.55/0.74）未标注 α，且作者自述"需用 scipy 复核"，
  //     与本实现不一致，已列入待核对项；本实现已由上一测试的两个解析式锁定正确性。
  assert.ok(Math.abs(n3 - 0.5559) < 0.002, `N=3,k=3 期望 0.5559，实际 ${n3.toFixed(4)}`);
  assert.ok(Math.abs(n5 - 0.6943) < 0.002, `N=5,k=5 期望 0.6943，实际 ${n5.toFixed(4)}`);
  assert.ok(Math.abs(n10 - 0.8292) < 0.002, `N=10,k=10 期望 0.8292，实际 ${n10.toFixed(4)}`);
  assert.ok(n3 < n5 && n5 < n10, '样本越多，下界越接近点估计');
  assert.ok(n10 < 1, '任何有限样本都不该给出 100%');
});

test('CAV：无采样返回 null，而不是 0（没测过 ≠ 表现差）', () => {
  assert.equal(jeffreysLowerBound(0, 0), null);
  assert.equal(jeffreysLowerBound(3, 0), null);
  const kept = jeffreysLowerBound(0, 3);
  assert.ok(kept > 0 && kept < 0.05, `3 次都没中时，Jeffreys 后验仍留极小可能，下界应是很小的正数，实际 ${kept}`);
});

/* ---------- 成对击败率 ---------- */

test('成对击败率：赢/输/平三类计数正确', () => {
  const samples = [
    S('1', ['a']),        // a 赢
    S('2', ['a']),        // a 赢
    S('3', ['b']),        // b 赢
    S('4', ['a', 'b']),   // 平（都提到）
    S('5', []),           // 平（都没提到）
  ];
  const { pairs } = headToHead(samples, ENTITIES);
  const ab = pairs.get('a|b');
  assert.equal(ab.wins, 2);
  assert.equal(ab.losses, 1);
  assert.equal(ab.ties, 2);
  // 分母 = 至少一方出现的回答数 = 2+1 = 3（不把"都没提到"算进对抗分母）
  assert.ok(Math.abs(ab.winRate - (200 / 3)) < 1e-9);
});

test('成对击败率：双方都没出现时分母为 0，返回 null 而不是 0', () => {
  const samples = [S('1', ['a'])]; // b、c 从未出现
  const { pairs } = headToHead(samples, ENTITIES);
  const bc = pairs.get('b|c');
  assert.equal(bc.wins + bc.losses, 0);
  assert.equal(bc.winRate, null, '分母为 0 必须返回 null');
});

test('新增一个未出现过的实体，不会改变原有实体之间的击败率', () => {
  const samples = [S('1', ['a']), S('2', ['b']), S('3', ['a'])];
  const two = headToHead(samples, ENTITIES.slice(0, 2)).pairs.get('a|b').winRate;
  const three = headToHead(samples, ENTITIES).pairs.get('a|b').winRate;
  assert.equal(two, three);
});

test('击败率矩阵反对称且对角为 null', () => {
  const samples = [S('1', ['a']), S('2', ['b']), S('3', ['a', 'b'])];
  const m = winRateMatrix(samples, ENTITIES);
  assert.equal(m.a.a, null);
  assert.ok(Math.abs(m.a.b + m.b.a - 100) < 1e-9, 'A 对 B 与 B 对 A 应互补');
});

test('配对 bootstrap 给出击败率的置信区间，且区间包含点估计', () => {
  const samples = [];
  for (let i = 0; i < 40; i++) samples.push(S(`s${i}`, i % 3 === 0 ? ['b'] : ['a']));
  const rng = mulberry32(11);
  const boot = headToHeadBootstrap(samples, ENTITIES.slice(0, 2), { iterations: 300, rng });
  const a = boot.get('a');
  assert.ok(a.ci95, '应有置信区间');
  assert.ok(a.ci95[0] <= a.meanWinRate + 1e-9 && a.ci95[1] >= a.meanWinRate - 1e-9);
});

/* ---------- null 规范 ---------- */

test('零样本时指标为 null，ARS 也为 null，而不是 0', () => {
  const { metrics } = computeMetrics([], ENTITIES, { topK: 2 });
  const m = metrics.get('a');
  assert.equal(m.mentionRate, null);
  assert.equal(m.rankScore, null);
  assert.equal(m.cav, null);
  assert.equal(m.reportable, false);
  assert.equal(computeARS(m, DEFAULT_WEIGHTS), null);
});

test('有样本但某实体从未被提及：指标是 0（确实零次提及），不是 null', () => {
  const samples = [{ sampleId: '1', promptId: 'p1', mentions: [{ entityId: 'a', rank: 1, sentiment: 0 }] }];
  const { metrics } = computeMetrics(samples, ENTITIES, { topK: 2 });
  const b = metrics.get('b');
  assert.equal(b.mentionRate, 0);
  assert.equal(b.sentiment, 0);
  assert.equal(b.avgRank, null, '平均位次的分母只含位次可计算的样本，无样本时为 null');
  assert.equal(b.avgRankDenominator, 0);
});

test('方法论的 null 策略被写死，防止实现漂移', () => {
  assert.equal(METHODOLOGY_VERSION, '0.2.1');
  const f1 = methodologyFingerprint({ weights: { a: 1 } });
  const f2 = methodologyFingerprint({ weights: { a: 1 } });
  const f3 = methodologyFingerprint({ weights: { a: 2 } });
  assert.equal(f1, f2, '同参数指纹必须相同（可复算）');
  assert.notEqual(f1, f3, '参数变了指纹必须变（否则历史榜单不可比）');
});
