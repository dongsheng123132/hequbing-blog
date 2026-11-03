/**
 * 采样健康度检查。
 *
 * 用途：真实采样一跑完立刻回答一个问题 —— **这批数据能不能用**。
 * 在拿到排名之前，必须先排掉这些坑：
 *   - 某个通道大面积失败（排名会变成"谁家 API 稳定"而不是"谁被 AI 认识"）
 *   - 大量回答解析不出任何实体（说明解析器不适配这家模型的回答格式）
 *   - 回答过短（模型拒答/截断，这种样本计入分母会把所有人拉平）
 *   - 形态分布与解析器假设不符（比如全是用表格回答）
 *
 * 这个检查器不产生名次，只产生"能不能往下走"的判断。
 */

/** 回答短于此长度视为可疑（拒答、截断、或只有一句"建议实地考察"）。 */
export const MIN_USABLE_CHARS = 40;

function stats(nums) {
  if (!nums.length) return { n: 0, min: null, max: null, mean: null, median: null };
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return {
    n: s.length,
    min: s[0],
    max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length,
    median: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2,
  };
}

/**
 * @param {object} p
 * @param {Array} p.rawSamples 原始样本（可能含 error 字段）
 * @param {Array} p.parsedSamples 已解析样本（含 mentions）
 * @param {number} [p.minUsableChars]
 * @param {Map<string,{expectsMention?:boolean}>} [p.promptMeta]
 *   榜单配置里的 Prompt 表。样本自身没带 expectsMention 时（例如早期样本或外部数据），
 *   用它的 promptId 回来查，避免把"本就不点名机构的问题"误判成解析故障。
 */
