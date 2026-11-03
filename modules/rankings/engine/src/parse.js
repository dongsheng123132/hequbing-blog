/**
 * 回答解析器（规则式）。
 *
 * 输入 AI 原始回答与实体别名表，输出有序的结构化提及。
 * 设计原则：
 *  - 确定性：同样输入永远同样输出，无随机、无网络。
 *  - 可审计：每条提及带原文偏移与证据句，页面可直接高亮回原文。
 *  - 不假装确定：回答是段落式叙述时，它根本没有"推荐顺序"这回事，
 *    这时标记 orderConfidence='low' 让下游知道名次不可信。
 *  - 可替换：解析升级后，用同一批 raw 原文重跑即可，历史榜单不失真。
 *
 * 已知局限见 docs/01-评分引擎设计.md §6 与 §8.5。
 */
import { toSimplified } from './zh.js';

/** 负面语境用正则而非单词：中文的否定与程度词组合太多（"投诉" vs "投诉率低"）。 */
const NEGATIVE_PATTERNS = [
  /不推荐/, /不建议/, /别买/, /不要买/, /翻车/, /避雷/, /质量差/, /品控差/,
  /售后差/, /投诉(多|不少|较多|率高|不断|集中)/, /口碑差/, /口碑一般/, /慎选/, /谨慎选择/,
  /争议大/, /被召回/, /虚假宣传/, /溢价严重/, /偷工减料/, /已经衰落/, /退出市场/,
  /破产/, /亏损/, /不靠谱/, /踩坑/, /退款难/, /跑路/, /不专业/, /敷衍/, /参差不齐/,
];

const POSITIVE_PATTERNS = [
  /强烈推荐/, /首推/, /首选/, /推荐/, /值得买/, /值得入手/, /口碑好/, /口碑不错/,
  /口碑(比较)?稳定/, /性价比高/, /性价比之王/, /销量第一/, /市场第一/, /行业领先/,
  /技术领先/, /龙头/, /老牌/, /靠谱/, /优秀/, /出色/, /不错的选择/, /好评/,
  /深受欢迎/, /占有率最高/, /资源(丰富|多)/, /实力(强|雄厚)/,
];

/**
 * 免责声明/法律声明的行首特征。
 * 这些段落里出现的品牌名是"提及"但不是"推荐"，一旦计入会直接虚高其认知分。
 */
const DISCLAIMER_HEAD = /(免责声明|法律声明|声明[:：]|以上信息仅供参考|本文不构成|不构成任何建议)/;

/**
 * 举例引导词。
 *
 * 真实回答里极常见的形态："### 1. 大型连锁留学机构 / 代表：新东方、新航道、启德……"
 * 这里的机构名是**举例**，不是推荐排序。把它们当成"第 1 名、第 2 名"会直接算错位次分。
 * 实测数据（通义千问回答「香港留学机构哪家好」）就是这么组织的。
 */
const ENUM_LEAD = /(代表\s*[:：]|例如\s*[:：]|比如\s*[:：]|诸如|包括\s*[:：]|如\s*[:：]|等\s*(机构|品牌|公司|厂家|企业|学校|中介)|等等)/;

/** 判断某个提及是否落在"举例"语境里（按整行判断，列举常跨句但很少跨行）。 */
function detectEnumeration(text, start, end) {
  const lineStart = text.lastIndexOf('\n', start) + 1;
  const nl = text.indexOf('\n', end);
  const line = text.slice(lineStart, nl === -1 ? text.length : nl);
  return ENUM_LEAD.test(line);
}

const CN_DIGITS = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/** 把 "十二" / "三" 这类中文序号转成数字，失败返回 NaN。 */
export function parseCnNumber(s) {
  if (!s) return NaN;
  if (s.length === 1) return CN_DIGITS[s] ?? NaN;
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (CN_DIGITS[s[1]] ?? 0);
  if (s.endsWith('十')) return (CN_DIGITS[s[0]] ?? 0) * 10;
  if (s.length === 3 && s[1] === '十') return (CN_DIGITS[s[0]] ?? 0) * 10 + (CN_DIGITS[s[2]] ?? 0);
  return NaN;
}

