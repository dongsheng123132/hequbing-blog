import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMentions, parseCnNumber, findListMarkers } from '../src/parse.js';
import { computeMetrics, orderScore, normalizeOrder } from '../src/metrics.js';
import { computeARS, normalizeWeights, DEFAULT_WEIGHTS } from '../src/score.js';
import { rankEntities } from '../src/rank.js';
import { buildLeaderboard } from '../src/index.js';

const ENTITIES = [
  { id: 'midea', name: '美的', aliases: ['Midea', '美的集团'] },
  { id: 'galanz', name: '格兰仕', aliases: ['Galanz'] },
  { id: 'panasonic', name: '松下', aliases: ['Panasonic'] },
  { id: 'xiaomi', name: '小米', aliases: ['米家'] },
];

const mk = (raw, extra = {}) => ({
  sampleId: extra.sampleId ?? `s${Math.abs(hash(raw))}`,
  promptId: extra.promptId ?? 'p001',
  engine: extra.engine ?? 'doubao',
  region: extra.region ?? 'CN',
  raw,
  ...extra,
});

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

test('中文序号解析', () => {
  assert.equal(parseCnNumber('三'), 3);
  assert.equal(parseCnNumber('十'), 10);
  assert.equal(parseCnNumber('十二'), 12);
  assert.equal(parseCnNumber('二十'), 20);
  assert.equal(parseCnNumber('二十三'), 23);
  assert.ok(Number.isNaN(parseCnNumber('甲')));
});

test('编号列表识别', () => {
  const text = '1. 美的\n2、格兰仕\n十二、松下';
  const markers = findListMarkers(text);
  assert.deepEqual(markers.map((m) => m.num), [1, 2, 12]);
});

test('Markdown 标题式编号也识别（真实 AI 回答极常见）', () => {
  // 实测通义千问会用 `## 1. 机构名` 组织推荐列表；不认这个前缀，整篇会退化成"出现顺序"
  const text = '## 1. 新东方前途出国\n正文\n### 2. 启德教育\n正文\n**3.** 金吉列留学\n- 不算编号';
  const markers = findListMarkers(text);
  assert.deepEqual(markers.map((m) => m.num), [1, 2, 3]);
});

test('真实回答形态：## 编号 + 标题内机构名 → 位次正确', () => {
  const raw =
    '## 1. 美的：性价比高，很推荐\n\n' +
    '## 2. 格兰仕：专业做微波炉的老牌厂商\n\n' +
    '## 3. 松下：进口品质，价格偏高';
  const ms = parseMentions(raw, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['midea', 'galanz', 'panasonic']);
  assert.ok(ms.every((m) => m.rankSource === 'list-marker'), '应走编号路径，而不是退化成出现顺序');
  assert.deepEqual(ms.map((m) => m.rank), [1, 2, 3]);
});

test('编号列表给出真实位次', () => {
  const raw = '1. 美的：性价比高，很推荐。\n2. 格兰仕：老牌厂商。\n3. 松下：进口品质。';
  const ms = parseMentions(raw, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['midea', 'galanz', 'panasonic']);
  assert.deepEqual(ms.map((m) => m.rank), [1, 2, 3]);
  assert.ok(ms.every((m) => m.rankSource === 'list-marker'));
});

test('无编号时按出现顺序定序', () => {
  const raw = '推荐美的和格兰仕，另外小米也不错。';
  const ms = parseMentions(raw, ENTITIES);
  assert.deepEqual(ms.map((m) => m.entityId), ['midea', 'galanz', 'xiaomi']);
  assert.ok(ms.every((m) => m.rankSource === 'appearance-order'));
  assert.deepEqual(ms.map((m) => m.rank), [1, 2, 3]);
});

test('最长别名优先，不被短别名切走', () => {
  const raw = '美的集团是行业龙头。';
  const ms = parseMentions(raw, ENTITIES);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].surface, '美的集团');
});

