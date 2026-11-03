/**
 * 未收录实体发现。
 *
 * 存在理由（这是一条方法论红线）：
 * 如果 AI 在回答里提到了某家机构，但榜单配置的实体表没有收录它，
 * 解析器会直接忽略 —— 我们就会得出"没人提到这家"的结论，
 * 而真相是"我们的表不全"。**这种错误看不出来，但会让榜单在事实层面就是错的。**
 *
 * 实测触发案例：问"香港本地的升学顾问机构有哪些"，AI 推荐了 EKbuddies（香港本地升学资讯平台），
 * 而它不在初始的 39 家实体表里。
 *
 * 做法：用"机构名模式"扫回答，排除已精确命中的别名区间与泛指词，剩下的就是疑似漏收录。
 */
import { toSimplified } from './zh.js';

/** 机构名常见后缀。 */
const ORG_SUFFIX = '(?:教育|留学|升学|顾问|中介|国际教育|培训|书院|学院|集团|机构|咨询)';
/** 机构名常见后缀（长的排前面，先匹配"国际教育"再匹配"教育"）。 */
const SUFFIX_PATTERN = /(?:国际教育|教育|留学|升学|顾问|中介|培训|书院|学院|集团|机构|咨询)/g;

/** 可剥离的泛指前缀（按长度降序尝试）。 */
const STRIP_WORDS = [
  '推荐', '建议', '选择', '考虑', '包括', '例如', '比如', '取决', '适合', '尽量', '希望',
  '可以', '需要', '要求', '注意', '警惕', '直接', '通常', '一般', '部分', '多数', '少数',
  '所有', '任何', '哪些', '什么', '这个', '那个', '一家', '这家', '那家', '有些', '很多',
  '不少', '其他', '不同', '同类', '本地', '内地', '海外', '国内', '国外', '专业', '知名',
  '老牌', '大型', '中型', '小型', '正规', '靠谱', '精品', '独立', '具体', '负责', '高端',
  '好的', '这种', '这类', '上述', '以下', '以及', '如果', '因为', '但是', '所以', '而且',
  '或者', '其中', '一些', '某些', '相关', '各类', '多家', '几家', '综合', '国际', '类似',
  '同等', '别的', '其它', '一家', '两家', '三家', '当地', '沿海', '内地', '省外', '境外',
].sort((a, b) => b.length - a.length);

/** 剥离后若以助词/连词开头，说明切在了词中间，放弃。 */
const BAD_TAIL_HEAD = /^[的得地是和与或在到对为把被]/;

/**
 * 泛指词/限定词开头 —— 这些不是机构名。
 * 例如"这家机构""大型综合留学机构""本地升学顾问""正规中介"。
 * 实测必须收得很紧，否则"有些机构""好的顾问""香港留学中介"这类片段会大量误报。
 */
const GENERIC_HEAD =
  /^(?:这|那|一|某|大|中|小|正|靠|精|黑|该|哪|很|如|比|其|同|不|本|内|所|各|多|几|些|部|全|任|专|知|老|新|上|以|当|香|子|负|的|你|判|高|找|是|选|可|有|学|独|具|好|重|教|语|需|要|会|能|想|让|给|对|把|被|从|到|在|和|与|或|但|而|就|都|也|还|只|更|最|非|特|尤|另|此|若|除|关|相|类|种|些|位|名|家|间|次|项|条|份|适|推|方|差|出|价|尽|希|课|早|年|签|熟|文|实|见|过|通|看|问|说|提|包|含|是|否|值|得|以|及|等|例|比|较|同|样|般|普|通常|一般)/;

/** 常见的"不是机构名"的词组（泛指、职责、通用品类）。 */
const STOPWORDS = new Set([
  '香港留学中介', '留学中介', '中介机构', '教育机构', '留学机构', '培训机构',
  '升学顾问', '教育顾问', '学校顾问', '独立顾问', '具体顾问', '好的顾问', '高端顾问',
  '负责顾问', '负责我的顾问', '有些机构', '有些中介', '这类机构', '这种机构',
  '任何机构', '哪个机构', '什么机构', '学校升学', '香港教育', '香港升学', '子女升学',
  '语言培训', '选校咨询', '留学咨询', '教育咨询', '本地升学', '海外升学', '国际教育',
  '留学服务', '中介服务', '升学机构', '顾问机构', '中介公司', '留学公司',
]);

/**
 * @param {string} text 原始回答
 * @param {Array<{id:string,name:string,aliases?:string[]}>} entities 已有实体表
 * @param {{minLength?:number, minCount?:number, limit?:number}} [opts]
 * @returns {Array<{surface:string, count:number, reason:string}>}
 */