/**
 * 找出文本中的显式编号列表项位置。
 *
 * 支持 "1." "2、" "3)" "一、" "十二、" 等形态，仅在行首或换行后生效。
 * 也支持真实回答里极常见的 **Markdown 标题式编号**：`## 1. 某某机构`、`### 2. `、`**1.** `。
 * （实测通义千问会用 `## 1. 机构名` 来组织推荐列表，不认这个前缀就会整篇退化成"出现顺序"。）
 */
export function findListMarkers(text) {
  const re =
    /(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|__)?[ \t]*(?:(\d{1,2})[ \t]*[.、)）]|([一二三四五六七八九十]{1,3})[ \t]*[、.．])/g;
  const markers = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = m[1] ? Number(m[1]) : parseCnNumber(m[2]);
    if (!Number.isFinite(num)) continue;
    markers.push({ num, start: m.index + (m[0].startsWith('\n') ? 1 : 0), matchStart: m.index });
  }
  return markers;
}

/**
 * 找出应被排除的段落范围（免责声明等）。
 * 从命中行首特征的一行开始，一直延伸到空行为止。
 * @returns {Array<[number, number]>} 字符区间
 */
export function findExcludedRanges(text) {
  const ranges = [];
  const lines = text.split('\n');
  let pos = 0;
  let cur = null;
  for (const line of lines) {
    const start = pos;
    const end = pos + line.length;
    if (DISCLAIMER_HEAD.test(line)) {
      if (cur) cur[1] = end;
      else {
        cur = [start, end];
        ranges.push(cur);
      }
    } else if (cur) {
      if (line.trim() === '') cur = null;
      else cur[1] = end;
    }
    pos = end + 1;
  }
  return ranges;
}

/** 判断回答的形态，进而判断"顺序"这件事在这条回答里到底可不可信。 */
export function detectShape(text, markerCount = 0) {
  const lines = text.split('\n').filter((l) => l.trim());
  const bulletLines = lines.filter((l) => /^\s*[-*•·]\s+/.test(l)).length;
  const tableRows = lines.filter((l) => /^\s*\|.*\|\s*$/.test(l)).length;
  if (markerCount >= 2) return { shape: 'numbered', orderConfidence: 'high' };
  if (bulletLines >= 2) return { shape: 'bullets', orderConfidence: 'high' };
  if (tableRows >= 2) return { shape: 'table', orderConfidence: 'high' };
  // 纯段落叙述里，"先提到的"不等于"更推荐的" —— 这种名次不该拿去做排名依据
  return { shape: 'prose', orderConfidence: 'low' };
}

function buildAliasIndex(entities, minAliasLength) {
  const rows = [];
  for (const e of entities) {
    const names = new Set([e.name, ...(e.aliases ?? [])].filter(Boolean));
    for (const n of names) {
      // 别名也折叠成简体，保证「博華升學」与「博华升学」在同一个空间里比较
      const alias = toSimplified(n.trim());
      if (alias.length < minAliasLength) continue;
      rows.push({ alias, entityId: e.id });
    }
  }
  // 长别名优先，保证"美的集团"不会被"美的"抢先切走
  rows.sort((a, b) => b.alias.length - a.alias.length || (a.alias < b.alias ? -1 : 1));
  return rows;
}

/**
 * 在**折叠视图**上寻找匹配，但 surface 取原始回答的切片 ——
 * 这样审计与高亮指向的仍是 AI 的原始文字，不是我们改写过的版本。
 */
