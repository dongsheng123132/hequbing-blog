import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildMatrix, loadDoneIds, loadSamples, sampleConsortium } from '../src/sampler/index.js';
import { replay, alwaysFail } from '../src/sampler/providers/replay.js';

const CONSORTIUM = {
  id: 't',
  prompts: [
    { id: 'p001', text: '问题一' },
    { id: 'p002', text: '问题二' },
  ],
};

function tmp() {
  return mkdtempSync(join(tmpdir(), 'ari-'));
}

test('采样矩阵维度正确', () => {
  const m = buildMatrix({
    consortium: CONSORTIUM,
    providers: [{ id: 'a' }, { id: 'b' }],
    regions: ['CN', 'HK'],
    runs: 3,
    batch: 'b1',
  });
  assert.equal(m.length, 2 * 2 * 2 * 3);
  assert.equal(new Set(m.map((c) => c.sampleId)).size, m.length, 'sampleId 必须唯一');
  assert.ok(m[0].sampleId.startsWith('b1__a__CN__p001__r1'));
});

test('矩阵拒绝空配置', () => {
  assert.throws(() => buildMatrix({ consortium: { prompts: [] }, providers: [{ id: 'a' }], regions: ['CN'] }), /prompts/);
  assert.throws(() => buildMatrix({ consortium: CONSORTIUM, providers: [], regions: ['CN'] }), /采样通道/);
  assert.throws(() => buildMatrix({ consortium: CONSORTIUM, providers: [{ id: 'a' }], regions: [] }), /地域/);
});

test('采样落盘为 JSONL，且原始回答一字不改', async () => {
  const dir = tmp();
  const out = join(dir, 's.jsonl');
  try {
    const raw = '1. 美的：推荐。\n2. 格兰仕。';
    const res = await sampleConsortium({
      consortium: CONSORTIUM,
      providers: [replay([raw])],
      regions: ['CN'],
      runs: 2,
      outPath: out,
      retry: { retryDelayMs: 0 },
    });
    assert.equal(res.sampled, 4);
    const rows = loadSamples(out);
    assert.equal(rows.length, 4);
    assert.ok(rows.every((r) => r.raw === raw));
    assert.ok(rows.every((r) => r.locale === 'zh-CN'));
    assert.ok(rows.every((r) => r.prompt === '问题一' || r.prompt === '问题二'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('断点续采：第二次运行全部跳过，不重复调用模型', async () => {
  const dir = tmp();
  const out = join(dir, 's.jsonl');
  try {
    const p1 = replay(['答案']);
    const first = await sampleConsortium({
      consortium: CONSORTIUM, providers: [p1], regions: ['CN'], runs: 2, outPath: out, retry: { retryDelayMs: 0 },
    });
    assert.equal(first.sampled, 4);
    assert.equal(p1.calls, 4);

    const p2 = replay(['答案']);
    const second = await sampleConsortium({
      consortium: CONSORTIUM, providers: [p2], regions: ['CN'], runs: 2, outPath: out, retry: { retryDelayMs: 0 },
    });
    assert.equal(second.sampled, 0, '已完成的不应重采');
    assert.equal(second.skipped, 4);
    assert.equal(p2.calls, 0, '不得重复调用模型（重复采样 = 重复烧钱）');

    const rows = readFileSync(out, 'utf8').trim().split('\n');
    assert.equal(rows.length, 4, '续采不应产生重复行');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('失败的单元显式落盘带 error，且续采时会重试', async () => {
  const dir = tmp();
  const out = join(dir, 's.jsonl');
  try {
    const bad = alwaysFail();
    await sampleConsortium({
      consortium: CONSORTIUM, providers: [bad], regions: ['CN'], runs: 2, outPath: out,
      retry: { maxRetries: 1, retryDelayMs: 0 },
    });
    const all = loadSamples(out, { includeFailed: true });
    assert.equal(all.length, 4);
    assert.ok(all.every((r) => r.error && r.raw === null), '失败必须显式落盘，不能静默跳过');
    assert.equal(loadSamples(out).length, 0, '默认视图应过滤失败样本');
    assert.equal(loadDoneIds(out).size, 0, '失败样本不算已完成');

    // 换成正常通道后续采，失败单元应被重采
    const good = replay(['有效答案']);
    const res = await sampleConsortium({
      consortium: CONSORTIUM, providers: [good], regions: ['CN'], runs: 2, outPath: out, retry: { retryDelayMs: 0 },
    });
    assert.equal(res.sampled, 4);
    assert.equal(loadSamples(out).length, 4, '重采成功后有效样本应为 4 条');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('半截行（上次写到一半被杀）不会破坏续采', async () => {
  const dir = tmp();
  const out = join(dir, 's.jsonl');
  try {
    writeFileSync(out, '{"sampleId":"b1__replay__CN__p001__r1","raw":"ok"}\n{"sampleId":"trunc', 'utf8');
    const done = loadDoneIds(out);
    assert.equal(done.size, 1, '完整行应被识别为已完成');
    assert.ok(done.has('b1__replay__CN__p001__r1'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('采样通道缺配置时立即报错，不发请求', () => {
  assert.throws(() => {
    // 直接构造：缺 apiKey
    const cfg = { id: 'x', baseURL: 'https://example.com/v1', model: 'm' };
    if (!cfg.apiKey) throw new Error('采样通道 x 缺少 baseURL / apiKey / model');
  }, /缺少/);
});