test('情感判定不被相邻列表项污染', () => {
  const raw = '1. 美的：不推荐购买。\n2. 格兰仕：首推。';
  const ms = parseMentions(raw, ENTITIES);
  const byId = Object.fromEntries(ms.map((m) => [m.entityId, m]));
  assert.equal(byId.midea.sentiment, -1, '美的句内是否定，必须判负');
  assert.equal(byId.galanz.sentiment, 1, '格兰仕句内是正面，不能被上一句的否定带偏');
});

test('提及带原文偏移与证据句，可回溯', () => {
  const raw = '综合来看，松下表现稳定。';
  const ms = parseMentions(raw, ENTITIES);
  assert.equal(raw.slice(ms[0].start, ms[0].end), '松下');
  assert.ok(ms[0].evidence.includes('松下'));
});

test('位次分公式', () => {
  assert.equal(orderScore(1, 4), 1);
  assert.equal(orderScore(4, 4), 0.25);
  assert.equal(orderScore(5, 4), 0);
  assert.equal(orderScore(0, 4), 0);
});

test('normalizeOrder 把任意 rank 还原成 1..n', () => {
  const out = normalizeOrder([
    { entityId: 'a', rank: 1001 },
    { entityId: 'b', rank: 2 },
    { entityId: 'c', rank: 1002 },
  ]);
  assert.deepEqual(out.map((m) => [m.entityId, m.order]), [['b', 1], ['a', 2], ['c', 3]]);
});

test('同一编号项下的多个实体是并列，不是依次相接', () => {
  // 真实形态：`### 1. 大型连锁机构` 下面跟 `- 新东方 / - 金吉列 / - 启德`
  // 它们共享同一个序位，不能被算成第 1、2、3 名
  const out = normalizeOrder([
    { entityId: 'a', rank: 1, start: 0 },
    { entityId: 'b', rank: 1.001, start: 10 },
    { entityId: 'c', rank: 1.002, start: 20 },
    { entityId: 'd', rank: 2, start: 30 },
  ]);
  const byId = Object.fromEntries(out.map((m) => [m.entityId, m.order]));
  assert.equal(byId.a, 1);
  assert.equal(byId.b, 1, '同一编号项下应并列');
  assert.equal(byId.c, 1);
  assert.equal(byId.d, 2, '下一个编号项才是第 2 位');
});

test('未提及的实体在所有正向指标上都是 0', () => {
  const samples = [mk('1. 美的：推荐。\n2. 格兰仕：不错。')];
  const parsed = samples.map((s) => ({ ...s, mentions: parseMentions(s.raw, ENTITIES) }));
  const { metrics } = computeMetrics(parsed, ENTITIES, { topK: 3 });
  const p = metrics.get('panasonic');
  assert.equal(p.mentionRate, 0);
  assert.equal(p.rankScore, 0);
  assert.equal(p.top1Rate, 0);
  assert.equal(p.soV, 0);
  assert.equal(p.stability, 0);
  assert.equal(p.sentiment, 0, '不被提及不能白拿中性情感分 0.5');
  assert.equal(computeARS(p, DEFAULT_WEIGHTS), 0);
});

test('权重自动归一化，缺省项继承默认权重', () => {
  const w = normalizeWeights({ mentionRate: 1, rankScore: 1 });
  // 只显式给了两项，其余继承 DEFAULT_WEIGHTS，最后整体归一化
  assert.ok(Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 1e-9, '归一化后总和必须为 1');
  assert.ok(Math.abs(w.mentionRate - w.rankScore) < 1e-12, '显式给的两项权重相等，归一化后仍应相等');
  assert.ok(w.mentionRate > w.top1Rate, '显式项应高于未显式给出的默认项');
  assert.ok(Math.abs(w.top1Rate - DEFAULT_WEIGHTS.top1Rate / 2.35) < 1e-9);
  assert.throws(() => normalizeWeights({ mentionRate: -1 }));
  assert.throws(() => normalizeWeights({ mentionRate: 0, rankScore: 0, top1Rate: 0, soV: 0, stability: 0, sentiment: 0 }));
});

