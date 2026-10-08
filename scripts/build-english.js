#!/usr/bin/env node
'use strict';
// English page copy lives here; article translations live in posts.json.
// public/en/*.html is generated. Prices are read from the existing service data.
const fs = require('fs');
const path = require('path');
const { renderPersonal } = require('../lib/personal-pages');
const { WWW, BLOG, pagePairs, escapeHtml: esc, postUrl, alternateLinks } = require('../lib/localization');
const root = path.join(__dirname, '..');
const services = JSON.parse(fs.readFileSync(path.join(root, 'data/services.json'), 'utf8'));
const person = { '@type': 'Person', '@id': WWW + '/about#person', name: 'Hequbing (He Fangsheng / Dosen)', alternateName: ['贺去病', '贺方升'], url: WWW + '/en/about' };
const contact = '<p>Email <a href="mailto:hefangsheng@gmail.com">hefangsheng@gmail.com</a> or contact me on WeChat: <strong data-wechat-id>hecare888</strong>. Include your business, the problem you want to solve and any delivery constraints.</p>';
const englishServices = [
  { id: 'diagnosis', name: 'AI business diagnosis', duration: '1–2 weeks', description: 'Identify and prioritize practical opportunities.', items: ['Business interviews and a review of available data', 'A prioritized opportunity list with benefits, costs and risks', 'An initial implementation plan for one priority scenario', 'A management presentation and discussion'] },
  { id: 'pilot', name: 'AI growth pilot', duration: '3 months', description: 'Implement one core business scenario.', items: ['A working tool, agent or workflow for one agreed scenario', 'Team training and implementation support', 'Progress reviews and outcome evaluation', 'Delivery documentation and recommendations', 'Pilot fees can be credited toward a subsequent annual engagement'] },
  { id: 'annual', name: 'Annual growth partnership', duration: '12 months', description: 'Base consulting fee plus agreed performance compensation.', items: ['An annual AI roadmap and implementation across several scenarios', 'Ongoing support, dashboards and monthly reviews', 'Team capability development', 'Agree on performance metrics, baselines and attribution before signing'] },
];
function serviceData(id) {
  const item = [...services.consulting, ...services.dev, ...services.geo].find(s => s.id === id);
  if (!item) throw new Error('Missing service: ' + id);
  return item;
}
function amount(id) {
  const match = serviceData(id).price.match(/¥([\d,]+)/);
  if (!match) throw new Error('Missing CNY price: ' + id);
  return Number(match[1].replace(/,/g, ''));
}
function price(id) {
  return (serviceData(id).price.includes('起') ? 'From ' : '') + 'CNY ' + amount(id).toLocaleString('en-US');
}
function offer(id) {
  return { '@type': 'Offer', ...(serviceData(id).price.includes('起') ? { priceSpecification: { '@type': 'PriceSpecification', minPrice: amount(id), priceCurrency: 'CNY' } } : { price: String(amount(id)), priceCurrency: 'CNY' }) };
}
function tiers() {
  return '<div class="tier-grid">' + englishServices.map(s => `<div class="tier-card" id="${s.id}"><h3>${s.name}</h3><div class="tier-period">${s.duration}</div><div class="tier-price">${price(s.id)}</div><p>${s.description}</p><ul class="tier-list">${s.items.map(i => '<li>' + i + '</li>').join('')}</ul><a class="btn btn-outline" href="mailto:hefangsheng@gmail.com">Discuss this service</a></div>`).join('') + '</div>';
}
function cards(posts) {
  return '<div class="mini-grid">' + posts.map(p => `<div class="mini-card"><h3><a href="${postUrl(p.slug, 'en')}">${esc(p.translations.en.title)}</a></h3><p>${esc(p.translations.en.summary)}</p></div>`).join('\n') + '</div>';
}
function section(title, body, id = '') {
  return `<section${id ? ' id="' + id + '"' : ''}><h2 class="section-title">${title}</h2>${body}</section>`;
}
function faq(items) {
  return '<div class="faq-details">' + items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('') + '</div>';
}
function buildEnglish(posts) {
  const translated = posts.filter(p => p.translations && p.translations.en);
  const org = { '@type': 'Organization', '@id': WWW + '/#org', name: 'Hequbing Business Consulting', alternateName: '贺去病商业咨询', url: WWW + '/en', founder: person, email: 'hefangsheng@gmail.com' };
  const pages = {
    'services.html': {
      title: 'AI consulting & development services | Hequbing Business Consulting',
      description: `Business consulting: ${price('diagnosis')} diagnosis, ${price('pilot')} pilot and annual partnership ${price('annual')}. AI development: POC ${price('poc')}.`,
      eyebrow: 'SERVICES & PRICING', heading: 'From a business question to working AI',
      intro: 'Business consulting and technical project delivery have separate scopes. All listed prices are in Chinese yuan (CNY). Agree on the deliverables and acceptance criteria before work starts.',
      body: section('Business consulting', '<p class="section-lede">Start with diagnosis, continue with one pilot and consider an annual partnership when the scope supports it. Each stage is a separate decision.</p>' + tiers() + '<p class="note">Annual performance compensation is additional to the base fee. Define the metric, baseline, calculation and attribution in the contract. The consulting offer is described in my <a href="' + postUrl('ai-business-consulting-process', 'en') + '">engagement process article</a>; it is not presented as a completed client growth case.</p>', 'consulting') +
        section('AI development and delivery', '<p class="section-lede">For a defined technical requirement, commission a project with an agreed delivery scope.</p><div class="mini-grid"><div class="mini-card"><h3>Proof of concept</h3><div class="price">' + price('poc') + '</div><p>1–2 weeks. A working prototype, evaluation, technical risk review and recommendations for further development.</p></div><div class="mini-card"><h3>Custom development</h3><div class="price">Quoted by scope</div><p>Agents, workflow automation, internal AI tools and model API integration. Confirm requirements before a fixed project quote.</p></div><div class="mini-card"><h3>Tool deployment and training</h3><div class="price">Quoted by team size</div><p>Configure tools such as Claude Code and Codex, then train people for their roles. Remote support is available. See <a href="' + postUrl('uking-installation-engineering', 'en') + '">U-King engineering notes</a>.</p></div><div class="mini-card"><h3>Document consistency review</h3><div class="price">Free trial; full project by agreement</div><p>Review numbering, references, terminology and merge omissions in long documents. Trial results within 48 hours; agree on the materials and scope first.</p></div></div>', 'dev') +
        section('GEO and discovery', '<p>A free visibility check and a scoped 90-day optimization service are available. <a href="' + WWW + '/en/geo">See GEO scope, prices and evaluation</a>.</p>') +
        section('How we work together', '<div class="prose"><p>We agree on the problem, inputs, budget, working environment and acceptance criteria. I work from Shenzhen; remote collaboration is available, with travel arranged for agreed implementation stages.</p><p>Start with anonymized or aggregate data where possible. Discuss deployment, access permissions, confidential information and ongoing support as part of the scope.</p></div>' + faq([
          ['What does the diagnosis deliver?', 'A prioritized opportunity list, an initial implementation plan for one scenario, and a management presentation. It is a defined 1–2 week project.'],
          ['How is performance compensation calculated?', 'Agree in advance on the metric, baseline, measurement period and attribution. An annual fee does not itself establish a business outcome.'],
          ['Can we commission technical work directly?', 'Yes. A defined proof of concept or custom development project is separate from business consulting.'],
          ['Can we work remotely?', 'Yes. Confirm the collaboration schedule, system access and any on-site work during scoping.'],
        ])) + section('Discuss your requirements', contact, 'contact'),
      schema: [{ '@type': 'ItemList', name: 'AI consulting and development services', itemListElement: [...englishServices.map(s => ({ '@type': 'Service', name: s.name, description: s.description + ' ' + s.duration, provider: { '@id': WWW + '/#org' }, url: WWW + '/en/services#' + s.id, offers: offer(s.id) })), { '@type': 'Service', name: 'AI proof of concept', provider: { '@id': WWW + '/#org' }, url: WWW + '/en/services#dev', offers: offer('poc') }].map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) }],
    },
    'geo.html': {
      title: 'GEO services: AI visibility, citations & evaluation | Hequbing',
      description: `Generative engine optimization based on real business information. Free visibility check and 90-day optimization ${price('geo-90d')}, with transparent measurement and no ranking guarantee.`,
      eyebrow: 'GENERATIVE ENGINE OPTIMIZATION', heading: 'Help relevant customers discover your business',
      intro: 'GEO organizes accurate business information so AI search can find, describe or cite it when answering relevant questions. Visibility needs observation; it is not a promise of recommendations or orders.',
      body: section('SEO and GEO work together', '<div class="prose"><p>SEO improves discovery through search engines. GEO adds observation of AI answers, mentions and citations. Both depend on accessible pages, useful original information and a clear explanation of what a business can do.</p><p>Different platforms use different information sources and search modes. Record the actual platform and conditions rather than assuming one search provider or a universal ranking formula.</p></div>') +
        section('What the work involves', '<ol class="prose"><li>Define the customer questions and establish an observation baseline.</li><li>Verify the business identity, products, service boundaries, evidence and contacts.</li><li>Make the website accessible and publish content that answers specific questions.</li><li>Distribute appropriate material and observe mentions, accuracy and citations.</li><li>Review qualified inquiries and improve the response process alongside the content.</li></ol>') +
        section('Measure three separate layers', '<div class="mini-grid"><div class="mini-card"><h3>Agreed delivery</h3><p>Pages, content, technical fixes and training completed against defined acceptance criteria.</p></div><div class="mini-card"><h3>Observed discoverability</h3><p>Mentions, accurate descriptions and citation sources across repeated observations, with dates, platforms and test conditions.</p></div><div class="mini-card"><h3>Business results</h3><p>Qualified inquiries, quotations and sales, with evidence of the source where available. Unknown attribution stays unknown.</p></div></div><p class="note">A 90-day cycle is an implementation and review schedule. It does not guarantee platform recommendations. See the <a href="' + postUrl('geo-delivery-discovery-business', 'en') + '">detailed evaluation method</a>.</p>', 'measure') +
        section('Scope and pricing', '<div class="mini-grid"><div class="mini-card"><h3>AI visibility quick check</h3><div class="price">Free</div><p>10 questions across 5 AI platforms. Send your company name, industry and main customer need to arrange the check.</p></div><div class="mini-card"><h3>GEO diagnosis and 90-day optimization</h3><div class="price">' + price('geo-90d') + '</div><p>Scope-based quote. Baseline report covering 50 questions across 7 platforms, website improvements, 10–12 useful question-led articles, distribution and monthly monitoring reports.</p></div><div class="mini-card"><h3>Within an AI growth pilot</h3><div class="price">' + price('pilot') + '</div><p>3 months. Make GEO and inquiry conversion the core scenario of a broader <a href="' + WWW + '/en/services#pilot">growth pilot</a>.</p></div></div><p class="note">All prices are CNY. Content starts with verifiable business materials; fabricated evidence and manipulative bulk content are excluded.</p>', 'pricing') +
        section('Sources and practical limits', '<div class="prose"><p><a href="https://developers.google.com/search/docs/fundamentals/ai-optimization-guide">Google guidance on AI search</a> emphasizes accessible, original and useful content alongside SEO fundamentals. It does not require a special AI file or a universal content format. This guidance describes Google, not every AI platform.</p><p>This website provides practice notes and a public service scope. Indexing gains, increased citations and inquiries for this brand have not yet been measured.</p></div>' + faq([
          ['How soon will results appear?', 'Use a defined review cycle and repeated observations. There is no guaranteed date for an AI platform to cite or recommend a business.'],
          ['Does an English edition guarantee international visibility?', 'An English edition helps readers access the material in English. Search indexing, rankings, citations and inquiries need separate measurement.'],
          ['Is one screenshot enough?', 'No. Preserve the full answer, query, date, platform and conditions, and repeat observations. Also evaluate accuracy and actual inquiry quality.'],
        ])) + section('Arrange a visibility check', contact, 'contact'),
      schema: [{ '@type': 'Service', name: 'GEO diagnosis and 90-day optimization', serviceType: 'Generative engine optimization', provider: { '@id': WWW + '/#org' }, offers: offer('geo-90d'), url: WWW + '/en/geo' }],
    },
    'archive.html': {
      title: 'English articles | Hequbing: AI tools, implementation & GEO',
      description: `${translated.length} English practice articles from Hequbing: AI tools, engineering evidence, business consulting, supply chains and GEO.`,
      eyebrow: 'ENGLISH ARTICLES', heading: 'AI projects and implementation notes',
      intro: `${translated.length} selected English editions, with sources and evidence boundaries. The Chinese archive contains ${posts.length} articles.`,
      body: section('Selected English editions', cards(translated)) + section('More in Chinese', '<p><a href="' + BLOG + '/archive">Browse all Chinese articles</a>. English editions use the same article identity and include a link to their corresponding Chinese version.</p>'),
      schema: [{ '@type': 'CollectionPage', name: 'Hequbing English articles', inLanguage: 'en', url: BLOG + '/en/archive', mainEntity: { '@type': 'ItemList', itemListElement: translated.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: postUrl(p.slug, 'en'), name: p.translations.en.title })) } }],
    },
  };
  const out = path.join(root, 'public/en');
  fs.mkdirSync(out, { recursive: true });
  for (const pair of pagePairs) {
    if (pair.file === 'index.html' || pair.file === 'about.html') {
      fs.writeFileSync(path.join(out, pair.file), renderPersonal(pair.file.replace('.html', ''), 'en', posts), 'utf8');
      continue;
    }
    const p = pages[pair.file];
    const schema = JSON.stringify({ '@context': 'https://schema.org', '@graph': p.schema }).replace(/</g, '\\u003c');
    const nav = [['index.html', WWW + '/en', 'Home'], ['services.html', WWW + '/en/services', 'Services'], ['geo.html', WWW + '/en/geo', 'GEO'], ['about.html', WWW + '/en/about', 'About'], ['archive.html', BLOG + '/en/archive', 'Articles']].map(([file, url, label]) => `<a href="${url}"${file === pair.file ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('\n          ');
    const switchLink = `<a href="${pair.zh}" lang="zh-CN" aria-label="Read this page in Chinese">中文</a>`;
    const html = `<!DOCTYPE html>
<!-- Generated by scripts/build-english.js. Edit that source, then run npm run build. -->
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.description)}" />
  <link rel="canonical" href="${pair.en}" />
  ${alternateLinks(pair.zh, pair.en)}
  <meta property="og:title" content="${esc(p.title)}" />
  <meta property="og:description" content="${esc(p.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pair.en}" />
  <meta property="og:locale" content="en_US" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <script type="application/ld+json">${schema}</script>
