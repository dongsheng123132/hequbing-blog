/**
 * 成对击败率（Head-to-Head Win Rate）。
 *
 * 为什么榜单要用它排序，而不是绝对综合分：
 * 成对比较在**同一条回答内部**完成配对 —— A 和 B 面对的是同一个 prompt、同一个模型、
 * 同一时刻。于是 prompt 难度、引擎偏好、时间窗这些系统性偏差被直接抵消。
 * 绝对分会被"这批问题整体难不难"影响，击败率不会。
 *
 * 分母 = 至少一方被提到的回答数；分母为 0 时返回 null。
 * 未提及绝不被编码成"最差位次"，也绝不与"排最后一名"混为一谈。
 */

const pct = (num, den) => (den > 0 ? (100 * num) / den : null);

/**
 * @param {Array<{sampleId:string, mentions:Array<{entityId:string}>}>} samples
 * @param {Array<{id:string,name:string}>} entities
 */
export function headToHead(samples, entities) {
  // Bootstrap 有放回抽样必须保留同一 sampleId 的每次出现。
  const present = samples.map((s) => new Set((s.mentions ?? []).map((m) => m.entityId)));
  const ids = entities.map((e) => e.id);
  const pairs = new Map();
  const scores = new Map(ids.map((id) => [id, { wins: 0, losses: 0, ties: 0, ranks: [] }]));

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      let wins = 0;
      let losses = 0;
      let ties = 0;
      for (const set of present) {
        const ha = set.has(a);
        const hb = set.has(b);
        if (ha && !hb) wins++;
        else if (hb && !ha) losses++;
        else ties++;
      }
      const winRate = pct(wins, wins + losses);
      pairs.set(`${a}|${b}`, { a, b, wins, losses, ties, winRate });
      const sa = scores.get(a);
      const sb = scores.get(b);
      sa.wins += wins;
      sa.losses += losses;
      sa.ties += ties;
      sb.wins += losses;
      sb.losses += wins;
      sb.ties += ties;
      if (winRate !== null) {
        sa.ranks.push(winRate);
        sb.ranks.push(100 - winRate);
      }
    }
  }

  const out = new Map();
  for (const [id, s] of scores) {
    out.set(id, {
      entityId: id,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      // 平均击败率：对每个对手的击败率取均值（对手固定，故可比）
      meanWinRate: s.ranks.length ? s.ranks.reduce((x, y) => x + y, 0) / s.ranks.length : null,
      opponents: s.ranks.length,
      pairWinRate: pct(s.wins, s.wins + s.losses),
    });
  }
  return { pairs, scores: out, sampleCount: samples.length };
}

/**
 * 配对 Bootstrap：对回答整体重采样，得到平均击败率的置信区间。
 * @returns {Map<string, {meanWinRate:number|null, ci95:[number,number]|null, draws:number}>}
 */
export function headToHeadBootstrap(samples, entities, { iterations = 2000, seed, rng } = {}) {
  const base = headToHead(samples, entities);
  const result = new Map(
    entities.map((e) => [e.id, { meanWinRate: base.scores.get(e.id).meanWinRate, ci95: null, draws: iterations }]),
  );
  if (!iterations || samples.length < 2) return result;

  const draws = new Map(entities.map((e) => [e.id, []]));
  const n = samples.length;
  for (let it = 0; it < iterations; it++) {
    const resampled = new Array(n);
    for (let i = 0; i < n; i++) resampled[i] = samples[Math.floor(rng() * n)];
    const h = headToHead(resampled, entities);
    for (const e of entities) {
      const v = h.scores.get(e.id).meanWinRate;
      if (v !== null) draws.get(e.id).push(v);
    }
  }
  for (const e of entities) {
    const arr = draws.get(e.id).sort((a, b) => a - b);
    if (!arr.length) continue;
    const lo = arr[Math.floor((arr.length - 1) * 0.025)];
    const hi = arr[Math.ceil((arr.length - 1) * 0.975)];
    result.get(e.id).ci95 = [Number(lo.toFixed(2)), Number(hi.toFixed(2))];
  }
  return result;
}

/** 击败率矩阵（可直接渲染成网页热力表）。 */
export function winRateMatrix(samples, entities) {
  const { pairs } = headToHead(samples, entities);
  const ids = entities.map((e) => e.id);
  const m = {};
  for (const a of ids) {
    m[a] = {};
    for (const b of ids) {
      if (a === b) {
        m[a][b] = null;
        continue;
      }
      const p = pairs.get(`${a}|${b}`) ?? pairs.get(`${b}|${a}`);
      if (!p) {
        m[a][b] = null;
        continue;
      }
      m[a][b] = p.a === a ? p.winRate : p.winRate === null ? null : 100 - p.winRate;
    }
  }
  return m;
}
