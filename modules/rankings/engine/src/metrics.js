/**
 * 指标计算：从已解析样本得到实体级指标。
 *
 * 核心约定：
 *  - **未提及 = 0 分**。AI 没提到你，不是"信息缺失"，是这条渠道上你不存在。
 *    所有指标的分母都是"全部有效样本"，而不是"提到你的样本"，
 *    否则小品牌会靠偶尔一次高排名刷出虚高分。
 *  - **没测过 ≠ 表现差**。分母为 0 时返回 null，绝不返回 0。
 *    采样失败必须剔除出分母，不能算作品牌缺席。
 *  - 对外发布提及率时用 Jeffreys 后验下界（CAV），防止"3 次采样全中 = 100%"这种虚高。
 */
import { jeffreysLowerBound } from './beta.js';
import { MIN_REPORTABLE_N, SCORING_ALPHA } from './methodology.js';

/** 单样本位次分：N 个实体的回答里排第 r 位。 */
export function orderScore(order, n) {
  if (!Number.isFinite(order) || order < 1 || n < 1) return 0;
  return Math.max(0, (n - order + 1) / n);
}

/** 比例型指标统一口径：分母为 0 时返回 null，绝不返回 0。 */
export function ratio(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

/**
 * 把样本内的提及整理成 1..n 的真实序位。
 *
 * 关键语义：**同一编号项下的多个实体是并列的，不是依次相接。**
 * 解析器对同一编号项内的多个实体给出 1 / 1.001 / 1.002 这样的 rank，
 * 用 Math.floor 归组后它们共享同一个序位。否则
 * "### 1. 大型连锁机构 / - 新东方 / - 金吉列 / - 启德"
 * 会被算成第 1、2、3 名 —— 而它们其实是并列举例。
 */
export function normalizeOrder(mentions) {
  const sorted = [...mentions].sort(
    (a, b) => a.rank - b.rank || (a.start ?? 0) - (b.start ?? 0) || (a.entityId < b.entityId ? -1 : 1),
  );
  const groups = new Map();
  for (const m of sorted) {
    const key = Math.floor(m.rank);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const out = [];
  let order = 0;
  for (const key of [...groups.keys()].sort((a, b) => a - b)) {
    order++;
    for (const m of groups.get(key)) out.push({ ...m, order });
  }
  return out;
}

function emptyAcc() {
  return {
    mentionSamples: 0,
    top1Samples: 0,
    orderScoreSum: 0,
    avgRankSum: 0,
    avgRankCount: 0,
    mentionCount: 0,
    pos: 0,
    neg: 0,
    hallucinationSamples: 0,
    promptsSeen: new Set(),
  };
}

/**
 * @param {Array<{sampleId:string,promptId:string,engine?:string,region?:string,mentions:Array}>} samples
 *   只应传入**有效样本**（采样失败的行必须在入口剔除，不能流到这里）
 * @param {Array<{id:string,name:string}>} entities
 * @param {{topK?:number, alpha?:number, minReportableN?:number}} [opts]
 */
export function computeMetrics(samples, entities, opts = {}) {
  const topK = opts.topK ?? 10;
  const alpha = opts.alpha ?? SCORING_ALPHA;
  const minN = opts.minReportableN ?? MIN_REPORTABLE_N;
  const total = samples.length;
  const acc = new Map(entities.map((e) => [e.id, emptyAcc()]));
  let allMentions = 0;

  // 稳定性按 **intent** 分组，而不是按 promptId。
  // 同一意图下的多条改写共同回答"换一种问法答案会不会变"——实测这个方差
  // 比重复问同一题的方差更大，只按 promptId 分组会系统性低估不确定性。
  const byIntent = new Map();
  for (const s of samples) {
    const key = s.intent ?? s.promptId;
    if (!byIntent.has(key)) byIntent.set(key, []);
    byIntent.get(key).push(s);
  }

  for (const s of samples) {
    const mentions = normalizeOrder(s.mentions ?? []);
    const n = mentions.length;
    for (const m of mentions) {
      const a = acc.get(m.entityId);
      if (!a) continue; // 回答里出现了别名表之外的实体，不计入榜单
      allMentions++;
      a.mentionCount++;
      a.promptsSeen.add(s.promptId);
      if (m.sentiment > 0) a.pos++;
      else if (m.sentiment < 0) a.neg++;
      if (m.hallucinated) a.hallucinationSamples++;
    }
    const seen = new Set();
    for (const m of mentions) {
      const a = acc.get(m.entityId);
      if (!a || seen.has(m.entityId)) continue;
      seen.add(m.entityId);
      a.mentionSamples++;
      // 举例（"代表：A、B、C"）说明 AI 认识这个实体，是真实的提及；
      // 但它不构成"推荐位次"，因此不计入位次分、首位率与平均位次。
      if (m.enumeration) continue;
      a.orderScoreSum += orderScore(m.order, n);
      a.avgRankSum += m.order;
      a.avgRankCount++;
      if (m.order === 1) a.top1Samples++;
    }
  }

  // 稳定性：同一 prompt 在 K 次重复里，该实体是否稳定进入 Top-K
  const stabilityAcc = new Map(entities.map((e) => [e.id, []]));
  for (const [, group] of byIntent) {
    if (group.length < 2) continue;
    for (const e of entities) {
      let hit = 0;
      for (const s of group) {
        const mentions = normalizeOrder(s.mentions ?? []);
        const m = mentions.find((x) => x.entityId === e.id);
        if (m && m.order <= topK) hit++;
      }
      const p = hit / group.length;
      // p=1（稳定上榜）与 p=0（稳定不上榜）都是一致的认知；
      // 但 p=0 说明这个实体在这条渠道上根本不存在，稳定性记 0 分而不是满分。
      stabilityAcc.get(e.id).push(p === 0 ? 0 : 1 - 4 * p * (1 - p));
    }
  }

  const out = new Map();
  for (const e of entities) {
    const a = acc.get(e.id);
    const stabs = stabilityAcc.get(e.id);
    const stability = stabs.length ? stabs.reduce((x, y) => x + y, 0) / stabs.length : (total > 0 ? 0 : null);
    const sentRaw = a.mentionCount ? (a.pos - a.neg) / a.mentionCount : null; // [-1,1]；无提及为 null
    // 未被提及的实体情感分必须是 0，不能把"中性"映射成 0.5 白送分，
    // 否则"AI 完全不认识你"反而比"被批评"得分高。
    const sentiment = sentRaw === null ? (total > 0 ? 0 : null) : (sentRaw + 1) / 2;
    out.set(e.id, {
      entityId: e.id,
      name: e.name,
      samples: total,
      mentionSamples: a.mentionSamples,
      mentionCount: a.mentionCount,
      promptCoverage: a.promptsSeen.size,
      // 分母是全部有效样本（含未提及），因此"未提及"自然得 0
      mentionRate: ratio(a.mentionSamples, total),
      top1Rate: ratio(a.top1Samples, total),
      rankScore: ratio(a.orderScoreSum, total),
      soV: ratio(a.mentionCount, allMentions),
      stability,
      sentiment,
      sentimentRaw: sentRaw,
      // 平均位次：分母只含"位次可计算"的样本（已排除举例类提及），并单独报告该分母
      avgRank: ratio(a.avgRankSum, a.avgRankCount),
      avgRankDenominator: a.avgRankCount,
      hallucinationRate: ratio(a.hallucinationSamples, a.mentionSamples),
      // 置信调整可见度：小样本自动打折，对外发布用这个而不是 mentionRate
      cav: jeffreysLowerBound(a.mentionSamples, total, alpha),
      reportable: total >= minN,
    });
  }
  return { metrics: out, totalSamples: total, allMentions };
}

/** 只保留参与合成分数的指标（含负向项）。 */
export const SCORE_INPUTS = Object.freeze([
  'mentionRate',
  'rankScore',
  'top1Rate',
  'soV',
  'stability',
  'sentiment',
]);
