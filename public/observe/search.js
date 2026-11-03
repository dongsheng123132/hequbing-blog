// 无运行时依赖：浏览器筛选和 API 使用同一业务判据。
export function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '');
}
export function matchesCompany(company, input = {}) {
  const q = normalizeText(input.q);
  const text = [company.name, company.legalName, ...company.aliases, ...company.websites,
    company.summary, ...company.offerings.map((o) => o.title)].join(' ');
  if (q && !normalizeText(text).includes(q)) return false;
  if (!(input.category || input.destinationCountry || input.originCountry || input.mode)) return true;
  return company.offerings.some((o) => (!input.category || o.category === input.category) &&
    (!input.destinationCountry || o.route?.destinationCountry === input.destinationCountry) &&
    (!input.originCountry || o.route?.originCountry === input.originCountry) && (!input.mode || o.route?.mode === input.mode));
}