export function checkHealth({ rawSamples, parsedSamples, minUsableChars = MIN_USABLE_CHARS, promptMeta }) {
  const total = rawSamples.length;
  const failedRows = rawSamples.filter((s) => s.error || typeof s.raw !== 'string');
  const validRows = rawSamples.filter((s) => !s.error && typeof s.raw === 'string');

  const byEngine = new Map();
  const byRegion = new Map();
  const bump = (map, key, ok) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, { total: 0, ok: 0 });
    const o = map.get(key);
    o.total++;
    if (ok) o.ok++;
  };
  for (const s of rawSamples) {
    const ok = !s.error && typeof s.raw === 'string';
    bump(byEngine, s.engine, ok);
    bump(byRegion, s.region, ok);
  }
  const rateTable = (map) =>
    [...map.entries()]
      .map(([k, v]) => ({ key: k, total: v.total, ok: v.ok, successRate: v.total ? v.ok / v.total : null }))
      .sort((a, b) => (a.successRate ?? 0) - (b.successRate ?? 0));

  // 解析层面的健康度
  const parsed = parsedSamples ?? [];
  const mentionCounts = [];
  const shapes = new Map();
  let zeroMention = 0;
  let shortAnswers = 0;
  const zeroMentionSamples = [];
  const shortSampleIds = [];

  // 原始回答长度（按样本 id 对齐）
  const rawById = new Map(validRows.map((s) => [s.sampleId, s.raw]));
  const lengths = [];

  for (const s of parsed) {
    const n = (s.mentions ?? []).length;
    mentionCounts.push(n);
    if (n === 0) {
      zeroMention++;
      if (zeroMentionSamples.length < 10) zeroMentionSamples.push(s.sampleId);
    }
    const shape = s.mentions?.[0]?.shape ?? 'none';
    shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
    const raw = rawById.get(s.sampleId);
    if (typeof raw === 'string') {
      lengths.push(raw.length);
      if (raw.length < minUsableChars) {
        shortAnswers++;
        if (shortSampleIds.length < 10) shortSampleIds.push(s.sampleId);
      }
    }
  }

  // 每个意图下的样本数：太少会导致稳定性指标没有意义
  // 同时区分"应当点名机构"与"本就不点名机构"的意图 —— 后者零命中是正确答案，不是故障
  const byIntent = new Map();
  for (const s of parsed) {
    const k = s.intent ?? s.promptId;
    const expects =
      s.expectsMention ?? promptMeta?.get?.(s.promptId)?.expectsMention ?? true;
    if (!byIntent.has(k)) {
      byIntent.set(k, { total: 0, zero: 0, withMentions: 0, expectsMention: expects !== false });
    }
    const o = byIntent.get(k);
    o.total++;
    if ((s.mentions ?? []).length === 0) o.zero++;
    else o.withMentions++;
  }
  const thinIntents = [...byIntent.entries()].filter(([, v]) => v.total < 2).map(([k]) => k);
  const expectIntents = [...byIntent.values()].filter((v) => v.expectsMention);
  const expectTotal = expectIntents.reduce((a, v) => a + v.total, 0);
  const expectZero = expectIntents.reduce((a, v) => a + v.zero, 0);
  const noMentionIntents = [...byIntent.entries()].filter(([, v]) => !v.expectsMention).map(([k]) => k);
  // 只要有一个"语义上要求点名"的意图真的给出了名单，就说明解析器在工作，
  // 零命中可以归因为数据特征；如果一个都没有，那更可能是解析故障。
  const parserWorks = expectIntents.some((v) => v.withMentions > 0);
  // 只有"本应点名机构"的意图上的零命中才算解析故障
  const zeroRateExpect = expectTotal ? expectZero / expectTotal : 0;

  const warnings = [];
  const failRate = total ? failedRows.length / total : 0;
  if (failRate > 0.05) {
    warnings.push({
      level: failRate > 0.2 ? 'high' : 'medium',
      message: `采样失败率 ${(failRate * 100).toFixed(1)}%（${failedRows.length}/${total}）。失败样本会被剔除出分母，但失败率过高说明通道不稳定，需要先排查。`,
    });
  }
  const badEngines = rateTable(byEngine).filter((r) => r.successRate !== null && r.successRate < 0.9);
  for (const e of badEngines) {
    warnings.push({
      level: e.successRate < 0.7 ? 'high' : 'medium',
      message: `通道 ${e.key} 成功率仅 ${(e.successRate * 100).toFixed(1)}%。跨通道对比会失真——这不代表该 AI 不认识这些实体，只代表接口不稳定。`,
    });
  }
  if (zeroRateExpect > 0.1) {
    warnings.push({
      level: zeroRateExpect > 0.3 ? 'high' : 'medium',
      message:
        `在语义上要求推荐机构的问题里，有 ${(zeroRateExpect * 100).toFixed(1)}% 的回答没有给出任何机构名` +
        `（${expectZero}/${expectTotal}）。**这有两种可能，必须抽查后才能定性**：` +
        `① AI 主动选择只给方法论、不给名单——实测很常见（"香港插班没有统一的插班机构"），这是**数据不是故障**；` +
        `② 解析器不适配该模型的回答格式——这才是故障。` +
        `把 ① 误判成 ② 会让人去修一个没坏的解析器。用 tools/inspect-sample.mjs 抽查即可分辨。`,
    });
  }
  if (shortAnswers > 0) {
    warnings.push({
      level: shortAnswers / Math.max(1, parsed.length) > 0.1 ? 'medium' : 'low',
      message: `有 ${shortAnswers} 条回答短于 ${minUsableChars} 字（可能是拒答或截断）。这类样本计入分母会把所有实体一起拉平。`,
    });
  }
  if (thinIntents.length) {
    warnings.push({
      level: 'medium',
      message: `${thinIntents.length} 个意图的样本数少于 2（${thinIntents.slice(0, 5).join('、')}）。样本不足时稳定性指标没有意义，改写轴也估计不出来。`,
    });
  }
  const proseShare = parsed.length ? (shapes.get('prose') ?? 0) / parsed.length : 0;
  if (proseShare > 0.5) {
    warnings.push({
      level: 'medium',
      message: `${(proseShare * 100).toFixed(0)}% 的回答是纯段落叙述，这类回答没有确定的"推荐顺序"，名次依据会被削弱。`,
    });
  }

  return {
    total,
    valid: validRows.length,
    failed: failedRows.length,
    successRate: total ? validRows.length / total : null,
    byEngine: rateTable(byEngine),
    byRegion: rateTable(byRegion),
    parsing: {
      zeroMention,
      zeroMentionRate: parsed.length ? zeroMention / parsed.length : null,
      zeroMentionSamples,
      mentionCount: stats(mentionCounts),
      shapes: Object.fromEntries(shapes),
      shortAnswers,
      shortSampleIds,
      rawLength: stats(lengths),
    },
    intents: {
      count: byIntent.size,
      samplesPerIntent: stats([...byIntent.values()].map((v) => v.total)),
      thin: thinIntents,
      // 本就不点名机构的意图（避坑/收费/签约条款类）——它们零命中是正确答案
      noMentionIntents,
      // 每个意图下 AI 实际给出机构名单的比例。这是产品级的发现：
      // 实测香港榜 20 条里只有 6 条给了具体机构名，其余全是方法论。
      byIntent: [...byIntent.entries()]
        .map(([k, v]) => ({
          intent: k,
          total: v.total,
          withMentions: v.withMentions,
          mentionRate: v.total ? v.withMentions / v.total : null,
          expectsMention: v.expectsMention,
        }))
        .sort((a, b) => (b.mentionRate ?? 0) - (a.mentionRate ?? 0)),
      expectedTotal: expectTotal,
      expectedZero: expectZero,
      zeroRateOnExpected: zeroRateExpect,
    },
    warnings,
    // 一句话结论：这批数据能不能拿去做榜
    verdict: verdictOf({
      total,
      validRows,
      zeroRate: zeroRateExpect,
      failRate,
      proseShare,
      parserWorks,
    }),
  };
}

