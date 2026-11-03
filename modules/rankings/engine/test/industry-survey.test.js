import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { surveyAction, SURVEY_ACTIONS } from '../src/survey-actions.js';
import { headToHead } from '../src/head2head.js';
import { openAICompatible } from '../src/sampler/providers/openai-compatible.js';
const catalog = JSON.parse(readFileSync(new URL('../../skills/hequbing-industry-survey/data/industries.json', import.meta.url), 'utf8'));
const industry = catalog.industries[0];
const row = (id, raw, extra = {}) => ({ sampleId: id, industryId: industry.id, promptId: 'ph01', prompt: industry.prompts[0].text,
  engine: 'test', model: 'test-model', channel: 'api', ts: '2026-10-05T00:00:00Z', raw, ...extra });
const report = (samples, extra = {}) => surveyAction('survey.report', { industry: industry.id, samples, ...extra }, catalog);

test('Bootstrap 有放回抽样保留重复样本的权重', () => {
  const entities = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const a = { sampleId: 'a', mentions: [{ entityId: 'a' }] }, b = { sampleId: 'b', mentions: [{ entityId: 'b' }] };
  assert.equal(headToHead([a, a, b], entities).scores.get('a').meanWinRate, 200 / 3);
  assert.equal(headToHead([a, b, b], entities).scores.get('a').meanWinRate, 100 / 3);
});
test('离线计划覆盖三个行业并明确尚未采样', () => {
  assert.deepEqual(SURVEY_ACTIONS, ['survey.list', 'survey.plan', 'survey.report', 'survey.brief']);
  assert.deepEqual(surveyAction('survey.list', {}, catalog).map(i => i.id), ['philippines-logistics', 'power-cord-factories', 'industrial-design']);
  for (const { id } of catalog.industries) {
    const plan = surveyAction('survey.plan', { industry: id }, catalog);
    assert.equal(plan.collectionStatus, 'not_started');
    assert.ok(plan.diagnosisChecks.length > 0);
  }
});

test('同行比较使用同一道题的真实分母，未采样题保持 null', () => {
  const entities = [...industry.entities, { id: 'test-rival', name: '测试同业物流' }];
  const p2 = industry.prompts[1];
  const out = report([row('rival', '1. 测试同业物流。'), row('own', '1. 菲邦物流。', { promptId: p2.id, prompt: p2.text }),
    row('fail', null, { error: 'timeout' })], { entities });
  const [one, two, untested] = out.byModel[0].byPrompt;
  assert.equal(one.samples, 1);
  assert.equal(one.metrics[0].mentionRate, 0);
  assert.equal(one.metrics[1].mentionRate, 1);
  assert.deepEqual(one.metrics[1].evidenceIds, ['rival']);
  assert.equal(two.metrics[0].mentionRate, 1);
  assert.equal(untested.samples, 0);
  assert.equal(untested.metrics[0].mentionRate, null);
  assert.deepEqual(untested.evidenceIds, []);
});

test('不同地区、语言、联网和调查批次不混为一组', () => {
  const out = report([row('base', '菲邦物流'), row('region', '菲邦物流', { region: 'CN' }),
    row('locale', '菲邦物流', { locale: 'zh-CN' }), row('batch', '菲邦物流', { batch: 'second' }),
    row('search', '菲邦物流', { webSearch: true })]);
  assert.equal(out.byModel.length, 5);
  assert.ok(out.byModel.every((g) => g.rankingSamples === 1));
  assert.equal(out.byModel[0].region, 'unknown');
});
test('重复导入不增分，失败不当零，行为题不改变自然提及率', () => {
  const yes = row('yes', '1. 菲邦国际物流。');
  const behavior = industry.prompts.find((p) => p.purpose === 'behavior');
  const out = report([yes, yes, row('no', '需要进一步寻找资料。'), row('fail', null, { error: 'timeout' }),
    row('behavior', '菲邦物流', { promptId: behavior.id, prompt: behavior.text })]);
  assert.equal(out.byModel[0].metrics[0].mentionRate, 0.5);
  assert.equal(out.coverage.duplicateRows, 1);
  assert.equal(out.coverage.failedRows, 1);
  assert.equal(out.byModel[0].rankingSamples, 2);
});
test('演示与截断答案不可充作实测', () => {
  const out = report([row('s', '菲邦物流', { synthetic: true }), row('t', '菲邦物流', { finishReason: 'length' })]);
  assert.equal(out.status, 'no_real_samples');
  assert.equal(out.byModel.length, 0);
});
test('实际模型和产品界面分别统计，不生成加权总榜', () => {
  const out = report([row('a', '菲邦物流'), row('b', '资料不足', { model: 'another' }), row('c', '菲邦物流', { channel: 'product_ui' })]);
  assert.equal(out.byModel.length, 3);
  assert.equal(out.rank, undefined);
});
test('冻结问题、行业和证据 ID 冲突不能被悄悄接受', () => {
  assert.throws(() => report([row('x', 'a', { prompt: '改题' })]), /冻结题库/);
  assert.throws(() => report([row('x', 'a', { industryId: 'another' })]), /行业/);
  assert.throws(() => report([row('x', 'a'), row('x', 'b')]), /冲突/);
});
test('只有行为题时分母零返回 null，原始证据保留', () => {
  const p = industry.prompts.find((p) => p.purpose === 'behavior');
  const out = report([row('x', '原文\n不改', { promptId: p.id, prompt: p.text })]);
  assert.equal(out.byModel[0].metrics[0].mentionRate, null);
  assert.equal(out.evidence[0].raw, '原文\n不改');
});
test('咨询动作仅生成草稿，未知字段不会自动发送', () => {
  const out = surveyAction('survey.brief', { industry: industry.id, request: { company: '测试公司', token: 'private' } }, catalog);
  assert.equal(out.status, 'draft_not_sent');
  assert.equal(out.request.token, undefined);
  assert.equal(out.paymentAvailable, false);
});
test('适配器保留模型返回的 usage 并限制输出长度', async () => {
  const previous = globalThis.fetch;
  let request;
  globalThis.fetch = async (_, opts) => { request = JSON.parse(opts.body); return new Response(JSON.stringify({ model: 'actual', id: 'id', usage: { total_tokens: 12, cost: 0 }, choices: [{ finish_reason: 'stop', message: { content: '原文' } }] })); };
  try {
    const result = await openAICompatible({ id: 'test', baseURL: 'https://example.invalid', apiKey: 'local-test', model: 'm', maxTokens: 1024 }).ask('问题', {});
    assert.equal(request.max_tokens, 1024);
    assert.equal(result.usage.total_tokens, 12);
    assert.equal(result.model, 'actual');
    await openAICompatible({ id: 'test', baseURL: 'https://example.invalid', apiKey: 'local-test', model: 'm', temperature:null }).ask('问题', {});
    assert.equal(Object.hasOwn(request, 'temperature'), false, '直接 API 故障补采时可沿用 CLI 的默认温度，不暗中指定新参数');
  } finally { globalThis.fetch = previous; }
});
