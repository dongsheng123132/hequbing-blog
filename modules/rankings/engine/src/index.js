/**
 * 榜单引擎入口：原始回答 → 榜单。
 *
 * 这一层负责把"原始样本"解析成结构化提及，再交给 rank 做指标与排名。
 * 解析产物不落盘到样本文件里，保证原始存档永远是一字未改的 AI 回答。
 */
import { parseMentions } from './parse.js';
import { rankEntities } from './rank.js';

/** 把一条原始样本解析出 mentions（原地不动 raw）。 */
export function parseSample(sample, entities, parseOpts) {
  return { ...sample, mentions: parseMentions(sample.raw, entities, parseOpts) };
}

/**
 * 判断一条样本是否"用于排名"。
 *
 * 实测结论：只有"哪家好/哪个好"这类问题会让 AI 给出机构名单；
 * "怎么办/有没有必要"类问题 AI 一条都不给。用后者算排名，
 * 会把"AI 在方法论问题上不给名单"误当成"这些品牌认知度低"。
 *
 * 样本自带 purpose 时优先用它；早期样本没有该字段，用 promptId 回查榜单配置。
 */
function isRankingSample(sample, rankingPromptIds) {
  if (sample.purpose) return sample.purpose === 'ranking';
  return rankingPromptIds.has(sample.promptId);
}

/**
 * @param {object} p
 * @param {object} p.consortium 榜单配置（entities / weights / topK / bootstrap / parse / groupBy）
 * @param {Array} p.samples 原始样本
 * @param {boolean} [p.rankingOnly] 只用"要求推荐/对比"的问题算排名
 */
export function buildLeaderboard({ consortium, samples, rankingOnly = false }) {
  const entities = consortium.entities ?? [];
  if (entities.length < 2) {
    throw new Error('榜单至少需要 2 个候选实体');
  }
  const seen = new Set();
  for (const e of entities) {
    if (!e.id || !e.name) throw new Error('实体必须同时提供 id 与 name');
    if (seen.has(e.id)) throw new Error(`实体 id 重复：${e.id}`);
    seen.add(e.id);
  }

  const rankingPromptIds = new Set(
    (consortium.prompts ?? []).filter((p) => (p.purpose ?? 'ranking') === 'ranking').map((p) => p.id),
  );
  const useSamples = rankingOnly
    ? samples.filter((s) => isRankingSample(s, rankingPromptIds))
    : samples;

  const parsed = useSamples.map((s) => parseSample(s, entities, consortium.parse));
  const result = rankEntities({
    samples: parsed,
    entities,
    weights: consortium.weights,
    topK: consortium.topK,
    bootstrap: consortium.bootstrap,
  });
  result.meta.rankingOnly = rankingOnly;
  result.meta.inputSamples = samples.length;

  // 分赛道并列榜：DSE 补习社与留学中介不是同一赛道，混算成一个名次序列是事实错误。
  // 指定 groupBy 后，每个赛道各自出一个榜，互不比名次。
  let groups = null;
  if (consortium.groupBy) {
    const key = consortium.groupBy;
    const values = [...new Set(entities.map((e) => e?.[key]).filter(Boolean))];
    groups = {};
    for (const v of values) {
      const sub = entities.filter((e) => e?.[key] === v);
      if (sub.length < 2) continue; // 单个实体的组没有排名意义
      groups[v] = rankEntities({
        samples: parsed,
        entities: sub,
        weights: consortium.weights,
        topK: consortium.topK,
        bootstrap: consortium.bootstrap,
      });
    }
    result.meta.groupBy = key;
    result.meta.groupValues = Object.keys(groups);
  }

  return { consortium, parsedSamples: parsed, groups, ...result };
}
