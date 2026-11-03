import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMentions, findExcludedRanges, detectShape } from '../src/parse.js';
import { computeMetrics } from '../src/metrics.js';
import { CASES, ENTITIES } from './fixtures/realistic-answers.js';

const ids = (raw, opts) => parseMentions(raw, ENTITIES, opts).map((m) => m.entityId);

test('编号列表：给出真实位次', () => {
  assert.deepEqual(ids(CASES.numbered), ['eic', 'jjl', 'idp']);
  assert.ok(parseMentions(CASES.numbered, ENTITIES).every((m) => m.rankSource === 'list-marker'));
});

test('Markdown 表格：顺序按行序，形态识别为 table', () => {
  const ms = parseMentions(CASES.markdownTable, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['eic', 'jjl', 'idp']);
  assert.equal(ms[0].shape, 'table');
  assert.equal(ms[0].orderConfidence, 'high');
});

test('无分隔行的表格同样识别', () => {
  const ms = parseMentions(CASES.tableNoDivider, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['eic', 'jjl']);
  assert.equal(ms[0].shape, 'table');
});

test('项目符号列表：形态识别为 bullets，顺序可信', () => {
  const ms = parseMentions(CASES.bullets, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['eic', 'hupo', 'aoji']);
  assert.equal(ms[0].shape, 'bullets');
  assert.equal(ms[0].orderConfidence, 'high');
});

test('纯段落叙述：标为低顺序置信度（先提到 ≠ 更推荐）', () => {
  const ms = parseMentions(CASES.prose, ENTITIES);
  assert.equal(ms.length, 4);
  assert.equal(ms[0].shape, 'prose');
  assert.equal(ms[0].orderConfidence, 'low');
});

test('emoji 加粗但无编号：保守判为段落式低置信度', () => {
  const ms = parseMentions(CASES.boldEmoji, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['eic', 'jjl', 'qt']);
  assert.equal(ms[0].orderConfidence, 'low');
});

test('劝阻式语境：负面描述被识别', () => {
  const ms = parseMentions(CASES.negative, ENTITIES);
  const byId = Object.fromEntries(ms.map((m) => [m.entityId, m.sentiment]));
  assert.equal(byId.eic, -1, '"顾问水平参差不齐"是负面');
  assert.equal(byId.jjl, -1, '"投诉也不少"是负面（"投诉"必须与"多/不少/率高"组合才判负）');
});

test('品牌名带括号英文：别名归一正确', () => {
  assert.deepEqual(ids(CASES.withParen), ['eic', 'aoji']);
});

test('中英混排：英文别名命中同一实体', () => {
  assert.deepEqual(ids(CASES.mixed), ['eic', 'idp']);
});

test('同一品牌多段重复出现：只计一次，取首次位置', () => {
  const ms = parseMentions(CASES.repeated, ENTITIES);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].entityId, 'eic');
});

test('免责声明：识别排除区间', () => {
  const raw = '正文内容。\n免责声明：本页信息仅供参考。\n启德教育以官方为准。\n\n下一段。';
  const ranges = findExcludedRanges(raw);
  assert.equal(ranges.length, 1);
  assert.ok(raw.slice(ranges[0][0], ranges[0][1]).includes('启德教育'));
  assert.ok(!raw.slice(ranges[0][0], ranges[0][1]).includes('下一段'));
});

test('只出现在免责声明里的品牌必须被剔除（否则认知分会虚高）', () => {
  const raw = '1. 启德教育：资源多，推荐。\n\n免责声明：本页信息仅供参考，琥珀教育与澳际教育的内容以官方为准。';
  assert.deepEqual(ids(raw), ['eic'], '琥珀/澳际只在免责声明里，不能算被推荐');

  // 审计用途下可保留，但必须显式开启
  const kept = ids(raw, { keepExcluded: true });
  assert.ok(kept.includes('hupo'));
  assert.ok(kept.includes('aoji'));
  assert.ok(kept.includes('eic'));
});

test('免责声明在回答开头也能正确排除', () => {
  const raw = '免责声明：本文不构成任何建议。金吉列与 IDP 的信息请以官方为准。\n\n1. 启德教育：推荐。';
  assert.deepEqual(ids(raw), ['eic']);
});

test('形态判定函数直接可用', () => {
  assert.deepEqual(detectShape('1. a\n2. b', 2), { shape: 'numbered', orderConfidence: 'high' });
  assert.equal(detectShape('就是一段话。', 0).shape, 'prose');
});

/* ---------- 举例 vs 推荐排序（真实数据暴露的核心问题） ---------- */

test('"代表：A、B、C" 是举例语境，不是推荐排序', () => {
  const raw = '### 1. 大型连锁留学机构\n代表：启德教育、金吉列留学、IDP 等常见机构。';
  const ms = parseMentions(raw, ENTITIES);
  assert.ok(ms.length >= 3);
  assert.ok(ms.every((m) => m.enumeration === true), '整行由"代表："引导，都是举例');
  assert.equal(ms[0].shape, 'categorical', '多数提及是举例 → 这条回答本质是分类教程');
  assert.equal(ms[0].orderConfidence, 'low', '教程的顺序不能拿来排名次');
});

test('举例计入提及率，但不计入位次分', () => {
  const raw = '代表：启德教育、金吉列留学、IDP 等机构。';
  const parsed = [{ sampleId: 's1', promptId: 'p1', mentions: parseMentions(raw, ENTITIES) }];
  const { metrics } = computeMetrics(parsed, ENTITIES, { topK: 3 });
  const eic = metrics.get('eic');
  assert.equal(eic.mentionRate, 1, '被举例说明 AI 确实认识它');
  assert.equal(eic.rankScore, 0, '但举例不构成推荐位次');
  assert.equal(eic.top1Rate, 0);
  assert.equal(eic.avgRank, null, '没有可计算的位次');
  assert.equal(eic.avgRankDenominator, 0);
});

test('正常推荐列表不受举例规则影响', () => {
  const raw = '1. 启德教育：推荐。\n2. 金吉列留学：不错。';
  const ms = parseMentions(raw, ENTITIES);
  assert.ok(ms.every((m) => m.enumeration === false));
  assert.equal(ms[0].shape, 'numbered');
  assert.equal(ms[0].orderConfidence, 'high');
  const parsed = [{ sampleId: 's1', promptId: 'p1', mentions: ms }];
  const { metrics } = computeMetrics(parsed, ENTITIES, { topK: 3 });
  assert.equal(metrics.get('eic').rankScore, 1, '两条回答里它排第 1，位次分应为 1');
});

test('导语段落里的提及标为低顺序置信度（全文有编号 ≠ 这些提及有顺序）', () => {
  const raw =
    '没有绝对答案：启德教育和金吉列留学都可以做香港留学，关键看顾问。\n\n' +
    '1. 第一类机构\n代表：启德教育、琥珀教育等机构。';
  const ms = parseMentions(raw, ENTITIES);
  const eic = ms.find((m) => m.entityId === 'eic');
  assert.equal(eic.leadIn, true, '首次出现在第一个编号项之前 → 导语');
  assert.equal(eic.orderConfidence, 'low');
});
