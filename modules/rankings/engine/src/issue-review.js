import { surveyAction } from './survey-actions.js';

/** 首期核对，不出名次；统计与抽取沿用 Skill 的唯一动作核心。 */
export function reviewIssue({ catalog, cohort, industryId, samples, repeats = 3, minModels = 2 }) {
  if (!Number.isInteger(repeats) || repeats < 1 || !Number.isInteger(minModels) || minModels < 2) throw new Error('无效采样门槛');
  const candidates = cohort.industries.find(i => i.id === industryId);
  if (!candidates) throw new Error('缺少候选核对清单');
  const report = surveyAction('survey.report', { industry: industryId, entities: candidates.entities, samples }, catalog);
  const modelIds = new Set(report.byModel.map(m => m.model));
  const cells = new Set();
  let validRuns = true;
  for (const sample of report.evidence) {
    if (sample.purpose !== 'ranking') continue;
    if (!Number.isInteger(sample.run) || sample.run < 1 || sample.run > repeats) validRuns = false;
    const key = JSON.stringify([sample.engine, sample.model, sample.channel, sample.webSearch, sample.region,
      sample.locale, sample.batch, sample.promptId, sample.run]);
    if (cells.has(key)) throw new Error('同一采样单元重复回答；不能用不同 sampleId 重复加权');
    cells.add(key);
  }
  const matrix = report.byModel.map(m => ({ model:m.model, engine:m.engine, channel:m.channel,
    batch:m.batch, region:m.region, webSearch:m.webSearch,
    prompts:m.byPrompt.map(p => ({ promptId:p.promptId, validAnswers:p.samples, target:repeats,
      missing:Math.max(0,repeats-p.samples), evidenceIds:p.evidenceIds })) }));
  const inIssue = report.evidence.every(r => new Date(Date.parse(r.ts) + 8*3600000).toISOString().slice(0,7) === cohort.issue);
  const balanced = validRuns && matrix.length >= minModels && modelIds.size >= minModels
    && matrix.every(m => m.prompts.every(p => p.validAnswers === repeats));
  const checks = [
    {id:'sampling_coverage',passed:balanced,detail:`至少 ${minModels} 个实际模型，每道推荐题各 ${repeats} 次独立回答；多采或少采均需核对。`},
    {id:'issue_window',passed:inIssue,detail:'仅接受本期北京时间内的回答。'},
    {id:'cohort_review',passed:false,detail:'候选主体、同业范围与别名需要逐项审核。'},
    {id:'unknown_entities',passed:false,detail:'人工查看原回答中的所有公司；旧教育行业发现器不能充当物流/工厂全量漏收录审查。'},
    {id:'extraction_review',passed:false,detail:'抽查提及与顺序，分清模型举例、推荐、误写和主体混淆。'},
    {id:'statistics_and_release',passed:false,detail:'复用排名引擎核对统计门槛、并列区间与公开证据；本动作不发布排名。'},
  ];
  return {actionId:'survey.issue.review',issue:cohort.issue,industryId,status:'review_required',reportable:false,
    coverage:report.coverage,matrix,checks,byModel:report.byModel,evidence:report.evidence,
    candidateReview:candidates, warnings:report.warnings};
}
