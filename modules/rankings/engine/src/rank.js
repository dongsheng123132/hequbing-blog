/**
 * 排名与不确定性。
 *
 * 两条不容妥协的规矩：
 *  1. **主排序依据是成对击败率，不是绝对综合分。** 成对比较在同一条回答内部完成配对，
 *     直接抵消 prompt 难度、引擎偏好、时间窗等系统性偏差；绝对分会被"这批问题整体难不难"影响。
 *     ARS 仍然计算并展示，但只用于展示与趋势追踪。
 *  2. **不假装比数据更确定。** 平均击败率的 95% 置信区间一旦重叠，就必须报并列
 *     （"第 5–8 名无统计差异"），而不是硬排先后。
 */
import { computeMetrics } from './metrics.js';
import { computeARS, normalizeWeights } from './score.js';
import { headToHead } from './head2head.js';
import { bootstrapIndices, hashSeed, mulberry32, quantile } from './rng.js';
import {
  METHODOLOGY_VERSION,
  NORMALIZATION_ANCHORS,
  SCORING_ALPHA,
  MIN_REPORTABLE_N,
  methodologyFingerprint,
} from './methodology.js';

const CI_LO = 0.025;
const CI_HI = 0.975;

function sortRows(rows) {
  rows.sort((a, b) => {
    const av = a.meanWinRate ?? -1;
    const bv = b.meanWinRate ?? -1;
    if (bv !== av) return bv - av;
    return (b.ars ?? -1) - (a.ars ?? -1) || (a.entityId < b.entityId ? -1 : 1);
  });
  return rows;
}

/** 两个置信区间是否相交。 */
function overlaps(a, b) {
  if (!a || !b) return false;
  return a[0] <= b[1] && b[0] <= a[1];
}

/**
 * 把 CI 重叠的名次合并成并列带。
 *
 * 判据是「与**本组第一个成员**的置信区间相交」，而不是「与当前组的上界比较」。
 * 后者会把链式区间一路吞并：一个 ARS=0 的实体（CI 恒为 [0,0]）只要下界 0 小于
 * 高分组的上界，就会被并进同一带，最后整张榜变成一条并列带。
 */
function assignBands(rows) {
  let bandStart = 0;
  for (let i = 1; i <= rows.length; i++) {
    if (i < rows.length && overlaps(rows[i].ci95, rows[bandStart].ci95)) continue;
    const band = i - 1 === bandStart ? null : [bandStart + 1, i];
    for (let j = bandStart; j < i; j++) rows[j].band = band;
    bandStart = i;
  }
  rows.forEach((r, i) => {
    r.position = i + 1;
  });
  return rows;
}

/**
 * 分组视图（分引擎 / 分地域）。
 * 注意：分组后样本量变小，击败率噪声大，因此这里用样本内 ARS 排序，仅作对比参考。
 */
function groupView(samples, entities, key, weights, topK) {
  const groups = new Map();
  for (const s of samples) {
    const g = s[key];
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(s);
  }
  const view = {};
  for (const [g, subset] of groups) {
    const { metrics } = computeMetrics(subset, entities, { topK });
    const rows = entities
      .map((e) => {
        const m = metrics.get(e.id);
        return { entityId: e.id, name: e.name, ars: computeARS(m, weights), metrics: m };
      })
      .sort((a, b) => (b.ars ?? -1) - (a.ars ?? -1) || (a.entityId < b.entityId ? -1 : 1));
    rows.forEach((r, i) => {
      r.position = i + 1;
    });
    view[g] = { sampleCount: subset.length, rows };
  }
  return view;
}

/**
 * @param {object} p
 * @param {Array} p.samples 已解析的有效样本（采样失败行必须已剔除）
 * @param {Array} p.entities
 * @param {Record<string,number>} [p.weights]
 * @param {number} [p.topK]
 * @param {{iterations?:number, seed?:number|string}} [p.bootstrap]
 */
