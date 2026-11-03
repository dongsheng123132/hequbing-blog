import test from 'node:test';
import assert from 'node:assert/strict';

import { SCHEMA_VERSION, toPublicIndex, toPublicJson } from '../src/export.js';
import { buildLeaderboard } from '../src/index.js';

const CONSORTIUM = {
  id: 't',
  title: 'T 榜',
  category: 'test',
  topK: 3,
  bootstrap: { iterations: 0 },
  entities: [
    { id: 'a', name: '甲', type: 'x' },
    { id: 'b', name: '乙', type: 'x' },
  ],
};

const SAMPLES = [
  { sampleId: 's1', promptId: 'p1', engine: 'e1', region: 'CN', raw: '1. 甲：推荐。\n2. 乙：一般。' },
  { sampleId: 's2', promptId: 'p1', engine: 'e1', region: 'CN', raw: '1. 甲：推荐。\n2. 乙：一般。' },
];

function build() {
  return buildLeaderboard({ consortium: CONSORTIUM, samples: SAMPLES });
}

test('导出结构带版本与溯源信息（订阅方据此判断可比性）', () => {
  const out = toPublicJson({ consortium: CONSORTIUM, lb: build() });
  assert.equal(out.schemaVersion, SCHEMA_VERSION);
  assert.equal(out.consortium.id, 't');
  assert.equal(out.provenance.sampleCount, 2);
  assert.deepEqual(out.provenance.engines, ['e1']);
  assert.equal(typeof out.methodology.fingerprint, 'string');
  assert.equal(out.methodology.rankingBasis, 'pairwise-win-rate');
  assert.ok(out.rows.length === 2);
});

test('绝不导出原始 AI 回答（核心资产不随数据订阅免费送出）', () => {
  const out = toPublicJson({ consortium: CONSORTIUM, lb: build() });
  const json = JSON.stringify(out);
  assert.ok(!json.includes('推荐。'), '原始回答文本不得出现在导出文件里');
  assert.equal(out.raw, undefined);
  assert.equal(out.parsedSamples, undefined);
  assert.ok(!json.includes('"raw"'));
});

test('null 策略被写进导出文件，避免下游把"没测过"当成"表现差"', () => {
  const out = toPublicJson({ consortium: CONSORTIUM, lb: build() });
  assert.deepEqual(out.methodology.nullPolicy, {
    notMentioned: 0,
    failedSample: 'excluded-from-denominator',
    zeroDenominator: null,
    sentimentWhenAbsent: 0,
  });
});

test('并列带（统计不可区分）必须传给订阅方，不能只给一个名次数字', () => {
  const consortium = {
    ...CONSORTIUM,
    entities: [
      { id: 'a', name: '甲' },
      { id: 'b', name: '乙' },
    ],
  };
  const samples = [
    { sampleId: 's1', promptId: 'p1', raw: '1. 甲\n2. 乙' },
    { sampleId: 's2', promptId: 'p1', raw: '1. 乙\n2. 甲' },
  ];
  const out = toPublicJson({
    consortium,
    lb: buildLeaderboard({ consortium, samples }),
  });
  const banded = out.rows.filter((r) => r.band);
  assert.equal(banded.length, 2, '对称样本下两名应落在同一并列带');
  assert.deepEqual(banded[0].band, [1, 2]);
});

test('指标里的空值导出为 null，而不是被压成 0', () => {
  const consortium = {
    ...CONSORTIUM,
    entities: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }],
  };
  const samples = [{ sampleId: 's1', promptId: 'p1', raw: '1. 甲：推荐。' }];
  const out = toPublicJson({ consortium, lb: buildLeaderboard({ consortium, samples }) });
  const b = out.rows.find((r) => r.entityId === 'b');
  assert.equal(b.metrics.avgRank, null, '未被提及 → 平均位次的分母为 0 → null');
  assert.equal(b.metrics.mentionRate, 0, '但提及率是 0（确实零次提及），不是 null');
});

test('站点索引列出全部数据集并标记演示数据', () => {
  const idx = toPublicIndex({
    siteName: 'S',
    boards: [
      { id: 'x', title: 'X', href: 'x.html', sampleCount: 10, entityCount: 3, engines: ['e'], regions: ['CN'], isSynthetic: true },
    ],
  });
  assert.equal(idx.schemaVersion, SCHEMA_VERSION);
  assert.equal(idx.datasets.length, 1);
  assert.equal(idx.datasets[0].url, 'data/x.json');
  assert.equal(idx.datasets[0].isSynthetic, true);
});
