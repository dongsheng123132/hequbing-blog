import { normalizeBase } from './contracts.js';
import { catalogStyle } from './catalog-style.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const labels = { 'power-cords':'电源线', 'international-logistics':'国际物流', 'cable-harnesses':'定制线束', 'industrial-design':'工业设计' };
const rankingsUrl = 'https://www.hequbing.com/observe/rankings/';
const domain = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const external = 'target="_blank" rel="noopener noreferrer"';

function offeringView(o) {
  const countries = { CN:'中国', PH:'菲律宾' };
  const modes = { sea:'海运', air:'空运', road:'陆运', rail:'铁路' };
  return `<section class="offering"><h3>${esc(o.title)}</h3>
  ${o.route ? `<p class="route">${esc(countries[o.route.originCountry] || o.route.originCountry)} / ${esc(o.route.originCity || '城市待确认')} → ${esc(countries[o.route.destinationCountry] || o.route.destinationCountry)} / ${esc(o.route.destinationCity || '城市待确认')} · ${esc(modes[o.route.mode] || o.route.mode)}</p>` : ''}
  <p>${esc(o.description)}</p><h4>询价前建议准备</h4><ul class="inquiry-fields">${o.inquiryFields.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
  <a class="text-link" href="${esc(o.inquiryUrl)}" ${external} data-action-id="inquiry.external">前往企业原站确认报价 ↗</a>
  </section>`;
}

function companyView({ company:c, version }) {
  const categories = [...new Set(c.offerings.map(o => labels[o.category] || o.category))];
  const website = c.websites[0];
  return `<article class="company" data-company-id="${esc(c.id)}">
    <div class="company-main">
      <div class="company-index"><span class="company-category">${categories.map(esc).join(' / ')}</span><span class="company-code">${esc(c.id).toUpperCase()}</span></div>
      <div class="company-intro"><h2>${esc(c.name)}</h2><p class="legal">${esc(c.legalName || '法律主体待确认')}</p><div class="business-overview" aria-label="已收录业务">${c.offerings.map(o=>`<span>${esc(o.title)}</span>`).join('')}</div></div>
      <div class="company-access">${website ? `<a class="website-link" href="${esc(website)}" ${external}>访问企业官网 <span aria-hidden="true">↗</span></a><span class="website-domain">${esc(domain(website))}</span>` : ''}<span class="source-status">来源已记录 · 待独立核验</span></div>
    </div>
    <div class="company-details">
      <details><summary>业务与询价信息 <span>${c.offerings.length} 项业务</span></summary><div class="detail-body">${c.offerings.map(offeringView).join('')}<p>实际价格与条款由企业确认，本站暂不接收订单。</p></div></details>
      <details><summary>来源与档案说明 <span>${c.evidence.length} 条来源</span></summary><div class="detail-body"><h3>资料摘要</h3><p>${esc(c.summary)}</p>
      ${c.evidence.map(e=>`<div class="source-item"><a class="text-link" href="${esc(e.url)}" ${external}>${esc(domain(e.url))} ↗</a><p>${esc(e.note)}</p><small>来源记录日期 ${esc(e.observedAt)}</small></div>`).join('')}
      <h3>待确认事项</h3><ul>${c.unknowns.map(u=>`<li>${esc(u)}</li>`).join('')}</ul>
      <a class="data-link" href="companies/${esc(c.id)}.json" data-action-id="company.get">读取完整 JSON <span>档案版本 ${esc(version)} ↗</span></a></div></details>
    </div>
  </article>`;
}

