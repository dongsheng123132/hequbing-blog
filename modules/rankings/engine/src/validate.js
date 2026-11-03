/**
 * 榜单配置校验。
 *
 * 为什么需要：配置错误不会报错，只会静默产出错误的排名。
 * 最典型的是**跨实体别名冲突** —— 两个实体登记了同一个别名（如"西大"既指广西大学又指西北大学），
 * 解析器只会匹配到其中一个，另一个的提及被系统性地吞掉，而页面上看不出任何异常。
 *
 * 另外把命名合规检查做进工具链：标题里出现"中国/全国/全球"等字样直接报错，
 * 而不是等到发布前靠人记得。
 */
import { normalizeWeights, DEFAULT_WEIGHTS } from './score.js';

/** 评选类禁用字样（《评比达标表彰活动管理办法》第二十二条）。 */
const FORBIDDEN_TITLE_WORDS = ['中国', '全国', '全球', '亚洲', '世界', '国际', '中华', '国家'];

/** 广告法第九条绝对化用语（榜单标题里出现即高风险）。 */
const ABSOLUTE_WORDS = ['最佳', '第一', '最强', '最好', '顶级', '权威', '唯一'];

/**
 * @param {object} consortium
 * @returns {{ok:boolean, errors:string[], warnings:string[], stats:object}}
 */
export function validateConsortium(consortium) {
  const errors = [];
  const warnings = [];
  const c = consortium ?? {};

  if (!c.id) errors.push('缺少 id');
  if (!c.title) errors.push('缺少 title');

  // —— 命名合规 ——
  const title = String(c.title ?? '');
  for (const w of FORBIDDEN_TITLE_WORDS) {
    if (title.includes(w)) {
      errors.push(
        `标题含"${w}"：《评比达标表彰活动管理办法》第二十二条禁止任何组织和个人未经批准使用该类字样做评选。请改为不含地域/层级词的中性名称。`,
      );
    }
  }
  for (const w of ABSOLUTE_WORDS) {
    if (title.includes(w)) errors.push(`标题含绝对化用语"${w}"（广告法第九条高风险）`);
  }

  // —— 实体 ——
  const entities = c.entities ?? [];
  if (entities.length < 2) errors.push(`候选实体只有 ${entities.length} 个，至少需要 2 个`);
  const ids = new Set();
  const aliasOwner = new Map();
  const aliasConflicts = [];
  for (const e of entities) {
    if (!e.id) errors.push('存在缺少 id 的实体');
    if (!e.name) errors.push(`实体 ${e.id} 缺少 name`);
    if (ids.has(e.id)) errors.push(`实体 id 重复：${e.id}`);
    ids.add(e.id);
    for (const a of new Set([e.name, ...(e.aliases ?? [])].filter(Boolean))) {
      const key = String(a).trim();
      if (!key) continue;
      if (aliasOwner.has(key) && aliasOwner.get(key) !== e.id) {
        aliasConflicts.push(`"${key}" 同时登记给 ${aliasOwner.get(key)} 与 ${e.id}`);
      } else {
        aliasOwner.set(key, e.id);
      }
    }
  }
  if (aliasConflicts.length) {
    errors.push(
      `跨实体别名冲突 ${aliasConflicts.length} 处（会导致其中一个实体的提及被静默吞掉）：` +
        aliasConflicts.slice(0, 8).join('；') +
        (aliasConflicts.length > 8 ? ` …等 ${aliasConflicts.length} 处` : ''),
    );
  }

  // —— 分组 ——
  const groupStats = {};
  if (c.groupBy) {
    for (const e of entities) {
      const v = e?.[c.groupBy];
      if (v === undefined || v === null) {
        errors.push(`groupBy="${c.groupBy}"，但实体 ${e.id} 没有该字段`);
        continue;
      }
      groupStats[v] = (groupStats[v] ?? 0) + 1;
    }
    const singles = Object.entries(groupStats).filter(([, n]) => n < 2);
    if (singles.length) {
      warnings.push(
        `分组里有 ${singles.length} 个赛道只有 1 个实体（${singles.map(([k]) => k).join('、')}），排名时会自动跳过`,
      );
    }
  }

  // —— Prompt ——
  const prompts = c.prompts ?? [];
  if (!prompts.length) errors.push('没有任何 Prompt');
  const pid = new Set();
  const intentStats = {};
  let noMention = 0;
  for (const p of prompts) {
    if (!p.id) errors.push('存在缺少 id 的 Prompt');
    if (!p.text) errors.push(`Prompt ${p.id} 缺少 text`);
    if (pid.has(p.id)) errors.push(`Prompt id 重复：${p.id}`);
    pid.add(p.id);
    const k = p.intent ?? p.id;
    intentStats[k] = (intentStats[k] ?? 0) + 1;
    if (p.expectsMention === false) noMention++;
  }
  const thinIntents = Object.entries(intentStats).filter(([, n]) => n < 2);
  if (thinIntents.length === Object.keys(intentStats).length && Object.keys(intentStats).length > 1) {
    warnings.push('所有意图都只有 1 条 Prompt，改写轴估计不出方差');
  }

  // —— 权重 ——
  try {
    normalizeWeights(c.weights ?? DEFAULT_WEIGHTS);
  } catch (e) {
    errors.push(`权重非法：${e.message}`);
  }

  const stats = {
    entities: entities.length,
    aliasCount: aliasOwner.size,
    aliasConflicts: aliasConflicts.length,
    prompts: prompts.length,
    intents: Object.keys(intentStats).length,
    noMentionPrompts: noMention,
    groups: groupStats,
    thinIntents: thinIntents.map(([k]) => k),
  };

  return { ok: errors.length === 0, errors, warnings, stats };
}

/** 渲染成人可读文本。 */
export function renderValidationText(v, title = '') {
  const L = [];
  L.push(`榜单配置校验${title ? ` — ${title}` : ''}`);
  L.push('');
  L.push(
    `实体 ${v.stats.entities} 个｜别名 ${v.stats.aliasCount} 条｜Prompt ${v.stats.prompts} 条｜意图 ${v.stats.intents} 个`,
  );
  if (Object.keys(v.stats.groups).length) {
    L.push(
      '分组：' + Object.entries(v.stats.groups).map(([k, n]) => `${k} ${n}`).join('｜'),
    );
  }
  L.push('');
  if (v.errors.length) {
    L.push(`错误（${v.errors.length}）：`);
    for (const e of v.errors) L.push(`  ✖ ${e}`);
  } else {
    L.push('错误：无');
  }
  if (v.warnings.length) {
    L.push(`提示（${v.warnings.length}）：`);
    for (const w of v.warnings) L.push(`  · ${w}`);
  }
  L.push('');
  L.push(v.ok ? '结论：配置可用。' : '结论：配置有错误，修好再跑采样——否则会静默产出错误的排名。');
  return L.join('\n');
}
