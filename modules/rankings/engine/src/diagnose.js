/**
 * 单品牌诊断：回答"AI 到底怎么看你"。
 *
 * 榜单是获客，诊断才是收钱的产品。诊断的交付物不是"你排第几"（那是名次，不能卖），
 * 而是**可执行的缺口**：哪些问题提到了竞品却没提到你、在哪个通道掉队、
 * AI 有没有把你认错。这些都不涉及名次承诺，因此不触碰合规红线。
 *
 * 设计约束：报告里只出现"AI 这样回答"与"缺口在哪"，绝不出现"我们能让你升到第几"。
 */
import { computeMetrics, normalizeOrder } from './metrics.js';

/**
 * 缺口判定的**绝对下限**：提及率低于此值，无论同赛道最高多少，都算缺口。
 *
 * 实际阈值是动态的：`max(GAP_FLOOR, 同赛道最高提及率 × 0.5)`。
 * 用固定阈值（比如一律 50%）会出问题：在一个 AI 整体认知都很低的品类里，
 * 所有机构都会被判成"缺口"，指标失去区分度。
 */
export const GAP_FLOOR = 0.2;

function accum(map, key, hit) {
  if (!key) return;
  if (!map.has(key)) map.set(key, { total: 0, hit: 0, rankSum: 0 });
  const o = map.get(key);
  o.total++;
  if (hit) {
    o.hit++;
    o.rankSum += hit.order;
  }
}

function toRows(map, labelKey) {
  return [...map.entries()]
    .map(([key, o]) => ({
      [labelKey]: key,
      total: o.total,
      mentioned: o.hit,
      mentionRate: o.total ? o.hit / o.total : null,
      avgRank: o.hit ? o.rankSum / o.hit : null,
    }))
    .sort((a, b) => (b.mentionRate ?? -1) - (a.mentionRate ?? -1) || String(a[labelKey]).localeCompare(String(b[labelKey])));
}

/**
 * @param {object} p
 * @param {Array} p.samples 已解析样本（含 mentions）
 * @param {Array} p.entities
 * @param {string} p.entityId 要诊断的品牌
 * @param {number} [p.topK]
 */