function findCandidates(view, aliasRows, raw) {
  const rawHits = [];
  for (const { alias, entityId } of aliasRows) {
    let from = 0;
    for (;;) {
      const idx = view.indexOf(alias, from);
      if (idx === -1) break;
      rawHits.push({
        entityId,
        surface: raw.slice(idx, idx + alias.length),
        start: idx,
        end: idx + alias.length,
      });
      from = idx + 1;
    }
  }
  rawHits.sort((a, b) => a.start - b.start || b.end - a.end || (a.entityId < b.entityId ? -1 : 1));
  // 贪心去重叠：重叠则保留更长的一个
  const kept = [];
  for (const c of rawHits) {
    const last = kept[kept.length - 1];
    if (last && c.start < last.end) {
      if (c.end - c.start > last.end - last.start) kept[kept.length - 1] = c;
      continue;
    }
    kept.push(c);
  }
  return kept;
}

function sentenceAround(text, start, end) {
  const stops = ['。', '！', '？', '\n', '；', '.', '!', '?', ';'];
  let s = start;
  while (s > 0 && !stops.includes(text[s - 1])) s--;
  let e = end;
  while (e < text.length && !stops.includes(text[e])) e++;
  return text.slice(s, e).trim();
}

function classifyContext(ctx) {
  // 负面优先：中文里"不推荐"包含"推荐"，若先命中正面词会把否定读反
  if (NEGATIVE_PATTERNS.some((re) => re.test(ctx))) return -1;
  if (POSITIVE_PATTERNS.some((re) => re.test(ctx))) return 1;
  return 0;
}

/**
 * 情感判定分两级：先只看提及所在的那一句，只有句内没有任何情感线索时，
 * 才回退到同一行内的上下文（**不跨换行**）。
 *
 * 不跨行是必要的：AI 回答多以 "1. 美的：不推荐。\n2. 格兰仕：首推。" 的列表形式出现，
 * 一旦允许回退跨行，每个列表项都会捡到邻居的好话/坏话，整列情感塌成同一个值。
 */
function detectSentiment(text, start, end, window) {
  const inSentence = classifyContext(sentenceAround(text, start, end));
  if (inSentence !== 0) return inSentence;
  let from = Math.max(0, start - window);
  let to = Math.min(text.length, end + window);
  const nlBefore = text.lastIndexOf('\n', start);
  if (nlBefore >= 0) from = Math.max(from, nlBefore + 1);
  const nlAfter = text.indexOf('\n', end);
  if (nlAfter >= 0) to = Math.min(to, nlAfter);
  return classifyContext(text.slice(from, to));
}

function inRanges(pos, ranges) {
  return ranges.some(([s, e]) => pos >= s && pos < e);
}

/**
 * 解析一条 AI 回答。
 * @param {string} raw 原始回答全文
 * @param {Array<{id:string,name:string,aliases?:string[]}>} entities 实体与别名表
 * @param {{window?:number,minAliasLength?:number,listAware?:boolean,keepExcluded?:boolean}} [opts]
 * @returns {Array<{entityId:string,surface:string,rank:number,rankSource:string,sentiment:number,
 *   start:number,end:number,evidence:string,orderConfidence:string,excluded:boolean}>}
 */