export function rankEntities({
  samples,
  entities,
  weights,
  topK = 10,
  bootstrap = {},
  alpha = SCORING_ALPHA,
  minReportableN = MIN_REPORTABLE_N,
}) {
  const w = normalizeWeights(weights);
  const iterations = Math.max(0, bootstrap.iterations ?? 2000);
  const seed =
    typeof bootstrap.seed === 'number'
      ? bootstrap.seed
      : hashSeed(String(bootstrap.seed ?? samples.map((s) => s.sampleId).join('|')));

  const { metrics, totalSamples, allMentions } = computeMetrics(samples, entities, {
    topK,
    alpha,
    minReportableN,
  });
  const h2h = headToHead(samples, entities);

  // 跨通道覆盖率：这个实体在几个采样通道里被提到过。
  // 这是"分布式 AI 调查"的核心指标 —— "AI 认识你"取决于用户在用哪个 AI，
  // 只在 1 个模型里出现，和 3 个模型里都出现，是完全不同的处境。
  const engineIds = [...new Set(samples.map((s) => s.engine).filter(Boolean))];
  const coveredBy = new Map(entities.map((e) => [e.id, new Set()]));
  for (const s of samples) {
    if (!s.engine) continue;
    for (const m of s.mentions ?? []) {
      if (coveredBy.has(m.entityId)) coveredBy.get(m.entityId).add(s.engine);
    }
  }

  const rows = entities.map((e) => {
    const m = metrics.get(e.id);
    const s = h2h.scores.get(e.id);
    const ars = computeARS(m, w);
    const wr = s.meanWinRate;
    return {
      entityId: e.id,
      name: e.name,
      ars: ars === null ? null : Number(ars.toFixed(2)),
      arsCi95: [ars, ars],
      meanWinRate: wr === null ? null : Number(wr.toFixed(2)),
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pairWinRate: s.pairWinRate,
      opponents: s.opponents,
      // 跨通道覆盖率：被几个采样通道提到 / 总通道数
      engineCoverage: engineIds.length
        ? (coveredBy.get(e.id)?.size ?? 0) / engineIds.length
        : null,
      coveredEngines: [...(coveredBy.get(e.id) ?? [])],
      engineCount: engineIds.length,
      // 并列判定的区间：优先用平均击败率的 CI（这是主排序依据）
      ci95: wr === null ? [ars ?? 0, ars ?? 0] : [wr, wr],
      metrics: m,
      objectiveRank: Number.isFinite(e.objectiveRank) ? e.objectiveRank : null,
      recognitionGap: null,
    };
  });

  // Bootstrap：对整条回答有放回重采样，同时得到 ARS 与平均击败率的不确定性
  if (iterations > 1 && totalSamples > 1) {
    const rng = mulberry32(seed);
    const arsDraws = new Map(entities.map((e) => [e.id, []]));
    const wrDraws = new Map(entities.map((e) => [e.id, []]));
    for (let b = 0; b < iterations; b++) {
      const idx = bootstrapIndices(rng, totalSamples);
      const resampled = idx.map((i) => samples[i]);
      const { metrics: mBoot } = computeMetrics(resampled, entities, { topK });
      for (const e of entities) {
        const a = computeARS(mBoot.get(e.id), w);
        if (a !== null) arsDraws.get(e.id).push(a);
      }
      const hBoot = headToHead(resampled, entities);
      for (const e of entities) {
        const v = hBoot.scores.get(e.id).meanWinRate;
        if (v !== null) wrDraws.get(e.id).push(v);
      }
    }
    for (const r of rows) {
      const aArr = arsDraws.get(r.entityId).sort((x, y) => x - y);
      if (aArr.length) {
        r.arsCi95 = [Number(quantile(aArr, CI_LO).toFixed(2)), Number(quantile(aArr, CI_HI).toFixed(2))];
      }
      const wArr = wrDraws.get(r.entityId).sort((x, y) => x - y);
      if (wArr.length) {
        r.ci95 = [Number(quantile(wArr, CI_LO).toFixed(2)), Number(quantile(wArr, CI_HI).toFixed(2))];
      }
    }
  }

  sortRows(rows);
  assignBands(rows);

  for (const r of rows) {
    if (r.objectiveRank) {
      // 正数＝客观实力比 AI 认知更强，即"被 AI 低估"（黑榜候补）
      r.recognitionGap = r.objectiveRank - r.position;
    }
  }

  const meta = {
    methodologyVersion: METHODOLOGY_VERSION,
    fingerprint: methodologyFingerprint({ weights: w, topK }),
    alpha,
    minReportableN,
    anchors: NORMALIZATION_ANCHORS,
    totalSamples,
    allMentions,
    entities: entities.length,
    weights: w,
    topK,
    bootstrapIterations: iterations,
    seed,
    engines: [...new Set(samples.map((s) => s.engine).filter(Boolean))],
    regions: [...new Set(samples.map((s) => s.region).filter(Boolean))],
    prompts: [...new Set(samples.map((s) => s.promptId).filter(Boolean))],
    reportable: totalSamples >= minReportableN,
  };

  return {
    rows,
    meta,
    byEngine: groupView(samples, entities, 'engine', w, topK),
    byRegion: groupView(samples, entities, 'region', w, topK),
  };
}
