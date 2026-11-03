import test from 'node:test';
import assert from 'node:assert/strict';

import { findUnknownEntities, scanUnknownEntities } from '../src/unknown.js';

const E = [
  { id: 'eic', name: '启德教育', aliases: ['启德'] },
  { id: 'jjl', name: '金吉列留学', aliases: ['金吉列'] },
];

test('发现未收录的中文机构名（这是防止假结论的关键）', () => {
  const raw = '可以看看启德教育，另外学联海外升学中心、琥珀教育口碑也不错。';
  const u = findUnknownEntities(raw, E);
  const surfaces = u.map((x) => x.surface);
  assert.ok(surfaces.some((s) => s.includes('琥珀教育')), `应检出「琥珀教育」，实际检出：${surfaces.join('、')}`);
  assert.ok(!surfaces.some((s) => s.includes('启德')), '已收录的不应报');
});

test('泛指词不会被当成机构名', () => {
  const raw = '大型综合留学机构、这家机构、正规中介、本地升学顾问、这类培训机构都要谨慎对比。';
  const u = findUnknownEntities(raw, E);
  assert.equal(u.length, 0, `泛指词不应被检出，实际：${u.map((x) => x.surface).join('、')}`);
});

test('已收录机构的完整区间不报（含被别名覆盖的情况）', () => {
  const raw = '金吉列留学的港校申请经验比较丰富。';
  const u = findUnknownEntities(raw, E);
  assert.equal(u.length, 0);
});

test('相同候选按出现次数聚合排序', () => {
  const raw = '琥珀教育不错。琥珀教育服务好。另外学联海外升学中心也可以。';
  const u = findUnknownEntities(raw, E);
  assert.ok(u[0].count >= 2, '出现两次的应排在前面');
  assert.ok(u[0].surface.includes('琥珀'));
});

test('批量扫描聚合并保留样本来源', () => {
  const samples = [
    { sampleId: 's1', raw: '推荐琥珀教育。' },
    { sampleId: 's2', raw: '琥珀教育和学联海外升学中心都可以。' },
  ];
  const hits = scanUnknownEntities(samples, E);
  const hupo = hits.find((h) => h.surface.includes('琥珀'));
  assert.ok(hupo, `应检出琥珀教育，实际：${hits.map((h) => h.surface).join('、')}`);
  assert.equal(hupo.count, 2);
  assert.deepEqual([...hupo.sampleIds].sort(), ['s1', 's2']);
});

test('默认要求跨样本重复出现（单次出现多为截断片段）', () => {
  const once = scanUnknownEntities([{ sampleId: 's1', raw: '推荐琥珀教育。' }], E);
  assert.equal(once.length, 0, '只出现 1 次的默认不报，避免"取决于具体顾问"这类截断误报');
  const twice = scanUnknownEntities(
    [{ sampleId: 's1', raw: '推荐琥珀教育。' }, { sampleId: 's2', raw: '琥珀教育不错。' }],
    E,
  );
  assert.equal(twice.length, 1);
});

test('空输入与空实体表不崩溃', () => {
  assert.deepEqual(findUnknownEntities('', E), []);
  assert.deepEqual(findUnknownEntities(null, E), []);
  assert.ok(Array.isArray(findUnknownEntities('随便一段话', [])));
});
