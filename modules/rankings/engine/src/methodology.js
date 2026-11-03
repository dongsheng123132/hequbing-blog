/**
 * 方法论版本与冻结常量。
 *
 * 存在的理由：任何一份对外发布的榜单，都必须能回答"你是用哪一版方法算出来的"。
 * 权重、null 策略、显著性水平、最小可发布样本量、归一化锚点一旦变动，
 * 历史榜单就不再可比 —— 所以它们必须版本化，且**绝不按当批数据动态重算**。
 * 一旦按本批数据重算 min-max，名次就变成可以被人为操纵的东西。
 */
import { hashSeed } from './rng.js';

export const METHODOLOGY_VERSION = '0.2.1';

/** 空值策略：显式写死，避免实现漂移。 */
export const NULL_POLICY = Object.freeze({
  notMentioned: '0（未提及确实是零次提及，不是缺失）',
  failedSample: 'exclude（采样失败必须剔除出分母，绝不能算作品牌缺席）',
  zeroDenominator: 'null（分母为 0 时返回 null，而不是 0）',
  sentimentWhenAbsent: '0（不被提及时情感分必须为 0，不能白送中性值 0.5）',
});

/** 显著性水平与最小可发布样本量。 */
export const SCORING_ALPHA = 0.05;
export const MIN_REPORTABLE_N = 5;

/**
 * 归一化锚点：冻结的语义常量，不随数据变动。
 */
export const NORMALIZATION_ANCHORS = Object.freeze({
  // 位次分的分母是"该条回答里出现的实体数"，不是榜单实体总数。
  // 用后者会让"回答只提了 3 个品牌"和"回答提了 20 个品牌"失去区别。
  rankScoreDenominator: 'entities-mentioned-in-that-single-answer',
  topK: 10,
  sentimentRange: [0, 1],
  arsRange: [0, 100],
});

/** 生成方法论指纹：方法或参数一变，指纹就变，榜单页面据此标注版本。 */
export function methodologyFingerprint(parts = {}) {
  const payload = JSON.stringify({
    version: METHODOLOGY_VERSION,
    anchors: NORMALIZATION_ANCHORS,
    nullPolicy: NULL_POLICY,
    alpha: SCORING_ALPHA,
    minReportableN: MIN_REPORTABLE_N,
    ...parts,
  });
  return hashSeed(payload).toString(16).padStart(8, '0');
}