export function renderCatalog(catalog, basePath = '/observe', transport = 'http') {
  const b = normalizeBase(basePath);
  const categories = [...new Set(catalog.records.flatMap(({company:c}) => c.offerings.map(o => o.category)))];
  const intro = transport === 'github'
    ? `当前通过 <a href="https://github.com/dongsheng123132/hequbing-company-registry/issues/new?template=company.yml">GitHub 提交资料</a>；你的 AI 可以用自己的 GitHub 授权投稿。维护者审核后更新公开快照，API 契约供自托管服务使用。`
    : '投稿 API 需要维护者发放的独立令牌；在线投稿由配套服务处理。';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><base href="${b}/"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="贺去病企业档案：查询企业业务、官网与资料来源，探索品牌在 AI 中的认知。"><title>企业档案 · 贺去病品牌 AI 认知榜</title><style>${catalogStyle}</style></head>
  <body><a class="skip-link" href="#directory">跳转至企业档案</a><header class="shell"><nav class="site-nav" aria-label="主导航">
  <a class="brand" href="${rankingsUrl}" aria-label="贺去病品牌 AI 认知榜首页"><span class="brand-seal" aria-hidden="true">贺</span><span class="brand-copy"><span class="brand-name">贺去病</span><span class="brand-subtitle">品牌 AI 认知榜</span></span></a>
  <div class="nav-links"><a href="${rankingsUrl}">行业观察</a><a href="${b}/" aria-current="page">企业档案</a><a href="${rankingsUrl}methodology.html">研究方法</a><a href="https://www.hequbing.com/about.html#contact">联系我们</a></div></nav>
  <section class="hero" aria-labelledby="page-title"><div><p class="eyebrow"><span>OPEN COMPANY ARCHIVE</span> 开放企业资料</p><h1 id="page-title">企业档案</h1><p class="hero-intro">从业务到来源，了解一家企业。<br>为商业判断，也为 AI 查询，建立清晰、可追溯的事实基础。</p><p class="hero-note">持续收录与更新 · 企业可提交资料、补充来源及发起纠错</p></div>
  <aside class="archive-stamp" aria-label="档案概况"><div class="archive-label">ARCHIVE / 公开档案</div><div class="archive-stats"><div class="archive-stat"><strong>${String(catalog.records.length).padStart(2,'0')}</strong><span>已收录企业</span></div><div class="archive-stat"><strong>${String(categories.length).padStart(2,'0')}</strong><span>业务类别</span></div></div><div class="archive-foot">资料修订 ${esc(catalog.revision)} · 开放查询 / 来源可溯</div></aside></section></header>
  <main class="shell" id="directory"><section class="directory-section" aria-labelledby="directory-title"><div class="section-head"><h2 id="directory-title">浏览企业</h2><p>按企业 ID 排列，顺序不代表排名</p></div>
  <div class="toolbar"><label class="search-field"><svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input type="search" id="search" aria-label="搜索企业名称或域名" placeholder="搜索企业名称或官网域名" data-action-id="company.search"></label><label class="select-field"><span>业务类别</span><select id="category" aria-label="业务类别"><option value="">全部业务</option>${categories.map(c=>`<option value="${esc(c)}">${esc(labels[c]||c)}</option>`).join('')}</select></label><span id="count" class="toolbar-count" aria-live="polite">${catalog.records.length} 家企业</span></div>
  <div class="companies">${catalog.records.map(companyView).join('')}</div><p class="empty" id="empty" hidden>暂未收录匹配企业。可以让你的 AI 提交有来源的资料。</p>
  <div class="method-note"><p>${esc(catalog.notice)} 资料来源及待确认事项见各企业档案；行业认知表现由独立调查呈现。</p><a class="text-link" href="${rankingsUrl}">查看行业 AI 认知观察 →</a></div></section>
  <section class="open-data" aria-labelledby="data-title"><div><p class="eyebrow">CONTRIBUTE & OPEN DATA</p><h2 id="data-title">资料贡献与开放数据</h2><p>让企业的公开事实持续被看见。<br>将贡献 Skill 交给你的 AI，查重、提交、更新与纠错。</p></div><div class="data-actions"><a href="SKILL.md" data-action-id="skill.read">获取贡献 Skill <span>↗</span></a><a href="catalog.json" data-action-id="catalog.export">下载企业数据 <span>↓</span></a><a href="manifest.json">能力清单 <span>↗</span></a><a href="openapi.json">API 契约 <span>↗</span></a><a href="schemas/proposal.json">投稿规则 <span>↗</span></a><a href="examples/proposal.json">投稿示例 <span>↗</span></a><a href="examples/inquiry.json">询价草稿示例 <span>↗</span></a><p class="contribution-note">${intro}</p></div></section></main>
  <footer class="shell footer"><div><strong>贺去病 · 品牌 AI 认知榜</strong><p>观察 AI 如何理解商业世界。</p></div><div class="footer-links"><span>数据修订 ${esc(catalog.revision)}</span><a href="DATA-LICENSE.md">资料使用说明</a><a href="https://creativecommons.org/licenses/by/4.0/">公开企业资料 CC BY 4.0</a></div></footer>
  <script type="application/json" id="company-data">${JSON.stringify(catalog.records.map(r=>r.company)).replace(/</g,'\\u003c')}</script>
  <script type="module">import {matchesCompany} from '${b}/search.js';const records=new Map(JSON.parse(document.querySelector('#company-data').textContent).map(c=>[c.id,c]));const search=document.querySelector('#search'),category=document.querySelector('#category');function filter(){let n=0;document.querySelectorAll('.company').forEach(c=>{c.hidden=!matchesCompany(records.get(c.dataset.companyId),{q:search.value,category:category.value});if(!c.hidden)n++});document.querySelector('#count').textContent=n+' 家企业';document.querySelector('#empty').hidden=n>0}search.addEventListener('input',filter);category.addEventListener('change',filter);</script></body></html>`;
}
