import { actions } from './core.js';
import { schemas } from './schema.js';

export const bindings = [
  ['GET', '/companies', 'company.search'], ['GET', '/companies/{id}', 'company.get'],
  ['GET', '/companies/{id}/history', 'company.history'], ['GET', '/catalog', 'catalog.export'],
  ['POST', '/proposals/validate', 'proposal.validate'], ['POST', '/proposals', 'proposal.submit'],
  ['GET', '/proposals', 'proposal.list'], ['GET', '/proposals/{id}', 'proposal.get'],
  ['POST', '/proposals/{id}/review', 'proposal.review'], ['POST', '/inquiries/prepare', 'inquiry.prepare'],
];
export function normalizeBase(value = '/observe') {
  if (value === '' || value === '/') return '';
  if (!/^\/[a-zA-Z0-9/-]+$/.test(value) || value.includes('//') || value.includes('..')) throw new Error('basePath 需要安全的绝对路径');
  return value.replace(/\/$/, '');
}
export function manifest(basePath, transport = 'http') {
  const b = normalizeBase(basePath);
  return {
    name: '贺去病 · AI 品牌认知观察', version: '0.1.0', schemaVersion: '1.0', basePath: b,
    skill: `${b}/SKILL.md`, api: transport === 'http' ? `${b}/api/v1` : null, openapi: `${b}/openapi.json`, catalog: `${b}/catalog.json`,
    transport, github: { repository: 'dongsheng123132/hequbing-company-registry', issues: 'https://github.com/dongsheng123132/hequbing-company-registry/issues' },
    license: { data: 'CC-BY-4.0', terms: `${b}/DATA-LICENSE.md`, software: 'MIT' },
    capabilities: { search: true, contribution: true, correction: true, inquiryDraft: true, quoteSubmission: false, payment: false },
    actions: actions.map((a) => ({ ...a, http: transport === 'http' ? bindings.filter((v) => v[2] === a.id).map(([method, path]) => ({ method, path: `${b}/api/v1${path}` })) : [] })),
    dataPolicy: '仅企业公开资料；投稿须声明公开授权；收录不等于资质认证。私有需求不进入公开快照。',
    ranking: { status: 'separate-module', engine: 'ai-recognition-index', link: 'https://www.hequbing.com/observe/rankings/', notice: '已发布调查范围与进度；目录顺序不代表排名，采样不足时不出榜。' },
    extensions: { quotes: { status: 'reserved', required: ['companyId', 'offeringId', 'requestId', 'currency', 'unit', 'quantity', 'taxes', 'validUntil', 'visibility', 'expectedVersion', 'idempotencyKey'] } },
  };
}
export function openapi(basePath) {
  const paths = {};
  for (const [method, path, actionId] of bindings) {
    const action = actions.find((a) => a.id === actionId);
    const params = path.includes('{id}') ? [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] : [];
    if (actionId === 'company.search') for (const name of ['q', 'category', 'destinationCountry', 'originCountry', 'mode', 'limit', 'offset']) params.push({ name, in: 'query', schema: { type: 'string' } });
    if (actionId === 'proposal.list') params.push({ name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'accepted', 'rejected'] } });
    const entry = { operationId: actionId, summary: action.description, parameters: params,
      security: action.access === 'public' ? [] : [{ bearerAuth: [] }],
      responses: Object.fromEntries(['200', '400', '401', '403', '404', '409', '422', '429', '503'].map((code) => [code, { description: code === '200' ? '成功：{ok:true,data:...}' : '失败：{ok:false,error:{code,message,details?}}' }])) };
    if (method === 'POST') {
      let schema = actionId.startsWith('proposal.') ? schemas.proposal : schemas.inquiry;
      if (actionId === 'proposal.review') {
        schema = structuredClone(schemas.review); delete schema.properties.proposalId;
        schema.required = schema.required.filter((key) => key !== 'proposalId');
      }
      entry.requestBody = { required: true, content: { 'application/json': { schema } } };
    }
    (paths[path] ??= {})[method.toLowerCase()] = entry;
  }
  return { openapi: '3.1.0', info: { title: 'AI 品牌认知观察 · 企业资料 API', version: '0.1.0' },
    servers: [{ url: `${normalizeBase(basePath)}/api/v1` }], paths,
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } }, schemas } };
}