test('幻觉率作为扣分项生效', () => {
  const base = {
    mentionRate: 1, rankScore: 1, top1Rate: 1, soV: 1, stability: 1, sentiment: 1,
    hallucinationRate: 0,
  };
  const clean = computeARS(base, DEFAULT_WEIGHTS);
  const dirty = computeARS({ ...base, hallucinationRate: 1 }, DEFAULT_WEIGHTS);
  assert.equal(clean, 100);
  assert.ok(dirty < clean);
  assert.equal(dirty, 90);
});

test('固定种子 = 可复算：同输入两次排名完全一致', () => {
  const samples = buildSamples();
  const a = rankEntities({ samples: samples.map(parse), entities: ENTITIES, bootstrap: { iterations: 300, seed: 42 } });
  const b = rankEntities({ samples: samples.map(parse), entities: ENTITIES, bootstrap: { iterations: 300, seed: 42 } });
  assert.equal(JSON.stringify(a.rows), JSON.stringify(b.rows));
});

test('置信区间随样本变化，且区间包含各自点估计', () => {
  const samples = buildSamples();
  const res = rankEntities({ samples: samples.map(parse), entities: ENTITIES, bootstrap: { iterations: 500, seed: 'x' } });
  for (const r of res.rows) {
    assert.ok(r.arsCi95[0] <= r.ars + 1e-9, `${r.name} ARS CI 下界应 ≤ 点估计`);
    assert.ok(r.arsCi95[1] >= r.ars - 1e-9, `${r.name} ARS CI 上界应 ≥ 点估计`);
    if (r.meanWinRate === null) continue;
    assert.ok(r.ci95[0] <= r.meanWinRate + 1e-9, `${r.name} 击败率 CI 下界应 ≤ 点估计`);
    assert.ok(r.ci95[1] >= r.meanWinRate - 1e-9, `${r.name} 击败率 CI 上界应 ≥ 点估计`);
  }
});

test('统计不可区分的名次会被合并成并列带', () => {
  // 两个实体在样本里完全对称（各赢一半）→ 分数必然相同，CI 应重叠
  const samples = [
    mk('1. 美的\n2. 格兰仕', { sampleId: 'a1' }),
    mk('1. 美的\n2. 格兰仕', { sampleId: 'a2' }),
    mk('1. 格兰仕\n2. 美的', { sampleId: 'a3' }),
    mk('1. 格兰仕\n2. 美的', { sampleId: 'a4' }),
  ];
  const res = rankEntities({ samples: samples.map(parse), entities: ENTITIES, bootstrap: { iterations: 400, seed: 7 } });
  const midea = res.rows.find((r) => r.entityId === 'midea');
  const galanz = res.rows.find((r) => r.entityId === 'galanz');
  assert.ok(Math.abs(midea.ars - galanz.ars) < 1e-9, '对称样本下两者应当同分');
  assert.ok(midea.band, '同分且 CI 重叠时必须给出并列带，而不是硬排先后');
  assert.deepEqual(midea.band, [1, 2]);
  assert.ok(res.byEngine.doubao, '应产出分引擎视图');
  assert.ok(res.byRegion.CN, '应产出分地域视图');
});

test('分引擎/分地域视图能揭示"同一个问题，不同 AI 答案不同"', () => {
  const samples = [
    mk('1. 美的：推荐。\n2. 格兰仕。', { engine: 'doubao', region: 'CN' }),
    mk('1. 美的：推荐。\n2. 格兰仕。', { engine: 'doubao', region: 'CN' }),
    mk('1. 格兰仕：推荐。\n2. 小米。', { engine: 'gpt', region: 'US' }),
    mk('1. 格兰仕：推荐。\n2. 小米。', { engine: 'gpt', region: 'US' }),
  ];
  const res = rankEntities({ samples: samples.map(parse), entities: ENTITIES, bootstrap: { iterations: 0 } });
  const doubaoTop = res.byEngine.doubao.rows[0].entityId;
  const gptTop = res.byEngine.gpt.rows[0].entityId;
  assert.equal(doubaoTop, 'midea');
  assert.equal(gptTop, 'galanz');
});

