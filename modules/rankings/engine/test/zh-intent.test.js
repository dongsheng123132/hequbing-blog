import test from 'node:test';
import assert from 'node:assert/strict';

import { toSimplified, hasTraditional } from '../src/zh.js';
import { parseMentions } from '../src/parse.js';
import { computeMetrics } from '../src/metrics.js';
import { buildMatrix } from '../src/sampler/index.js';
import { ENTITIES } from './fixtures/realistic-answers.js';

test('繁简折叠：长度严格不变（这是偏移量能映射回原文的前提）', () => {
  const raw = '啟德教育與博華升學，專注香港升學顧問服務。';
  const s = toSimplified(raw);
  assert.equal(s.length, raw.length, '长度必须一致，否则原文偏移全部错位');
  assert.equal(s, '启德教育与博华升学，专注香港升学顾问服务。');
});

test('繁简折叠：简体与字符原样保留', () => {
  const raw = '启德教育 EIC 123，。\n';
  assert.equal(toSimplified(raw), raw);
  assert.equal(hasTraditional(raw), false);
  assert.equal(hasTraditional('啟德'), true);
});

test('繁体回答能匹配简体别名（不做折叠会把同一家算成两家）', () => {
  const raw = '1. 啟德教育：資源豐富，很推薦。\n2. 琥珀教育：專注香港升學。';
  const ms = parseMentions(raw, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['eic', 'hupo']);
});

test('繁体免责声明同样被识别并剔除', () => {
  const raw = '1. 啟德教育：推薦。\n\n免責聲明：本文僅供參考，琥珀教育以官方為準。';
  const ms = parseMentions(raw, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['eic'], '繁体免责声明里的机构也必须剔除');
});

test('surface 保留原始写法，但实体已归一（审计要看到 AI 的原话）', () => {
  const raw = '啟德教育不錯。';
  const ms = parseMentions(raw, ENTITIES);
  assert.equal(ms[0].entityId, 'eic');
  assert.equal(ms[0].surface, '啟德教育', 'surface 必须是原文，不能是我们折叠后的版本');
  assert.equal(raw.slice(ms[0].start, ms[0].end), '啟德教育');
});

test('英文别名不受折叠影响', () => {
  const raw = '推薦 EIC 和 Amber Education。';
  assert.deepEqual(parseMentions(raw, ENTITIES).map((m) => m.entityId), ['eic', 'hupo']);
});

/* ---------- 改写轴（intent 分组） ---------- */

const mk = (sid, pid, intent, ids) => ({
  sampleId: sid,
  promptId: pid,
  intent,
  engine: 'e1',
  region: 'CN',
  mentions: ids.map((e, i) => ({ entityId: e, rank: i + 1 })),
});

test('稳定性按 intent 分组，把"换一种问法答案就变"算进不确定性', () => {
  // 同一意图下 4 条改写：3 条提到 A，1 条没有 → p=0.75 → 一致度 1-4·0.75·0.25 = 0.25
  const samples = [
    mk('s1', 'p1', 'rec', ['a']),
    mk('s2', 'p2', 'rec', ['a']),
    mk('s3', 'p3', 'rec', ['a']),
    mk('s4', 'p4', 'rec', ['b']),
  ];
  const { metrics } = computeMetrics(samples, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { topK: 1 });
  assert.ok(
    Math.abs(metrics.get('a').stability - 0.25) < 1e-9,
    `期望 0.25（跨改写不稳定），实际 ${metrics.get('a').stability}`,
  );
});

test('没有 intent 字段时回退到 promptId 分组，不报错', () => {
  const samples = [
    { sampleId: 's1', promptId: 'p1', mentions: [{ entityId: 'a', rank: 1 }] },
    { sampleId: 's2', promptId: 'p1', mentions: [{ entityId: 'a', rank: 1 }] },
  ];
  const { metrics } = computeMetrics(samples, [{ id: 'a', name: 'A' }], { topK: 1 });
  assert.equal(metrics.get('a').stability, 1, '同一题重复两次都上榜 → 稳定');
});

test('采样矩阵把 intent 带进样本（否则改写轴无从统计）', () => {
  const cells = buildMatrix({
    consortium: { prompts: [{ id: 'hk001', text: '问题一', intent: 'recommend' }] },
    providers: [{ id: 'p' }],
    regions: ['CN'],
    runs: 1,
  });
  assert.equal(cells.length, 1);
  assert.equal(cells[0].intent, 'recommend');
  assert.equal(cells[0].promptId, 'hk001');
});

test('缺 intent 时矩阵用 promptId 兜底', () => {
  const cells = buildMatrix({
    consortium: { prompts: [{ id: 'p9', text: '问题' }] },
    providers: [{ id: 'p' }],
    regions: ['CN'],
    runs: 1,
  });
  assert.equal(cells[0].intent, 'p9');
});