export function parseMentions(raw, entities, opts = {}) {
  const window = opts.window ?? 60;
  const minAliasLength = opts.minAliasLength ?? 2;
  const listAware = opts.listAware ?? true;
  const keepExcluded = opts.keepExcluded ?? false;
  if (!raw || typeof raw !== 'string') return [];

  // 全文分析都在**折叠视图**上做（繁体→简体，长度严格 1:1），
  // 命中的偏移量因此可以直接映射回原始回答，surface/证据句仍取原文。
  const view = toSimplified(raw);

  const excludedRanges = findExcludedRanges(view);
  let candidates = findCandidates(view, buildAliasIndex(entities, minAliasLength), raw);
  // 免责声明里的品牌名不是推荐，默认整段剔除
  if (!keepExcluded && excludedRanges.length) {
    candidates = candidates.filter((c) => !inRanges(c.start, excludedRanges));
  }
  if (candidates.length === 0) return [];

  const markers = listAware ? findListMarkers(view) : [];
  const useList = markers.length >= 2;
  const { shape, orderConfidence } = detectShape(view, markers.length);

  // 同一实体在一段回答里只取首次出现作为它的"被推荐位置"
  const firstByEntity = new Map();
  for (const c of candidates) {
    if (!firstByEntity.has(c.entityId)) firstByEntity.set(c.entityId, c);
  }
  const picked = [...firstByEntity.values()];

  const mentionedOrder = [...picked].sort(
    (a, b) => a.start - b.start || (a.entityId < b.entityId ? -1 : 1),
  );

  const rankByEntity = new Map();
  const rankSourceByEntity = new Map();

  if (useList) {
    for (const c of picked) {
      // 找到该提及之前最近的一个编号项
      let marker = null;
      for (const mk of markers) {
        if (mk.start <= c.start) marker = mk;
        else break;
      }
      if (marker && Number.isFinite(marker.num)) {
        rankByEntity.set(c.entityId, marker.num);
        rankSourceByEntity.set(c.entityId, 'list-marker');
      }
    }
    // 同一编号项内出现多个实体时，按出现顺序补位
    const used = new Map();
    for (const c of mentionedOrder) {
      const r = rankByEntity.get(c.entityId);
      if (r === undefined) continue;
      const n = (used.get(r) ?? 0) + 1;
      used.set(r, n);
      if (n > 1) {
        rankByEntity.set(c.entityId, r + (n - 1) * 0.001);
        rankSourceByEntity.set(c.entityId, 'list-marker-tie');
      }
    }
  }

  // 没有编号依据的实体，按出现顺序排在已定序实体之后
  const maxMarkerRank = useList
    ? Math.max(
        0,
        ...[...rankByEntity.entries()]
          .filter(([id]) => rankSourceByEntity.get(id)?.startsWith('list-marker'))
          .map(([, r]) => Math.floor(r)),
      )
    : 0;
  let fallback = 0;
  for (const c of mentionedOrder) {
    if (rankByEntity.has(c.entityId)) continue;
    fallback += 1;
    rankByEntity.set(c.entityId, maxMarkerRank + fallback);
    rankSourceByEntity.set(c.entityId, 'appearance-order');
  }

  const result = mentionedOrder.map((c) => ({
    entityId: c.entityId,
    surface: c.surface,
    rank: rankByEntity.get(c.entityId),
    rankSource: rankSourceByEntity.get(c.entityId),
    sentiment: detectSentiment(raw, c.start, c.end, window),
    start: c.start,
    end: c.end,
    evidence: sentenceAround(raw, c.start, c.end),
    shape,
    // 段落式叙述里的"顺序"不构成推荐强度，下游据此降低名次可信度
    orderConfidence,
    // 举例语境（"代表：A、B、C"）不计入位次，只计入提及
    enumeration: detectEnumeration(raw, c.start, c.end),
    excluded: false,
  }));

  // 若多数提及都出自"举例"，这条回答本质是分类教程而不是推荐列表，
  // 整体降级为 categorical / 低顺序置信度，避免用它的顺序去排名次。
  const enumCount = result.filter((m) => m.enumeration).length;
  if (result.length && enumCount > result.length / 2) {
    for (const m of result) {
      m.shape = 'categorical';
      m.orderConfidence = 'low';
    }
  }

  // 出现在第一个编号项**之前**的提及属于导语（"没有绝对答案：启德和新东方前途都可以…"），
  // 它们只是被提到，不构成推荐顺序。全文有编号不代表这些提及有顺序。
  // 注意：没有编号项的回答不适用这条 —— 项目符号列表的顺序本身是可信的。
  if (markers.length >= 1) {
    const firstMarkerStart = Math.min(...markers.map((mk) => mk.start));
    for (const m of result) {
      if (m.rankSource === 'appearance-order' && m.start < firstMarkerStart) {
        m.orderConfidence = 'low';
        m.leadIn = true;
      }
    }
  }
  return result;
}