function verdictOf({ total, validRows, zeroRate, failRate, proseShare, parserWorks = true }) {
  if (total === 0) return { ok: false, level: 'high', message: '没有样本，无法评估。' };
  if (validRows.length < 5) {
    return { ok: false, level: 'high', message: `有效样本仅 ${validRows.length} 条，低于最小可发布样本量，不得对外发布。` };
  }
  if (failRate > 0.2) return { ok: false, level: 'high', message: '失败率超过 20%，先修通道，不要拿这批数据做榜。' };
  if (zeroRate > 0.3) {
    // 关键区分：所有"要求点名"的意图都零命中 → 更像解析故障；有一个能出名单 → 是数据特征。
    if (!parserWorks) {
      return {
        ok: false,
        level: 'high',
        message:
          '所有语义上要求推荐的问题**一条机构名都没解析出来**。这更像解析器不适配该模型的回答格式，' +
          '而不是 AI 不给名单。先人工看几条原文再放量。',
      };
    }
    return {
      ok: true,
      level: 'medium',
      message:
        `超过 30% 的问题没有拿到机构名单（${(zeroRate * 100).toFixed(0)}%），但已有问题成功拿到名单，` +
        '说明解析器在工作，这属于**数据特征**：实测"推荐/对比"类问题 AI 会给名单，"怎么办/有没有必要"类一条都不给。' +
        '注意**可用于排名的样本量会比总样本量少很多** —— 出榜前先看上面的「AI 给名单情况」。',
    };
  }
  if (zeroRate > 0.1 || proseShare > 0.5) {
    return { ok: true, level: 'medium', message: '数据可用，但有需要先处理的问题（见告警）。建议先修正、再对外发布。' };
  }
  return { ok: true, level: 'low', message: '数据健康，可以进入排名与报告环节。' };
}

