import { createHash } from 'node:crypto';

// 企业目录可以扩充；付费计划只采用明确选定的行业与冻结题库版本。
export function paidSamplingScope(plan, sourceCatalog) {
  const { industryIds, catalogVersion, ...executionPlan } = plan;
  if (!Array.isArray(industryIds) || !industryIds.length || new Set(industryIds).size !== industryIds.length) {
    throw new Error('付费计划须指定不重复的行业 ID');
  }
  if (typeof catalogVersion !== 'string' || !catalogVersion.trim()) throw new Error('付费计划须指定冻结题库版本');
  const industries = industryIds.map(id => {
    const industry = sourceCatalog.industries.find(item => item.id === id);
    if (!industry) throw new Error(`付费计划行业不存在：${id}`);
    return industry;
  });
  const catalog = { ...sourceCatalog, version: catalogVersion, industries };
  // 选定内容与原两行业计划一致时保留旧指纹，已有采样目录可以继续断点补采。
  // 任一题目、候选或执行参数变化仍会改变指纹，原目录将拒绝混入新协议。
  const fingerprint = createHash('sha256').update(JSON.stringify({ plan: executionPlan, catalog })).digest('hex');
  return { catalog, fingerprint };
}