</head>
<body>
  <header class="site-header"><div class="container"><div class="header-row">
    <div class="site-title"><a class="brand" href="${WWW}/en"><span class="brand-name">Hequbing<small>BUSINESS CONSULTING</small></span></a></div>
    <nav class="nav" aria-label="Main navigation">${nav}
          ${switchLink}</nav>
  </div></div></header>
  <main class="container">
    <section class="hero page-hero"><p class="hero-eyebrow">${p.eyebrow}</p><h1>${p.heading}</h1><p class="hero-sub">${p.intro}</p><div class="hero-cta"><a class="btn btn-primary" href="mailto:hefangsheng@gmail.com">Contact Hequbing</a><a class="btn btn-outline" href="${WWW}/en/services">Services and pricing</a></div></section>
    ${p.body}
  </main>
  <footer class="site-footer"><div class="container"><div class="footer-content"><span>© <span id="year">2026</span> Hequbing Business Consulting</span><div class="footer-links"><a href="${WWW}/en/about">About</a><a href="${BLOG}/en/archive">Articles</a>${switchLink}</div></div></div></footer>
  <script src="/site.js"></script>
</body>
</html>
`;
    const file = path.join(out, pair.file);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html) fs.writeFileSync(file, html, 'utf8');
  }
}
module.exports = { buildEnglish };
