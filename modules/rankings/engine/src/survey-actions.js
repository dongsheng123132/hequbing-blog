import { parseMentions } from './parse.js';
import { computeMetrics } from './metrics.js';

export const SURVEY_ACTIONS = ['survey.list', 'survey.plan', 'survey.report', 'survey.brief'];
const need = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;

export function surveyAction(action, input = {}, catalog) {
  need(SURVEY_ACTIONS.includes(action), '未知动作');
  if (action === 'survey.list') return catalog.industries.map(({ id, title, market }) => ({ id, title, market }));
  const industry = catalog.industries.find((x) => x.id === input.industry);
  need(industry, '未知行业');
  if (action === 'survey.plan') return {
    version: catalog.version, industryId: industry.id, title: industry.title, market: industry.market,
    prompts: industry.prompts, targetEntities: input.entities ?? industry.entities,
    collectionStatus: 'not_started', cost: '本动作离线免费；模型采样另按授权执行',
    sampleSchema: 'references/sample.example.json',
    diagnosisChecks: industry.diagnosisChecks ?? [],
  };
  if (action === 'survey.brief') {
    const request = input.request ?? {};
    return { status: 'draft_not_sent', industryId: industry.id,
      request: Object.fromEntries(['company', 'website', 'goal', 'context'].filter((k) => text(request[k])).map((k) => [k, request[k]])),
      contactUrl: 'https://www.hequbing.com/about.html#contact',
      contributionSkill: 'https://www.hequbing.com/observe/SKILL.md',
      paymentAvailable: false, note: '用户需要专业核验或咨询时自行联系；本动作未提交资料、未下单。' };
  }
  const entities = input.entities ?? industry.entities;
  need(Array.isArray(entities) && entities.length > 0, '实体数组不能为空');
  const entityIds = new Set();
  for (const e of entities) {
    need(text(e.id) && text(e.name) && !entityIds.has(e.id), '实体必须有唯一 id 和 name');
    need(e.aliases === undefined || (Array.isArray(e.aliases) && e.aliases.every(text)), '实体别名必须是非空字符串数组');
    entityIds.add(e.id);
  }
  need(Array.isArray(input.samples), 'samples 必须为数组');
  const promptMap = new Map(industry.prompts.map((p) => [p.id, p]));
  const retained = new Map();
  let failed = 0, duplicate = 0, synthetic = 0;
  for (const row of input.samples) {
    need(row && text(row.sampleId), '样本缺少 sampleId');
    if (row.synthetic) { synthetic++; continue; }
    if (row.error || row.finishReason === 'length' || !text(row.raw)) { failed++; continue; }
    need(row.industryId === industry.id, '样本行业与所选行业不一致');
    const prompt = promptMap.get(row.promptId);
    need(prompt && row.prompt === prompt.text, '样本题目与冻结题库不一致');
    need(text(row.engine) && text(row.model) && ['api', 'product_ui'].includes(row.channel), '样本须记录实际 engine、model 和 channel');
    need(text(row.ts) && Number.isFinite(Date.parse(row.ts)), '样本缺少有效时间');
    if (retained.has(row.sampleId)) {
      need(JSON.stringify(retained.get(row.sampleId)) === JSON.stringify(row), '同一 sampleId 存在冲突，不可静默覆盖');
      duplicate++; continue;
    }
    retained.set(row.sampleId, row);
  }
  const rows = [...retained.values()];
  // 不生成总榜：不同模型的题目覆盖不同，不能把数量多的模型自动加权。
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.engine, row.model, row.channel, row.webSearch ?? 'unknown', row.region ?? 'unknown', row.locale ?? 'unknown', row.batch ?? 'unknown']);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const byModel = [...groups.values()].map((group) => {
    const eligible = group.filter((r) => promptMap.get(r.promptId).purpose === 'ranking');
    const parsed = eligible.map((r) => ({ ...r, mentions: parseMentions(r.raw, entities) }));
    const summarize = (samples) => {
      const { metrics } = computeMetrics(samples, entities);
      return entities.map((e) => {
        const m = metrics.get(e.id);
        return { entityId: e.id, name: e.name, mentionSamples: m.mentionSamples, samples: m.samples, mentionRate: m.mentionRate,
          evidenceIds: samples.filter((r) => r.mentions.some((m) => m.entityId === e.id)).map((r) => r.sampleId) };
      });
    };
    return {
      engine: group[0].engine, model: group[0].model, channel: group[0].channel, webSearch: group[0].webSearch ?? 'unknown',
      region: group[0].region ?? 'unknown', locale: group[0].locale ?? 'unknown', batch: group[0].batch ?? 'unknown',
      samples: group.length, rankingSamples: eligible.length,
      promptCoverage: new Set(group.map((r) => r.promptId)).size,
      metrics: summarize(parsed),
      // 各题保留分母和原始证据；不同题覆盖不能解释成同行优劣。
      byPrompt: industry.prompts.filter((p) => p.purpose === 'ranking').map((p) => {
        const samples = parsed.filter((r) => r.promptId === p.id);
        return { promptId: p.id, prompt: p.text, samples: samples.length,
          evidenceIds: samples.map((r) => r.sampleId), metrics: summarize(samples) };
      }),
    };
  });
  return {
    schemaVersion: '0.2.0', industryId: industry.id, title: industry.title,
    status: rows.length ? 'observation_not_quality_ranking' : 'no_real_samples',
    coverage: { rawRows: input.samples.length, validSamples: rows.length, failedRows: failed, duplicateRows: duplicate, excludedSynthetic: synthetic, entityCount: entities.length },
    byModel,
    evidence: rows.map((r) => ({ ...r, purpose: promptMap.get(r.promptId).purpose })),
    warnings: ['仅统计传入实体；检查原回答是否漏收录其他公司。', '提及不代表推荐、资质认证或履约质量；零提及不代表企业不好。', '模型输出中的企业事实尚需一手来源核实。', '本结果不生成行业名次，未测量的指标保持未知。', '同题差异是观察，不证明由官网引起；官网核对由宿主执行，脚本未抓取网页。', '地区、语言或批次为 unknown 时需补充采样条件；跨组比较先核对覆盖与时间。'],
  };
}