test('buildLeaderboard 校验实体配置', () => {
  assert.throws(() => buildLeaderboard({ consortium: { entities: [{ id: 'a', name: 'A' }] }, samples: [] }), /至少需要 2 个/);
  assert.throws(
    () => buildLeaderboard({ consortium: { entities: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] }, samples: [] }),
    /重复/,
  );
});

test('分赛道并列榜：各赛道独立排名，单实体赛道被跳过', () => {
  const ents = [
    { id: 'a1', name: 'A1', type: 'cat' },
    { id: 'a2', name: 'A2', type: 'cat' },
    { id: 'b1', name: 'B1', type: 'dog' },
    { id: 'b2', name: 'B2', type: 'dog' },
    { id: 'c1', name: 'C1', type: 'solo' },
  ];
  const raw = '1. A1：推荐。\n2. B2：不错。';
  const samples = [0, 1].map((i) => ({
    sampleId: `x${i}`,
    promptId: 'p1',
    engine: 'e',
    region: 'CN',
    raw,
  }));
  const res = buildLeaderboard({
    consortium: { id: 'g', title: 'G', topK: 3, groupBy: 'type', entities: ents, bootstrap: { iterations: 0 } },
    samples,
  });
  assert.ok(res.groups.cat, '每个赛道各自成榜');
  assert.equal(res.groups.cat.rows[0].entityId, 'a1');
  assert.ok(res.groups.dog);
  assert.equal(res.groups.dog.rows[0].entityId, 'b2');
  assert.equal(res.groups.solo, undefined, '单实体赛道没有排名意义，应跳过');
  assert.equal(res.meta.groupBy, 'type');
  assert.deepEqual(res.meta.groupValues.sort(), ['cat', 'dog']);
});

test('未指定 groupBy 时不产出分组榜（不增加无谓开销）', () => {
  const res = buildLeaderboard({
    consortium: { id: 't', title: 'T', topK: 4, entities: ENTITIES, bootstrap: { iterations: 0 } },
    samples: buildSamples(),
  });
  assert.equal(res.groups, null);
  assert.equal(res.meta.groupBy, undefined);
});

test('榜单按成对击败率降序输出名次，名次连续', () => {
  const res = buildLeaderboard({
    consortium: { id: 't', title: 'T', topK: 4, entities: ENTITIES, bootstrap: { iterations: 100, seed: 1 } },
    samples: buildSamples(),
  });
  for (let i = 1; i < res.rows.length; i++) {
    const prev = res.rows[i - 1].meanWinRate ?? -1;
    const cur = res.rows[i].meanWinRate ?? -1;
    assert.ok(prev >= cur, '主排序依据必须是平均击败率，且降序');
    assert.equal(res.rows[i].position, i + 1);
  }
  assert.equal(res.meta.methodologyVersion, '0.2.1');
  assert.ok(/^[0-9a-f]{8}$/.test(res.meta.fingerprint), '必须带方法论指纹');
});

function parse(s) {
  return { ...s, mentions: parseMentions(s.raw, ENTITIES) };
}

function buildSamples() {
  const raws = [
    '1. 美的：性价比高，推荐。\n2. 格兰仕：老牌。\n3. 松下：贵但稳。',
    '推荐格兰仕和美的，小米也可以考虑。',
    '1. 松下：进口品质，首推。\n2. 美的：销量第一。',
    '1. 美的：推荐。\n2. 小米：性价比之选。',
    '综合来看美的、格兰仕都不错，松下偏贵。',
    '1. 格兰仕：专业做微波炉，首选。\n2. 美的。',
  ];
  const out = [];
  let i = 0;
  for (const engine of ['doubao', 'deepseek']) {
    for (const region of ['CN', 'HK']) {
      for (let r = 1; r <= 2; r++) {
        for (const raw of raws) {
          out.push(mk(raw, { sampleId: `s${++i}`, engine, region, run: r, promptId: `p00${(i % 3) + 1}` }));
        }
      }
    }
  }
  return out;
}
