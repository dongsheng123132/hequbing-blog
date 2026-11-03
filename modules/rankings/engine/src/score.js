/**
 * 综合分合成：AI Recognition Score (ARS)。
 *
 * 权重是先验设定、公开、可被榜单配置覆盖，但**不做数据拟合**。
 * 理由：拟合出来的权重会被合理质疑成"为某品牌调参"，而先验权重不随参赛者变动。
 */
import { SCORE_INPUTS } from './metrics.js';

export const DEFAULT_WEIGHTS = Object.freeze({
  mentionRate: 0.35,
  rankScore: 0.3,
  top1Rate: 0.1,
  soV: 0.1,
  stability: 0.1,
  sentiment: 0.05,
});

export function normalizeWeights(weights) {
  const w = { ...DEFAULT_WEIGHTS, ...(weights ?? {}) };
  let sum = 0;
  for (const k of SCORE_INPUTS) {
    const v = Number(w[k]);
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`权重 ${k} 非法：${weights?.[k]}`);
    }
    sum += v;
  }
  if (sum <= 0) throw new Error('权重总和必须大于 0');
  const out = {};
  for (const k of SCORE_INPUTS) out[k] = Number(w[k]) / sum;
  return out;
}

/** 幻觉率是负向指标：作为扣分项，不参与权重归一化。 */
export function hallucinationPenalty(hallucinationRate, maxPenalty = 0.1) {
  if (!Number.isFinite(hallucinationRate) || hallucinationRate <= 0) return 0;
  return Math.min(maxPenalty, hallucinationRate * maxPenalty);
}

/**
 * @param {ReturnType<import('./metrics.js').computeMetrics>['metrics'] extends Map<string,infer T> ? T : never} m 单实体指标
 * @param {Record<string,number>} weights 已归一化权重
 * @param {{hallucinationMaxPenalty?:number}} [opts]
 * @returns {number} 0–100
 */
export function computeARS(m, weights = DEFAULT_WEIGHTS, opts = {}) {
  // 缺分量 ⇒ 无法评分 ⇒ 返回 null。绝不把 null 当 0 参与加总：
  // "没测过"和"测了但表现最差"是两回事。
  if (!m) return null;
  const w = normalizeWeights(weights);
  let s = 0;
  for (const k of SCORE_INPUTS) {
    const v = m[k];
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    s += w[k] * v;
  }
  s -= hallucinationPenalty(m.hallucinationRate, opts.hallucinationMaxPenalty ?? 0.1);
  return Math.max(0, Math.min(1, s)) * 100;
}
