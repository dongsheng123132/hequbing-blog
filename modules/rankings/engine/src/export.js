/**
 * 开放数据导出。
 *
 * 为什么要有这一层：
 *  1. "可复算"不能只是口号 —— 订阅方应当能程序化拿到榜单的完整数字与参数。
 *  2. "数据订阅"是本项目的收费点之一，它需要一个稳定、带版本的机器可读格式。
 *
 * 公开什么、不公开什么（这是商业与合规的平衡点）：
 *  - **公开**：聚合后的名次与全部指标、置信区间、权重、方法论版本与指纹、
 *    采样参数（通道、地域、样本量、次数、随机种子）、每条结论对应的样本条数。
 *  - **不公开**：AI 原始回答全文。它是核心资产，也是争议时向监管与媒体提交的证据，
 *    不宜默认开放。榜单页提供"每条结论可回溯到一条原始回答"的承诺，
 *    争议时按需提交，而不是把语料免费送出去。
 */
import { METHODOLOGY_VERSION } from './methodology.js';

export const SCHEMA_VERSION = '1.0';

const num = (x) => (x === null || x === undefined ? null : Number(Number(x).toFixed(4)));

/** 把一行榜单结果转成公开结构（剔除内部字段，数字统一精度）。 */
function publicRow(r) {
  const m = r.metrics ?? {};
  return {
    position: r.position,
    // band 非 null 表示与同区间内的名次统计上不可区分
    band: r.band ?? null,
    entityId: r.entityId,
    name: r.name,
    meanWinRate: num(r.meanWinRate),
    winRateCi95: r.ci95 ?? null,
    wins: r.wins,
    losses: r.losses,
    ties: r.ties,
    ars: num(r.ars),
    arsCi95: r.arsCi95 ?? null,
    objectiveRank: r.objectiveRank ?? null,
    recognitionGap: r.recognitionGap ?? null,
    metrics: {
      samples: m.samples ?? null,
      mentionSamples: m.mentionSamples ?? null,
      mentionRate: num(m.mentionRate),
      cavLowerBound: num(m.cav),
      rankScore: num(m.rankScore),
      avgRank: num(m.avgRank),
      avgRankDenominator: m.avgRankDenominator ?? null,
      top1Rate: num(m.top1Rate),
      soV: num(m.soV),
      stability: num(m.stability),
      sentiment: num(m.sentiment),
      hallucinationRate: num(m.hallucinationRate),
      reportable: m.reportable ?? null,
    },
  };
}

function publicView(view) {
  if (!view) return null;
  const out = {};
  for (const [k, v] of Object.entries(view)) {
    out[k] = {
      sampleCount: v.sampleCount,
      rows: v.rows.map((r) => ({
        position: r.position,
        entityId: r.entityId,
        name: r.name,
        ars: num(r.ars),
        mentionRate: num(r.metrics?.mentionRate),
      })),
    };
  }
  return out;
}

/**
 * @param {object} p
 * @param {object} p.consortium
 * @param {ReturnType<import('./index.js').buildLeaderboard>} p.lb
 */
export function toPublicJson({ consortium, lb }) {
  const meta = lb.meta;
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    consortium: {
      id: consortium.id,
      title: consortium.title,
      category: consortium.category ?? null,
      groupBy: consortium.groupBy ?? null,
      typeLabels: consortium.typeLabels ?? null,
    },
    // 采样来源：让订阅方能判断这份数据是在什么条件下产生的
    provenance: {
      sampleCount: meta.totalSamples,
      totalMentions: meta.allMentions,
      entityCount: meta.entities,
      promptCount: meta.prompts.length,
      engines: meta.engines,
      regions: meta.regions,
      bootstrapIterations: meta.bootstrapIterations,
      seed: meta.seed,
      reportable: meta.reportable,
    },
    methodology: {
      version: meta.methodologyVersion ?? METHODOLOGY_VERSION,
      fingerprint: meta.fingerprint,
      rankingBasis: 'pairwise-win-rate',
      weights: meta.weights,
      alpha: meta.alpha,
      minReportableN: meta.minReportableN,
      // 明确写死，避免下游把"没测过"当成"表现差"
      nullPolicy: {
        notMentioned: 0,
        failedSample: 'excluded-from-denominator',
        zeroDenominator: null,
        sentimentWhenAbsent: 0,
      },
    },
    rows: lb.rows.map(publicRow),
    groups: lb.groups
      ? Object.fromEntries(Object.entries(lb.groups).map(([k, g]) => [k, { rows: g.rows.map(publicRow) }]))
      : null,
    byEngine: publicView(lb.byEngine),
    byRegion: publicView(lb.byRegion),
    disclaimer:
      '排名由公开方法论的实测回答生成，不售卖名次。置信区间重叠的名次统计上不可区分。' +
      '原始 AI 回答未随本文件公开；如需核验，请依据 methodology.fingerprint 与 provenance 参数申请复核。',
  };
}

/** 站点级索引：列出所有可订阅的数据集。 */
export function toPublicIndex({ siteName, boards }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    siteName,
    generatedAt: new Date().toISOString(),
    datasets: boards.map((b) => ({
      id: b.id,
      title: b.title,
      url: b.dataUrl ?? `data/${b.id}.json`,
      pageUrl: b.href,
      ...(b.status ? { status: b.status, issue: b.issue, reportable: b.reportable } : {}),
      sampleCount: b.sampleCount,
      entityCount: b.entityCount,
      engines: b.engines,
      regions: b.regions,
      isSynthetic: b.isSynthetic,
    })),
  };
}