export function diagnoseEntity({ samples, entities, entityId, topK = 10, rankingOnly = false, prompts }) {
  const target = entities.find((e) => e.id === entityId);
  if (!target) throw new Error(`未知实体：${entityId}`);

  // 与榜单口径保持一致：只用"要求推荐/对比"的问题。否则"AI 在方法论问题上不给名单"
  // 会被算成这家机构认知度低，报告结论就会失真。
  const rankingPromptIds = new Set(
    (prompts ?? []).filter((p) => (p.purpose ?? 'ranking') === 'ranking').map((p) => p.id),
  );
  const useSamples = rankingOnly
    ? samples.filter((s) => (s.purpose ? s.purpose === 'ranking' : rankingPromptIds.has(s.promptId)))
    : samples;

  const { metrics } = computeMetrics(useSamples, entities, { topK });
  const mine = metrics.get(entityId);

  const byPrompt = new Map();
  const byEngine = new Map();
  const byRegion = new Map();
  const hallucinationSamples = [];

  // 每个 prompt 下"竞品被推荐"的频次，用于回答"这个问题上 AI 推荐了谁"
  const promptText = new Map();
  const competitorByPrompt = new Map();

  for (const s of useSamples) {
    const mentions = normalizeOrder(s.mentions ?? []);
    const me = mentions.find((m) => m.entityId === entityId);
    const others = mentions.filter((m) => m.entityId !== entityId);

    if (s.prompt && !promptText.has(s.promptId)) promptText.set(s.promptId, s.prompt);
    if (!competitorByPrompt.has(s.promptId)) competitorByPrompt.set(s.promptId, new Map());
    const cmap = competitorByPrompt.get(s.promptId);
    for (const o of others) cmap.set(o.entityId, (cmap.get(o.entityId) ?? 0) + 1);

    accum(byPrompt, s.promptId, me);
    accum(byEngine, s.engine, me);
    accum(byRegion, s.region, me);

    if (me && me.hallucinated) {
      hallucinationSamples.push({
        sampleId: s.sampleId,
        promptId: s.promptId,
        engine: s.engine,
        region: s.region,
        evidence: me.evidence,
      });
    }
  }

  const nameOf = new Map(entities.map((e) => [e.id, e.name]));

  // 跨通道覆盖率：这个实体在几个 AI 里被提到过。
  // 这是诊断报告里最有行动力的一条 —— "只在 1 个模型里存在"意味着
  // 用户换一个 AI 就找不到你，而这通常是可以修的。
  const engineIds = [...new Set(useSamples.map((s) => s.engine).filter(Boolean))];
  const myEngines = new Set();
  for (const s of useSamples) {
    if (!s.engine) continue;
    if ((s.mentions ?? []).some((m) => m.entityId === entityId)) myEngines.add(s.engine);
  }
  const missingEngines = engineIds.filter((e) => !myEngines.has(e));

  // 动态缺口阈值：同赛道最高提及率的一半，但不低于绝对下限
  const bestMentionRate = Math.max(0, ...[...metrics.values()].map((m) => m.mentionRate ?? 0));
  const gapThreshold = Math.max(GAP_FLOOR, bestMentionRate * 0.5);

  const promptRows = toRows(byPrompt, 'promptId').map((r) => {
    const cmap = competitorByPrompt.get(r.promptId) ?? new Map();
    const rivals = [...cmap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ entityId: id, name: nameOf.get(id) ?? id, count }));
    return {
      ...r,
      prompt: promptText.get(r.promptId) ?? '',
      rivals,
      // 缺口：AI 推荐了别人，而你缺席或严重不足 —— 这是最有行动力的信息
      isGap: r.mentionRate !== null && r.mentionRate < gapThreshold && rivals.length > 0,
      severity:
        r.mentionRate === null
          ? 'unknown'
          : r.mentionRate === 0
            ? 'absent'
            : r.mentionRate < gapThreshold
              ? 'severe'
              : r.mentionRate < 1
                ? 'weak'
                : 'solid',
    };
  });

  const gaps = promptRows.filter((r) => r.isGap);
  const strengths = promptRows.filter((r) => r.mentionRate === 1);
  // 提到你、但排得靠后的场景，是最容易改的
  const weak = promptRows
    .filter((r) => r.mentionRate > 0 && r.mentionRate < 1)
    .sort((a, b) => a.mentionRate - b.mentionRate);

  const engineRows = toRows(byEngine, 'engine');
  const regionRows = toRows(byRegion, 'region');
  const rateOf = (rows) => rows.map((r) => r.mentionRate ?? 0);
  const spread = (rows) => {
    const v = rateOf(rows);
    return v.length ? Math.max(...v) - Math.min(...v) : 0;
  };

  const result = {
    entity: { id: target.id, name: target.name },
    metrics: mine,
    sampleCount: useSamples.length,
    // 透明化：让报告读者知道"缺口"是按什么阈值判出来的
    gapThreshold,
    bestMentionRate,
    promptRows,
    gaps,
    strengths,
    weak,
    byEngine: engineRows,
    byRegion: regionRows,
    engineSpread: spread(engineRows),
    regionSpread: spread(regionRows),
    // AI 认错的部分（"认错了谁"）
    hallucinations: hallucinationSamples,
    // 跨通道覆盖
    engineIds,
    coveredEngines: [...myEngines],
    missingEngines,
    // 一句话结论，直接可用于报告开头
    headline: buildHeadline(
      target.name,
      mine,
      gaps.length,
      promptRows.length,
      engineRows,
      regionRows,
      bestMentionRate,
      { engineIds, coveredEngines: [...myEngines], missingEngines },
    ),
  };
  result.advice = buildAdvice(result);
  return result;
}

/**
 * 生成修复建议。
 *
 * 措辞红线：只讲"信息补齐"与"口径统一"，**绝不出现任何名次承诺**。
 * 这是"诊断/修复"这条业务线与"卖榜"在法律上能否分开的关键。
 */
export function buildAdvice(d) {
  const out = [];
  if (d.gaps.length) {
    out.push({
      title: '补齐"AI 推荐了同行却没提你"的场景',
      why: `有 ${d.gaps.length} 类问题，AI 会推荐同行但完全不提你。`,
      how: '这类问题通常对应某个具体的决策场景（预算、成绩段、专业方向）。需要在这些场景下，让可被公开引用的信息里出现你的名字——而不是只在自己的官网上说自己好。',
      noPromise: '不承诺名次变化；只做信息补齐，名次由 AI 自己决定。',
    });
  }
  if (d.weak.length) {
    out.push({
      title: '把"时有时无"变成"稳定出现"',
      why: `有 ${d.weak.length} 类问题里你只是偶尔被提到，说明 AI 对你在这个场景下的认知还不稳定。`,
      how: '不稳定通常意味着信息零散、口径不一致。先把对同一件事的说法统一（成立时间、服务范围、资质），再补公开来源。',
      noPromise: '不承诺名次变化。',
    });
  }
  if (d.engineSpread >= 0.2 || d.regionSpread >= 0.2) {
    const parts = [];
    if (d.engineSpread >= 0.2) parts.push(`不同 AI 之间提及率相差 ${(d.engineSpread * 100).toFixed(0)} 个百分点`);
    if (d.regionSpread >= 0.2) parts.push(`不同地区之间相差 ${(d.regionSpread * 100).toFixed(0)} 个百分点`);
    out.push({
      title: '处理通道与地域落差',
      why: `${parts.join('，')}。`,
      how: '不同 AI 的答案来自不同的语料来源，地区差异往往来自语言与本地信息覆盖。先定位你掉队的那个通道，去看它引用的是哪些来源，再针对性地让信息出现在那些来源上。',
      noPromise: '不承诺名次变化。',
    });
  }
  if (d.hallucinations.length) {
    out.push({
      title: '纠正 AI 对你的错误描述',
      why: `在 ${d.hallucinations.length} 条回答里，AI 对你出现了事实性描述错误。`,
      how: '错误描述会长期影响判断。需要把正确的事实做成结构化、可被引用的公开信息，让 AI 下次能取到正确版本。',
      noPromise: '纠错不等于排名上升。',
    });
  }
  if (!out.length) {
    out.push({
      title: '维持现状并建立长期监测',
      why: '当前没有发现明显缺口。',
      how: 'AI 的认知会随语料变化而漂移，建议按月复测，把波动当风险预警而不是等出问题再补。',
      noPromise: '不承诺名次变化。',
    });
  }
  return out;
}

