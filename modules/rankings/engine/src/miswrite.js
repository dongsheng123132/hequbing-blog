/**
 * 疑似误写检测：找出 AI 把机构名 / 品牌名写错的地方。
 *
 * 真实案例（本项目实测）：问通义千问「香港留学机构哪家好」，它把「金吉列」写成了
 * 「金吉利」。这种错写会让实体归一失败 —— 品牌因此被少算一次提及，
 * 而且客户永远不知道自己被 AI 叫错了名字。
 *
 * 这正是"AI 认错了谁"这个产品卖点的技术实现。
 *
 * 做法：对每个别名，锚定其首字出现的位置，取相邻长度的窗口做编辑距离比对。
 * 不做全量滑窗，否则长回答 × 几百个别名会直接算爆。
 */
import { toSimplified } from './zh.js';

/** Levenshtein 距离，带提前退出（超过 limit 立即返回 limit+1）。 */
export function editDistanceAtMost(a, b, limit = 1) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > limit) return limit + 1;
  let prev = new Array(lb + 1);
  let cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > limit) return limit + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[lb];
}

/**
 * @param {string} text 原始回答
 * @param {Array<{id:string,name:string,aliases?:string[]}>} entities
 * @param {{minAliasLength?:number, maxDistance?:number, limit?:number}} [opts]
 * @returns {Array<{entityId:string, expected:string, surface:string, start:number, end:number, distance:number}>}
 */
export function findSuspectedMiswrites(text, entities, opts = {}) {
  // 两字词做编辑距离 1 的比对误报率极高（"美的"/"美地"、"小米"/"小来"），默认从三字起
  const minLen = opts.minAliasLength ?? 3;
  const maxDistance = opts.maxDistance ?? 1;
  const limit = opts.limit ?? 20;
  if (!text || typeof text !== 'string' || !entities?.length) return [];

  const view = toSimplified(text);

  // 第一步：标记所有"精确命中任一别名"的区间。
  // 不做这一步就会疯狂误报 —— 实测中「新航道」本来是「新航道前程留学」的合法别名，
  // 却因为与「新航港国际教育」编辑距离为 1 被报成误写。
  const allAliases = [];
  for (const e of entities) {
    for (const n of new Set([e.name, ...(e.aliases ?? [])].filter(Boolean))) {
      const a = toSimplified(String(n).trim());
      if (a.length >= 2) allAliases.push(a);
    }
  }
  const exactRanges = [];
  for (const a of allAliases) {
    let from = 0;
    for (;;) {
      const i = view.indexOf(a, from);
      if (i === -1) break;
      exactRanges.push([i, i + a.length]);
      from = i + 1;
    }
  }
  const overlapsExact = (s, e) => exactRanges.some(([x, y]) => s < y && x < e);

  const PUNCT = /[，。、；：！？·「」《》（）()\s,.;:!?"'’“”\-—_/\\[\]{}]/;
  const hits = [];

  for (const e of entities) {
    const names = new Set([e.name, ...(e.aliases ?? [])].filter(Boolean));
    for (const rawName of names) {
      const alias = toSimplified(String(rawName).trim());
      if (alias.length < minLen) continue;
      // 纯 ASCII 别名（EIC / JJL / AAS / aec…）不参与误写检测：
      // 三字母缩写与任意英文片段的编辑距离经常是 1，误报远多于真报。
      if (/^[\x20-\x7e]+$/.test(alias)) continue;

      const head = alias[0];
      for (let i = 0; i + minLen <= view.length; i++) {
        if (view[i] !== head) continue;
        let exact = false;
        for (const len of [alias.length - 1, alias.length, alias.length + 1]) {
          if (len < minLen || i + len > view.length) continue;
          const cand = view.slice(i, i + len);
          if (cand === alias) {
            exact = true;
            break;
          }
          if (PUNCT.test(cand)) continue; // "金吉、" 这种截断不是误写
          if (overlapsExact(i, i + len)) continue; // 落在已精确命中的别名上
          const d = editDistanceAtMost(cand, alias, maxDistance);
          if (d <= maxDistance) {
            hits.push({
              entityId: e.id,
              expected: String(rawName),
              surface: text.slice(i, i + len),
              start: i,
              end: i + len,
              distance: d,
            });
          }
        }
        if (exact) {
          for (let k = hits.length - 1; k >= 0; k--) {
            if (hits[k].entityId === e.id && hits[k].start === i) hits.splice(k, 1);
          }
        }
      }
    }
  }

  // 去重叠：同一段文字只保留距离最小的一个解释
  hits.sort((a, b) => a.start - b.start || a.distance - b.distance || b.end - a.end);
  const kept = [];
  for (const h of hits) {
    const last = kept[kept.length - 1];
    if (last && h.start < last.end) {
      if (h.distance < last.distance) kept[kept.length - 1] = h;
      continue;
    }
    kept.push(h);
  }
  return kept.slice(0, limit);
}

/** 把误写结果汇总成"哪家被叫错了、错了多少次"。 */
export function summarizeMiswrites(samples, entities) {
  const byEntity = new Map();
  for (const s of samples) {
    const hits = findSuspectedMiswrites(s.raw ?? '', entities);
    for (const h of hits) {
      const key = `${h.entityId}::${h.surface}`;
      if (!byEntity.has(key)) {
        byEntity.set(key, {
          entityId: h.entityId,
          expected: h.expected,
          surface: h.surface,
          count: 0,
          engines: new Set(),
          samples: [],
        });
      }
      const rec = byEntity.get(key);
      rec.count++;
      if (s.engine) rec.engines.add(s.engine);
      if (rec.samples.length < 5) rec.samples.push(s.sampleId);
    }
  }
  return [...byEntity.values()]
    .map((r) => ({ ...r, engines: [...r.engines] }))
    .sort((a, b) => b.count - a.count);
}
