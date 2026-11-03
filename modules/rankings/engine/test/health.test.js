import test from 'node:test';
import assert from 'node:assert/strict';

import { checkHealth, renderHealthText } from '../src/health.js';

const E = [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }];

const ok = (sid, engine, region, raw, intent = 'rec') => ({
  sampleId: sid,
  promptId: 'p1',
  intent,
  engine,
  region,
  raw,
  mentions: [{ entityId: 'a', rank: 1 }],
});

const failed = (sid, engine) => ({
  sampleId: sid,
  promptId: 'p1',
  engine,
  region: 'CN',
  raw: null,
  error: 'HTTP 500',
});

// 必须长于 MIN_USABLE_CHARS(40)，否则会被判成"过短回答"并触发额外告警
const LONG = '1. 甲：资源丰富，是老牌机构，很推荐。\n2. 乙：性价比不错，售后网点也比较多，可以考虑。';

test('健康数据：结论为可用', () => {
  const rawSamples = Array.from({ length: 10 }, (_, i) => ok(`s${i}`, 'e1', 'CN', LONG));
  const h = checkHealth({ rawSamples, parsedSamples: rawSamples });
  assert.equal(h.total, 10);
  assert.equal(h.successRate, 1);
  assert.equal(h.verdict.ok, true);
  assert.equal(h.warnings.length, 0);
});

test('失败率过高时直接判定不可用（先修通道，别做榜）', () => {
  const rawSamples = [
    ...Array.from({ length: 6 }, (_, i) => ok(`s${i}`, 'e1', 'CN', LONG)),
    ...Array.from({ length: 4 }, (_, i) => failed(`f${i}`, 'e1')),
  ];
  const h = checkHealth({ rawSamples, parsedSamples: rawSamples.filter((s) => !s.error) });
  assert.equal(h.failed, 4);
  assert.equal(h.verdict.ok, false);
  assert.match(h.verdict.message, /失败率/);
  assert.ok(h.warnings.some((w) => w.level === 'high' && /失败率/.test(w.message)));
});

test('单个通道成功率低会单独告警（跨通道对比会失真）', () => {
  const rawSamples = [
    ...Array.from({ length: 10 }, (_, i) => ok(`d${i}`, 'doubao', 'CN', LONG)),
    ...Array.from({ length: 7 }, (_, i) => ok(`c${i}`, 'chatgpt', 'US', LONG)),
    ...Array.from({ length: 3 }, (_, i) => failed(`c${i}f`, 'chatgpt')),
  ];
  const h = checkHealth({ rawSamples, parsedSamples: rawSamples.filter((s) => !s.error) });
  const cg = h.byEngine.find((r) => r.key === 'chatgpt');
  assert.ok(Math.abs(cg.successRate - 0.7) < 1e-9);
  assert.ok(h.warnings.some((w) => /chatgpt/.test(w.message)), '掉队的通道必须被点名');
});

test('大量回答解析不出实体时拦下来（解析器不适配，不是实体缺席）', () => {
  const rawSamples = Array.from({ length: 10 }, (_, i) => ({
    ...ok(`z${i}`, 'e1', 'CN', LONG),
    mentions: [],
  }));
  const h = checkHealth({ rawSamples, parsedSamples: rawSamples });
  assert.equal(h.parsing.zeroMention, 10);
  assert.equal(h.verdict.ok, false);
  assert.match(h.verdict.message, /解析/);
  assert.equal(h.parsing.zeroMentionSamples.length, 10);
});

test('过短回答被标出（拒答/截断会把所有人一起拉平）', () => {
  const rawSamples = [
    ok('s1', 'e1', 'CN', LONG),
    ok('s2', 'e1', 'CN', '建议实地考察。'),
  ];
  const h = checkHealth({ rawSamples, parsedSamples: rawSamples });
  assert.equal(h.parsing.shortAnswers, 1);
  assert.deepEqual(h.parsing.shortSampleIds, ['s2']);
});

test('意图样本数不足会告警（改写轴需要每个意图至少 2 条）', () => {
  const rawSamples = [ok('s1', 'e1', 'CN', LONG, 'only-one')];
  const h = checkHealth({ rawSamples, parsedSamples: rawSamples });
  assert.deepEqual(h.intents.thin, ['only-one']);
  assert.ok(h.warnings.some((w) => /意图/.test(w.message)));
});

test('有效样本不足最小可发布量时明确不得发布', () => {
  const rawSamples = [ok('s1', 'e1', 'CN', LONG), ok('s2', 'e1', 'CN', LONG)];
  const h = checkHealth({ rawSamples, parsedSamples: rawSamples });
  assert.equal(h.verdict.ok, false);
  assert.match(h.verdict.message, /最小可发布样本量/);
});

test('零样本不崩溃，直接说明无法评估', () => {
  const h = checkHealth({ rawSamples: [], parsedSamples: [] });
  assert.equal(h.total, 0);
  assert.equal(h.verdict.ok, false);
  assert.match(h.verdict.message, /没有样本/);
});

test('回答长度与形态被统计（形态分布决定解析器要不要升级）', () => {
  const rawSamples = [
    { ...ok('s1', 'e1', 'CN', LONG), mentions: [{ entityId: 'a', rank: 1, shape: 'numbered' }] },
    { ...ok('s2', 'e1', 'CN', LONG), mentions: [{ entityId: 'a', rank: 1, shape: 'prose' }] },
  ];
  const h = checkHealth({ rawSamples, parsedSamples: rawSamples });
  assert.equal(h.parsing.shapes.numbered, 1);
  assert.equal(h.parsing.shapes.prose, 1);
  assert.ok(h.parsing.rawLength.median > 0);
});

test('文本渲染包含关键字段，可读', () => {
  const rawSamples = [ok('s1', 'e1', 'CN', LONG), failed('f1', 'e1')];
  const h = checkHealth({ rawSamples, parsedSamples: [rawSamples[0]] });
  const text = renderHealthText(h, '测试榜');
  assert.match(text, /测试榜/);
  assert.match(text, /成功率/);
  assert.match(text, /结论：/);
});