function buildHeadline(name, m, gapCount, promptCount, engineRows, regionRows, bestMentionRate = 0, coverage = null) {
  if (!m || m.mentionRate === null) return `样本不足，无法评估 ${name} 的 AI 认知状况。`;
  const parts = [];
  // 提及率为 0 时用"一次都没提到"，否则"0% 的场景提到了你"+"N 类问题看不到你"读起来自相矛盾
  if (m.mentionSamples === 0) {
    parts.push(`在 ${m.samples} 条有效回答中，AI **一次都没有提到**「${name}」。`);
  } else {
    parts.push(`在 ${m.samples} 条有效回答中，AI 有 ${(m.mentionRate * 100).toFixed(0)}% 的场景提到了「${name}」。`);
  }
  if (gapCount > 0) {
    parts.push(`有 ${gapCount}/${promptCount} 类问题，AI 明确推荐了同行却没有你——这是最直接的认知缺口。`);
  } else if (m.mentionSamples > 0) {
    parts.push(`所有 ${promptCount} 类问题里 AI 都提到了你，覆盖面完整。`);
  } else {
    parts.push(`其余问题 AI 没有给出任何机构名单。`);
  }
  // 防止误读：在 AI 整体认知都低的赛道里，即使相对名次靠前，绝对提及率也可能很低。
  // 不解释这一点，客户会看到"榜单第 2 名"和"13 个问题缺席"并认为自相矛盾。
  if (bestMentionRate > 0 && bestMentionRate < 0.6) {
    parts.push(
      `需要说明：本赛道里 AI 提及率最高的机构也只有 ${(bestMentionRate * 100).toFixed(0)}%，` +
        `说明这类信息整体在 AI 语料里覆盖不足，这不是你一家的问题。`,
    );
  }
  // 跨模型落差：这是最有行动力的一条 —— 换一个 AI 就找不到你，通常是可以修的
  if (coverage && coverage.engineIds.length > 1 && coverage.coveredEngines.length < coverage.engineIds.length) {
    const miss = coverage.missingEngines;
    parts.push(
      `在 ${coverage.engineIds.length} 个被测 AI 中，只有 ${coverage.coveredEngines.length} 个会推荐你` +
        (miss.length ? `（${miss.join('、')} 完全没有提到）` : '') +
        `。这意味着用户换一个 AI 就找不到你——这通常与语料来源有关，是可以处理的。`,
    );
  }
  if (engineRows.length > 1) {
    const hi = engineRows[0];
    const lo = engineRows[engineRows.length - 1];
    if (hi && lo && hi.mentionRate !== null && lo.mentionRate !== null && hi.mentionRate - lo.mentionRate >= 0.2) {
      parts.push(`不同 AI 的差别很大：${hi.engine} 有 ${(hi.mentionRate * 100).toFixed(0)}%，${lo.engine} 只有 ${(lo.mentionRate * 100).toFixed(0)}%。`);
    }
  }
  if (regionRows.length > 1) {
    const hi = regionRows[0];
    const lo = regionRows[regionRows.length - 1];
    if (hi && lo && hi.mentionRate !== null && lo.mentionRate !== null && hi.mentionRate - lo.mentionRate >= 0.2) {
      parts.push(`地区之间也有落差：${hi.region} ${(hi.mentionRate * 100).toFixed(0)}%，${lo.region} ${(lo.mentionRate * 100).toFixed(0)}%。`);
    }
  }
  return parts.join('');
}