/** 渲染成人类可读文本（CLI 用）。 */
export function renderHealthText(h, consortiumTitle = '') {
  const pct = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);
  const L = [];
  L.push(`采样健康度${consortiumTitle ? ` — ${consortiumTitle}` : ''}`);
  L.push('');
  L.push(`样本 ${h.total} 条｜有效 ${h.valid}｜失败 ${h.failed}｜成功率 ${pct(h.successRate)}`);
  L.push('');
  L.push('按通道：');
  for (const r of h.byEngine) L.push(`  ${String(r.key).padEnd(12)} ${String(r.ok).padStart(4)}/${String(r.total).padEnd(4)}  成功率 ${pct(r.successRate)}`);
  if (h.byRegion.length > 1) {
    L.push('按地域：');
    for (const r of h.byRegion) L.push(`  ${String(r.key).padEnd(12)} ${String(r.ok).padStart(4)}/${String(r.total).padEnd(4)}  成功率 ${pct(r.successRate)}`);
  }
  L.push('');
  L.push('解析层面：');
  L.push(`  解析不出实体的回答：${h.parsing.zeroMention} 条（${pct(h.parsing.zeroMentionRate)}）`);
  if (h.intents?.noMentionIntents?.length) {
    // 区分"解析故障"与"问题本身不涉及名单"：后者零命中是正确答案
    L.push(`    ├ 其中本就不点名机构的问题（${h.intents.noMentionIntents.length} 个）：${h.intents.noMentionIntents.join('、')}`);
    L.push(
      `    └ 在**本应点名机构**的问题上，零命中率 ${pct(h.intents.zeroRateOnExpected)}` +
        `（${h.intents.expectedZero}/${h.intents.expectedTotal}）`,
    );
  }
  L.push(`  每条回答平均解析出：${h.parsing.mentionCount.mean === null ? '—' : h.parsing.mentionCount.mean.toFixed(1)} 个实体（中位 ${h.parsing.mentionCount.median ?? '—'}）`);
  L.push(`  回答长度：中位 ${h.parsing.rawLength.median ?? '—'} 字｜最短 ${h.parsing.rawLength.min ?? '—'} 字`);
  L.push(`  回答形态：${Object.entries(h.parsing.shapes).map(([k, v]) => `${k} ${v}`).join('｜') || '—'}`);
  L.push(`  意图数 ${h.intents.count}｜每个意图中位 ${h.intents.samplesPerIntent.median ?? '—'} 条`);
  if (h.parsing.zeroMentionSamples.length) {
    L.push(`  建议人工抽查：${h.parsing.zeroMentionSamples.slice(0, 5).join(', ')}`);
  }
  L.push('');
  if (h.intents?.byIntent?.length) {
    // 这个板块是产品级的：它回答"AI 到底在哪些问题上肯给名单"
    const withAny = h.intents.byIntent.reduce((a, r) => a + r.withMentions, 0);
    const totalAll = h.intents.byIntent.reduce((a, r) => a + r.total, 0);
    L.push(`AI 给名单情况：${withAny}/${totalAll} 条回答给出了具体机构名（${pct(totalAll ? withAny / totalAll : null)}）`);
    for (const r of h.intents.byIntent) {
      const mark = r.mentionRate === 0 ? '✖' : r.mentionRate === 1 ? '✔' : '~';
      L.push(
        `  ${mark} ${String(r.intent).padEnd(22)} ${String(r.withMentions).padStart(3)}/${String(r.total).padEnd(3)} ${pct(r.mentionRate)}` +
          (r.expectsMention ? '' : '   （本题语义上不要求点名）'),
      );
    }
    L.push('  ✔ 全部给名单　~ 部分给　✖ 一条都没给');
    L.push('');
  }
  if (h.warnings.length) {
    L.push('告警：');
    for (const w of h.warnings) {
      L.push(`  [${w.level === 'high' ? '严重' : w.level === 'medium' ? '注意' : '提示'}] ${w.message}`);
    }
  } else {
    L.push('告警：无');
  }
  L.push('');
  L.push(`结论：${h.verdict.message}`);
  return L.join('\n');
}
