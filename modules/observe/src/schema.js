// 数据契约同时用于运行时校验、OpenAPI 和公开 JSON Schema，避免三份规则漂移。
const text = (maxLength = 200) => ({ type: 'string', minLength: 1, maxLength });
const id = { ...text(80), pattern: '^[a-z0-9][a-z0-9-]*$' };
const url = { ...text(1500), format: 'uri', pattern: '^https://' };
const date = { type: 'string', format: 'date' };
const list = (items, maxItems = 100) => ({ type: 'array', items, maxItems });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const country = { type: 'string', pattern: '^[A-Z]{2}$' };
export const evidenceSchema = obj({
  id, url, sourceType: { enum: ['company_website', 'official_register', 'third_party', 'owner_supplied'] },
  observedAt: date, note: text(1000),
});
export const offeringSchema = obj({
  id, kind: { enum: ['product', 'logistics', 'advisory'] }, category: id, title: text(),
  description: text(1500), evidenceIds: { ...list(id, 20), minItems: 1 },
  route: obj({ originCountry: country, originCity: nullable(text()), destinationCountry: country,
    destinationCity: nullable(text()), mode: { enum: ['sea', 'air', 'road', 'rail', 'multimodal'] } }),
  inquiryUrl: url, inquiryFields: list(text(100), 30),
}, ['id', 'kind', 'category', 'title', 'description', 'evidenceIds', 'inquiryUrl', 'inquiryFields']);
export const companySchema = obj({
  id, name: text(), legalName: nullable(text()), aliases: list(text(), 30), websites: { ...list(url, 10), minItems: 1 },
  country, categories: { ...list(id, 30), minItems: 1 }, summary: text(2000),
  evidence: { ...list(evidenceSchema, 50), minItems: 1 }, offerings: list(offeringSchema),
  facts: list(obj({ field: text(120), value: text(1500), evidenceIds: { ...list(id, 20), minItems: 1 },
    validUntil: nullable(date) }), 100),
  unknowns: list(text(300), 40),
});
export const proposalSchema = obj({
  schemaVersion: { const: '1.0' }, operation: { enum: ['create', 'replace'] }, company: companySchema,
  expectedVersion: { type: 'integer', minimum: 0 }, idempotencyKey: { ...text(120), minLength: 8 },
  reason: text(1500), publicationConsent: { const: true },
});
export const reviewSchema = obj({
  proposalId: id, expectedProposalVersion: { type: 'integer', minimum: 1 },
  decision: { enum: ['accept', 'reject'] }, note: text(1500),
});
export const inquirySchema = obj({
  companyId: id, offeringId: id, requirements: list(obj({ field: text(100), value: text(1000) }), 40),
}, ['companyId', 'offeringId', 'requirements']);
export const schemas = { company: companySchema, proposal: proposalSchema, review: reviewSchema, inquiry: inquirySchema };

export function validate(schema, value, path = '$', errors = []) {
  if (schema.anyOf) {
    if (!schema.anyOf.some((s) => validate(s, value, path, []).length === 0)) errors.push({ path, message: '类型不符合契约' });
    return errors;
  }
  const fail = (message) => errors.push({ path, message });
  if ('const' in schema && value !== schema.const) fail(`必须为 ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(`必须为 ${schema.enum.join(' / ')}`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && (schema.type === 'integer' ? !Number.isSafeInteger(value) : type !== schema.type)) {
    fail(`需要 ${schema.type}`); return errors;
  }
  if (type === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push({ path: `${path}.${key}`, message: '缺少字段' });
    for (const [key, v] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) { fail('不允许的字段'); continue; }
      if (schema.properties?.[key]) validate(schema.properties[key], v, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push({ path: `${path}.${key}`, message: '未知字段' });
    }
  }
  if (type === 'array') {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail('数组长度越界');
    value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  }
  if (type === 'string') {
    if (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity) || (schema.minLength && !value.trim())) fail('文本长度不合法');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('格式不合法');
    if (schema.format === 'uri') {
      try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password) fail('需要不含凭据的 HTTPS URL'); } catch { fail('URL 不合法'); }
    }
    if (schema.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) fail('日期不合法');
  }
  if (typeof value === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity))) fail('数值不合法');
  return errors;
}

export function validateCompany(company) {
  const errors = validate(companySchema, company);
  if (errors.length) return errors;
  const refs = new Set(company.evidence.map((e) => e.id));
  if ([company.id, ...refs, ...company.offerings.map((o) => o.id)].some((v) => ['constructor', 'prototype', '__proto__'].includes(v))) errors.push({ path: '$.id', message: '保留 ID 不可使用' });
  if (refs.size !== company.evidence.length) errors.push({ path: '$.evidence', message: '证据 ID 重复' });
  if (new Set(company.offerings.map((o) => o.id)).size !== company.offerings.length) errors.push({ path: '$.offerings', message: '产品／服务 ID 重复' });
  for (const item of [...company.facts, ...company.offerings]) {
    if (item.evidenceIds.some((e) => !refs.has(e))) errors.push({ path: '$.evidenceIds', message: '引用了不存在的证据' });
  }
  for (const o of company.offerings) {
    if ((o.kind === 'logistics') !== Boolean(o.route)) errors.push({ path: '$.offerings.route', message: '物流服务必须有路线；其他类型不得带路线' });
  }
  return errors;
}
