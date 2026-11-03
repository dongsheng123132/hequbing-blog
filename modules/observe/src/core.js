import { createHash, randomUUID } from 'node:crypto';
import { validate, validateCompany, proposalSchema, reviewSchema, inquirySchema } from './schema.js';
import { RegistryError } from './store.js';
import { normalizeText as normal, matchesCompany } from './search.js';

export const actions = [
  { id: 'company.search', access: 'public', description: '按类别、国家路线和关键词查询；固定按 ID 排序，不代表推荐名次' },
  { id: 'company.get', access: 'public', description: '获取企业、产品服务、证据与版本' },
  { id: 'company.history', access: 'public', description: '查询已发布的企业资料变更历史' },
  { id: 'catalog.export', access: 'public', description: '导出公开快照；排除投稿、身份令牌和私有询价' },
  { id: 'proposal.validate', access: 'public', description: '校验格式、证据引用、冲突与疑似重复' },
  { id: 'proposal.submit', access: 'contributor', description: '提交待核验资料；不会直接覆盖企业记录' },
  { id: 'proposal.get', access: 'contributor', description: '读取自己的提交与处理结果' },
  { id: 'proposal.list', access: 'reviewer', description: '维护者审核队列' },
  { id: 'proposal.review', access: 'reviewer', description: '接受／拒绝提交；保留所有已发布版本' },
  { id: 'inquiry.prepare', access: 'public', description: '生成询价草稿和缺项清单；不发送、不报价、不存储需求' },
];
function requireRole(actor, role) {
  if (role === 'public') return;
  if (!actor?.id) throw new RegistryError('UNAUTHORIZED', '需要贡献者令牌。', 401);
  if (!['contributor', 'reviewer'].includes(actor.role)) throw new RegistryError('FORBIDDEN', '身份角色不合法。', 403);
  if (role === 'reviewer' && actor.role !== 'reviewer') throw new RegistryError('FORBIDDEN', '需要维护者权限。', 403);
}
function assertSchema(schema, input) {
  const errors = validate(schema, input);
  if (errors.length) throw new RegistryError('VALIDATION_ERROR', '数据格式不符合契约。', 422, errors);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  return value;
}
export const hash = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const publicRecord = ({ history, ...record }) => record;
const host = (u) => new URL(u).hostname.toLowerCase().replace(/^www\./, '');
function findDuplicates(state, company) {
  return Object.values(state.companies).filter((r) => r.company.id !== company.id).filter(({ company: other }) => {
    const names = [company.name, company.legalName, ...company.aliases].filter(Boolean).map(normal);
    return [other.name, other.legalName, ...other.aliases].filter(Boolean).some((n) => names.includes(normal(n))) ||
      other.websites.some((u) => company.websites.some((v) => host(u) === host(v)));
  }).map(({ company }) => ({ id: company.id, name: company.name }));
}
function checkProposal(state, input) {
  assertSchema(proposalSchema, input);
  const errors = validateCompany(input.company);
  if (errors.length) throw new RegistryError('VALIDATION_ERROR', '企业资料不符合契约。', 422, errors);
  const current = Object.hasOwn(state.companies, input.company.id) ? state.companies[input.company.id] : undefined;
  if (input.operation === 'create' && (input.expectedVersion !== 0 || current)) throw new RegistryError('VERSION_CONFLICT', '新增企业必须不存在且 expectedVersion 为 0。', 409);
  if (input.operation === 'replace' && (!current || current.version !== input.expectedVersion)) throw new RegistryError('VERSION_CONFLICT', '资料已变化，请读取最新版本后重新提交完整记录。', 409, { currentVersion: current?.version ?? null });
  const duplicates = findDuplicates(state, input.company);
  if (duplicates.length) throw new RegistryError('POSSIBLE_DUPLICATE', '发现同名或同域名企业；请核对后更正已有记录。', 409, duplicates);
  return { valid: true, currentVersion: current?.version ?? 0, warnings: ['证据链接仅记录来源，尚未独立核验。'] };
}
function getCompany(state, id) {
  const record = Object.hasOwn(state.companies, id) ? state.companies[id] : undefined;
  if (!record) throw new RegistryError('NOT_FOUND', '未找到企业。', 404);
  return record;
}
function getProposal(state, id, actor) {
  const proposal = Object.hasOwn(state.proposals, id) ? state.proposals[id] : undefined;
  if (!proposal || (actor.role !== 'reviewer' && proposal.actorId !== actor.id)) throw new RegistryError('NOT_FOUND', '未找到提交。', 404);
  return proposal;
}
function search(state, input) {
  const limit = input.limit === undefined ? 20 : Number(input.limit);
  const offset = input.offset === undefined ? 0 : Number(input.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new RegistryError('VALIDATION_ERROR', 'limit 为 1–100，offset 为非负整数。', 422);
  const rows = Object.values(state.companies).filter(({ company }) => matchesCompany(company, input)).sort((a, b) => a.company.id.localeCompare(b.company.id, 'en'));
  return { total: rows.length, offset, limit, revision: state.revision, order: 'id', items: rows.slice(offset, offset + limit).map(publicRecord) };
}
export async function execute(store, action, input = {}, actor = null) {
  const definition = actions.find((a) => a.id === action);
  if (!definition) throw new RegistryError('UNKNOWN_ACTION', '未知业务动作。', 404);
  requireRole(actor, definition.access);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RegistryError('VALIDATION_ERROR', '输入必须为 JSON 对象。', 422);
  if (action === 'proposal.submit') {
    assertSchema(proposalSchema, input);
    return store.update((state) => {
      const digest = hash(input);
      const prior = Object.values(state.proposals).find((p) => p.actorId === actor.id && p.payload.idempotencyKey === input.idempotencyKey);
      if (prior) {
        if (prior.digest !== digest) throw new RegistryError('IDEMPOTENCY_CONFLICT', '同一幂等键对应了不同内容。', 409);
        return prior;
      }
      checkProposal(state, input);
      const proposal = { id: `p-${randomUUID()}`, version: 1, actorId: actor.id, status: 'pending', digest, payload: input, createdAt: new Date().toISOString() };
      state.proposals[proposal.id] = proposal;
      return proposal;
    });
  }
  if (action === 'proposal.review') {
    assertSchema(reviewSchema, input);
    return store.update((state) => {
      const p = getProposal(state, input.proposalId, actor);
      if (p.status !== 'pending' || p.version !== input.expectedProposalVersion) throw new RegistryError('VERSION_CONFLICT', '提交已被处理或版本过期。', 409);
      const now = new Date().toISOString();
      if (input.decision === 'accept') {
        checkProposal(state, p.payload);
        const old = state.companies[p.payload.company.id];
        const version = (old?.version ?? 0) + 1;
        const record = { company: p.payload.company, version, verification: 'source_recorded', publishedAt: old?.publishedAt ?? now,
          updatedAt: now, history: [...(old?.history ?? []), { version, at: now, company: p.payload.company }] };
        state.companies[record.company.id] = record;
      }
      Object.assign(p, { status: input.decision === 'accept' ? 'accepted' : 'rejected', version: p.version + 1,
        reviewedAt: now, review: { actorId: actor.id, note: input.note } });
      return p;
    });
  }
  const state = await store.load();
  switch (action) {
    case 'company.search': return search(state, input);
    case 'company.get': return publicRecord(getCompany(state, input.id));
    case 'company.history': return { companyId: input.id, versions: getCompany(state, input.id).history };
    case 'catalog.export': {
      const records = Object.values(state.companies).sort((a, b) => a.company.id.localeCompare(b.company.id, 'en')).map(publicRecord);
      return { schemaVersion: '1.0', revision: state.revision, records, contentHash: hash(records),
        notice: '首批为发起人提供的来源资料；收录不等于认证、推荐或排名。来源内容未经独立核验。' };
    }
    case 'proposal.validate': return checkProposal(state, input);
    case 'proposal.get': return getProposal(state, input.id, actor);
    case 'proposal.list': return { items: Object.values(state.proposals).filter((p) => !input.status || p.status === input.status) };
    case 'inquiry.prepare': {
      assertSchema(inquirySchema, input);
      const c = getCompany(state, input.companyId).company;
      const o = c.offerings.find((item) => item.id === input.offeringId);
      if (!o) throw new RegistryError('NOT_FOUND', '未找到产品／服务。', 404);
      const fields = new Set(input.requirements.filter((r) => r.value.trim()).map((r) => r.field));
      return { status: 'draft', sent: false, companyId: c.id, offeringId: o.id,
        requirements: input.requirements, missingFields: o.inquiryFields.filter((f) => !fields.has(f)),
        inquiryUrl: o.inquiryUrl, price: null, notice: '询价草稿未发送；价格、币种、计价单位、税费及有效期须由供应商确认。' };
    }
  }
}