export function findUnknownEntities(text, entities, opts = {}) {
  const minLength = opts.minLength ?? 4;
  const minCount = opts.minCount ?? 1;
  const limit = opts.limit ?? 30;
  if (!text || typeof text !== 'string') return [];

  const view = toSimplified(text);

  // 标记所有"已精确命中已知别名"的区间：落在这些区间里的不是漏收录
  const knownRanges = [];
  const aliases = [];
  for (const e of entities ?? []) {
    for (const n of new Set([e.name, ...(e.aliases ?? [])].filter(Boolean))) {
      const a = toSimplified(String(n).trim());
      if (a.length >= 2) aliases.push(a);
    }
  }
  for (const a of aliases) {
    let from = 0;
    for (;;) {
      const i = view.indexOf(a, from);
      if (i === -1) break;
      knownRanges.push([i, i + a.length]);
      from = i + 1;
    }
  }
  const overlapsKnown = (s, e) => knownRanges.some(([x, y]) => s < y && x < e);

  const counts = new Map();
  SUFFIX_PATTERN.lastIndex = 0;
  let m;
  while ((m = SUFFIX_PATTERN.exec(view)) !== null) {
    const suffix = m[0];
    const suffixStart = m.index;
    const end = suffixStart + suffix.length;
    // 从后缀位置向前取最多 4 个**连续**的汉字/字母。
    // 不能用固定 4 字窗口：那样会跨过标点取到"、琥珀"这种，把真机构名挡掉；
    // 也不能不设上限，否则会跨词取到"推荐琥珀"。
    let ws = suffixStart;
    let wlen = 0;
    while (ws > 0 && wlen < 4 && /[\u4e00-\u9fa5A-Za-z]/.test(view[ws - 1])) {
      ws--;
      wlen++;
    }
    const window = view.slice(ws, suffixStart);
    if (window.length < 2) continue;

    let surface = window + suffix;

    // 整段就是泛指短语（如"香港留学中介"）→ 放弃这个后缀位置。
    // 注意：不能"逐字回退"，否则会切出"港留学中介"这种更糟的截断。
    if (STOPWORDS.has(surface)) continue;

    // 以泛指词开头时，**循环剥离**它再判断 ——
    // "大型综合留学机构"要连续剥掉"大型""综合"两层才露出真实品类。
    let brandPart = surface;
    for (let pass = 0; pass < 4; pass++) {
      let stripped = false;
      for (const w of STRIP_WORDS) {
        if (brandPart.startsWith(w) && brandPart.length - w.length >= 2) {
          brandPart = brandPart.slice(w.length);
          stripped = true;
          break;
        }
      }
      if (!stripped) break;
    }

    if (brandPart.length < minLength) continue;
    if (BAD_TAIL_HEAD.test(brandPart)) continue;
    if (STOPWORDS.has(brandPart)) continue;
    if (GENERIC_HEAD.test(brandPart)) continue;

    const brandStart = end - brandPart.length;
    if (overlapsKnown(brandStart, end)) continue;

    const shown = text.slice(brandStart, end);
    if (!counts.has(shown)) counts.set(shown, { surface: shown, count: 0, reason: '' });
    counts.get(shown).count++;
  }

  return [...counts.values()]
    .filter((r) => r.count >= minCount)
    .sort((a, b) => b.count - a.count || a.surface.localeCompare(b.surface))
    .slice(0, limit);
}

/**
 * 对一批样本做未收录实体扫描，返回按出现次数排序的候选。
 *
 * ⚠️ **这是提示工具，不是自动发现。** 输出必须人工复核后再决定是否入榜：
 * 中文没有词边界，正则不可避免地会把"取决于具体顾问"截成"决于具体顾问"。
 * 判据是"跨样本重复出现"——真机构名会在多条回答里稳定出现，截断片段则各不相同。
 * 因此默认要求至少出现 2 次。
 *
 * @param {Array<{raw?:string, sampleId?:string, engine?:string}>} samples
 */
export function scanUnknownEntities(samples, entities, opts = {}) {
  const minCount = opts.minCount ?? 2;
  const agg = new Map();
  for (const s of samples) {
    if (!s.raw) continue;
    for (const u of findUnknownEntities(s.raw, entities, opts)) {
      if (!agg.has(u.surface)) {
        agg.set(u.surface, { surface: u.surface, count: 0, sampleIds: [] });
      }
      const rec = agg.get(u.surface);
      rec.count += u.count;
      if (rec.sampleIds.length < 5) rec.sampleIds.push(s.sampleId);
    }
  }
  return [...agg.values()]
    .filter((r) => r.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, opts.limit ?? 40);
}
