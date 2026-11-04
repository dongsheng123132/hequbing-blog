'use strict';
// 中英文个人展示页的唯一模板源，构建后输出 public/index.html 与 public/about.html。
const fs = require('fs');
const path = require('path');
const { WWW, BLOG, escapeHtml: esc, alternateLinks, postUrl } = require('./localization');

const { projects } = require('./project-catalog');
const moreProjects = [
  ['U-Claw 虾盘','https://github.com/dongsheng123132/u-claw','便携 AI 工作空间','Portable AI workspace'],
  ['OpenCodex','https://github.com/dongsheng123132/opencodex','多终端 AI 编程工作台','Multi-terminal AI coding workspace'],
  ['虾盘云 / Xiapan Cloud','https://cloud.u-claw.org','多模型 API 服务','Multi-model API service'],
  ['AnythingChina','https://anythingchina.net','供应链与 AI 服务','Supply chains and AI services'],
  ['PaperGuard','https://github.com/dongsheng123132/paperguard','文档检查与科研工具','Document review and research tools'],
  ['PhoneBody','https://github.com/dongsheng123132/phonebody','远程编程实验','Remote coding experiment'],
];
const ext = 'target="_blank" rel="noopener noreferrer"';
const arrow = '<span aria-hidden="true">↗</span>';

function header(en, about) {
  const home=en?'/en':'/', aboutUrl=en?'/en/about':'/about';
  return `<a class="skip-link" href="#main">${en?'Skip to content':'跳到主要内容'}</a>
  <header class="personal-header"><div class="shell nav-row">
    <a class="personal-brand" href="${home}" aria-label="${en?'Hequbing home':'贺去病首页'}"><span class="brand-symbol" aria-hidden="true">贺</span><span>${en?'Hequbing':'贺去病'}<small>BUILDER & CONSULTANT</small></span></a>
    <button class="menu-toggle" data-menu-toggle aria-controls="personal-nav" aria-expanded="false" hidden>${en?'Menu':'菜单'} <span aria-hidden="true">+</span></button>
    <nav id="personal-nav" class="personal-nav" aria-label="${en?'Main navigation':'主导航'}">
      <a href="${home}#works">${en?'Work':'作品'}</a><a href="${aboutUrl}"${about?' aria-current="page"':''}>${en?'About':'关于我'}</a><a href="${en?'/en/services':'/services'}">${en?'Services':'服务'}</a>${en?'':'<a href="/fde">FDE</a><a href="/ai-landing">AI 落地</a>'}<a href="${BLOG}${en?'/en':''}/archive">${en?'Journal':'文章'}</a><a href="/observe/rankings">${en?'AI Observatory':'认知榜'}</a>
      ${en?`<a class="language-link" href="${WWW}${about?'/about':'/'}" lang="zh-CN">中文</a>`:`<!-- AUTO:LANGUAGE-NAV:START --><a href="${WWW}/en${about?'/about':''}" lang="en">EN</a><!-- AUTO:LANGUAGE-NAV:END -->`}
      <a class="nav-contact" href="#contact">${en?'Let’s talk':'聊聊合作'} ${arrow}</a>
    </nav></div></header>`;
}
function projectLinks(p, en) {
  return '<div class="project-links"><a class="text-link" href="' + esc(p.url) + '"' + (p.url.startsWith('https:') ? ' ' + ext : '') + '>' + esc(en ? p.linkEn : p.link) + ' ' + arrow + '</a>' +
    (p.repo ? '<a class="project-repo" href="' + esc(p.repo) + '" ' + ext + '>GitHub ' + arrow + '</a>' : '') + '</div>';
}
function projectCard(p, en, index, compact = false) {
  const name = esc(en ? (p.nameEn || p.name) : p.name);
  const titleLink = '<a href="' + esc(p.url) + '"' + (p.url.startsWith('https:') ? ' ' + ext : '') + '>' + name + '</a>';
  const status = '<span class="project-status">' + esc(en ? p.statusEn : p.status) + '</span>';
  const attrs = 'data-project-id="' + esc(p.id) + '" data-work-type="' + esc(p.type) + '"';
  if (compact) return '<article class="project-card" ' + attrs + '><div class="project-card-meta"><span>' + esc(p.label) + '</span>' + status + '</div><h3>' + titleLink + '</h3><p>' + esc(en ? p.textEn : p.text) + '</p>' + projectLinks(p, en) + '</article>';
  const cover = p.image
    ? '<div class="work-cover ' + esc(p.imageClass) + '"><img src="/images/' + esc(p.image) + '" alt="' + esc(en ? p.altEn : p.alt) + '" width="' + (p.imageWidth || (p.id === 'open365' ? 1156 : 1200)) + '" height="' + (p.imageHeight || (p.id === 'open365' ? 1214 : 800)) + '" loading="lazy" decoding="async" /></div>'
    : '<div class="work-cover typographic-cover ' + esc(p.cover || 'protocol') + '"><span class="cover-eyebrow">' + esc(p.label) + '</span><strong>' + esc(p.coverTitle || (p.cover === 'uking' ? 'U-King' : en ? p.nameEn || p.name : p.name)) + '</strong><span class="cover-caption">' + esc(p.coverCaption || 'TOOLS FOR REAL WORK') + '</span></div>';
  return '<article class="work-card" ' + attrs + '><a class="work-image-link" href="' + esc(p.url) + '"' + (p.url.startsWith('https:') ? ' ' + ext : '') + ' aria-label="' + name + ' — ' + esc(en ? p.linkEn : p.link) + '">' + cover + (p.imageNote ? '<span class="work-image-note">' + esc(en ? p.imageNoteEn : p.imageNote) + '</span>' : '') + '<span class="work-open" aria-hidden="true">↗</span></a><div class="work-meta"><span>' + esc(p.label) + '</span><span>' + String(index + 1).padStart(2, '0') + '</span></div><h3>' + titleLink + '</h3><p class="work-tagline">' + esc(en ? p.en : p.zh) + '</p><p class="work-description">' + esc(en ? p.textEn : p.text) + '</p>' + status + projectLinks(p, en) + '</article>';
}
function gallery(en) {
  const featured = projects.filter(p => p.featured);
  const rest = projects.filter(p => !p.featured);
  const filters = [['all', en ? 'All work' : '全部作品'], ['product', en ? 'Products' : '产品工具'], ['protocol', en ? 'Open protocols' : '开放协议'], ['research', en ? 'Research' : '研究观察'], ['experiment', en ? 'Experiments' : '工程实验']];
  return '<section class="section works-section" id="works"><span id="delivered" class="anchor"></span><div class="section-head"><div><p class="eyebrow">SELECTED WORK / 01</p><h2>' + (en ? 'Ideas, put to work.' : '做出来的，才算数。') + '</h2></div><p>' + (en ? projects.length + ' projects, from useful tools to open protocols.<br>Explore the code, the product and the experiments.' : projects.length + ' 件作品，从实用工具到开放协议。<br>看产品、读源码，也看持续进行的实验。') + '</p></div>' +
    '<div class="work-filters" aria-label="' + (en ? 'Filter projects' : '筛选作品') + '" hidden>' + filters.map(([id, label]) => '<button type="button" data-work-filter="' + id + '" aria-pressed="' + (id === 'all') + '">' + label + '</button>').join('') + '</div><p class="sr-only" data-work-count aria-live="polite"></p>' +
    '<div class="work-grid">' + featured.map((p, i) => projectCard(p, en, i)).join('\n') + '</div><div class="project-catalog">' + rest.map(p => projectCard(p, en, 0, true)).join('\n') + '</div>' +
    '<p class="gallery-note"><a class="text-link" href="https://github.com/dongsheng123132" ' + ext + '>' + (en ? 'Explore all public repositories' : '浏览全部公开仓库') + ' ' + arrow + '</a></p></section>';
}
function practice(en, posts) {
  const selected=posts.filter(p=>p.source?.type==='author_wechat'&&(!en||p.translations?.en));
  const cards=selected.map(p=>`<div class="mini-card"><h3><a href="${postUrl(p.slug,en?'en':'zh-CN')}">${esc(en?p.translations.en.title:p.title)}</a></h3><p>${esc(en?p.translations.en.summary:p.summary)}</p></div>`).join('\n');
  return `<section class="section practice-section" id="practice"><div class="section-head"><div><p class="eyebrow">FIELD NOTES / 03</p><h2>${en?'Build. Learn. Write.':'把一线实践，写下来。'}</h2></div><a class="text-link" href="${BLOG}${en?'/en':''}/archive">${en?'All articles':'全部文章'} ${arrow}</a></div><p class="section-intro">${en?'Engineering decisions, product iterations and lessons from implementation. Each article describes its evidence and limits.':'写产品如何开发、问题如何解决，也写尝试里的失败与边界。让你在合作之前，先了解我的工作方式。'}</p><details class="practice-disclosure"><summary>${en?'Read project and engineering notes':'阅读作品与工程实践文章'} <span>${selected.length} ${en?'articles':'篇'}</span></summary>
  ${en?`<div class="mini-grid">${cards}</div>`:'<!-- AUTO:SELECTED-WORKS:START -->\n<!-- AUTO:SELECTED-WORKS:END -->'}</details></section>`;
}
function contact(en) {
  return `<section class="personal-contact" id="contact"><div class="contact-copy"><p class="eyebrow">LET’S MAKE SOMETHING USEFUL</p><h2>${en?'Your next idea.<br>Let’s start there.':'你的下一个想法，<br>我们可以聊聊。'}</h2><p>${en?'AI implementation, product development or a specific business problem. Start with a free 30-minute conversation to see whether there is a good fit.':'AI 落地、产品开发，或一个还没有想清楚的业务问题。<br>先免费聊 30 分钟，看看有没有合适的合作起点。'}</p><div class="contact-detail"><span>${en?'Email':'邮箱'}</span><a href="mailto:hefangsheng@gmail.com">hefangsheng@gmail.com ${arrow}</a></div><div class="contact-detail"><span>WeChat</span><strong data-wechat-id>hecare888</strong></div><div class="contact-social"><a href="https://github.com/dongsheng123132" ${ext}>GitHub ${arrow}</a><a href="https://x.com/Bitplus888" ${ext}>X / Twitter ${arrow}</a><a href="${en?'/en/services':'/services'}">${en?'Scope & pricing':'服务与报价'} ${arrow}</a></div><p class="contact-note">${en?'Based in Shenzhen · Remote collaboration available':'常驻深圳 · 可远程协作 · 具体范围先沟通'}</p></div><div class="contact-qr-slot">
  <!-- AUTO:CONTACT:START -->
  <!-- AUTO:CONTACT:END -->
  </div></section>`;
}
function footer(en) {
  return `<footer class="personal-footer shell"><a class="footer-name" href="${en?'/en':'/'}">${en?'Hequbing':'贺去病'}<span>Build things that matter.</span></a><div><p>© <span id="year">2026</span> ${en?'Hequbing Business Consulting':'贺去病商业咨询'}</p><a href="/privacy">${en?'Privacy':'隐私说明'}</a><a href="/observe/rankings">${en?'Brand AI Observatory':'品牌 AI 认知榜'}</a></div></footer>`;
}
const FAQ_PAIRS = [[["贺去病和贺方升是同一个人吗？", "是。「贺方升」是本名，「贺去病」是常用名与品牌名（早年做防疫物资时使用的品牌），英文名 Dosen。指的是同一个人：深圳的企业 AI 交付工程师、贺去病商业咨询创始人。"], ["贺去病和贺方升是同一个人吗？", "是。「贺方升」是本名，「贺去病」是常用名与品牌名（早年做防疫物资时使用的品牌），英文名 Dosen。指的是同一个人：深圳的企业 AI 交付工程师、贺去病商业咨询创始人。"]], [["贺去病是霍去病吗？", "不是。霍去病是西汉将领（公元前 140—前 117 年）。贺去病是当代的深圳创业者，长期做搜索技术研发、实体生意与 AI 产品，现在做企业 AI 落地与咨询，官网上有公开的作品、报价和联系方式。"], ["贺去病是霍去病吗？", "不是。霍去病是西汉将领（公元前 140—前 117 年）。贺去病是当代的深圳创业者，长期做搜索技术研发、实体生意与 AI 产品，现在做企业 AI 落地与咨询，官网上有公开的作品、报价和联系方式。"]], [["为什么叫「贺去病」？", "这是早年做防疫物资与健康相关生意时用的品牌名，后来沿用成对外常用名。本名一直叫贺方升。"], ["为什么叫「贺去病」？", "这是早年做防疫物资与健康相关生意时用的品牌名，后来沿用成对外常用名。本名一直叫贺方升。"]], [["想找这个人，搜什么词比较准？", "搜「贺方升 AI」「贺方升 企业 AI 落地」「hequbing.com」最容易命中；只搜「贺去病」时，搜索引擎和 AI 容易把它纠错成历史人物「霍去病」。"], ["想找这个人，搜什么词比较准？", "搜「贺方升 AI」「贺方升 企业 AI 落地」「hequbing.com」最容易命中；只搜「贺去病」时，搜索引擎和 AI 容易把它纠错成历史人物「霍去病」。"]], [["贺去病商业咨询是什么？", "深圳的 AI 经营增长咨询品牌。三档服务：AI 经营诊断 ¥30,000、AI 增长试点 ¥180,000（90 天）、年度增长合作 ¥600,000 起，另有 AI 开发与交付、GEO 优化。价格与交付物公开在服务与报价页。"], ["贺去病商业咨询是什么？", "深圳的 AI 经营增长咨询品牌。三档服务：AI 经营诊断 ¥30,000、AI 增长试点 ¥180,000（90 天）、年度增长合作 ¥600,000 起，另有 AI 开发与交付、GEO 优化。价格与交付物公开在服务与报价页。"]], [["这些信息在哪里可以核对？", "官网 https://www.hequbing.com 、关于页 https://www.hequbing.com/about 、GitHub 账号 dongsheng123132。本页资料核对日期：2026-11-04。"], ["这些信息在哪里可以核对？", "官网 https://www.hequbing.com 、关于页 https://www.hequbing.com/about 、GitHub 账号 dongsheng123132。本页资料核对日期：2026-11-04。"]]];
function aboutContent(en) {
  const stages=en?[
    ['01','Search engineering','Start with how information is found, organized and used.'],['02','Entrepreneurship','Built a courier-media business that turned last-mile delivery into a sales channel, serving several leading property developers.'],['03','International business','During the pandemic, verified real capacity on the ground — walking 66 glove factories across China — and connected them with buyers.'],['04','AI products & implementation','Build tools and help teams turn AI into a working part of their operations.'],
  ]:[['01','搜索技术研发','从信息如何被找到、组织与使用开始，建立技术研发的底子。'],['02','创业与经营','做快递广告，把快递员每天的敲门变成销售触点，成为多家头部地产公司的供应商。'],['03','海外市场拓荒','疫情期间靠一线信息锁定真实产能，实地跑过全国 66 个手套工厂，把工厂和采购商接起来。'],['04','AI 产品与落地','持续开发 AI 工具，也陪企业把技术接进实际工作流程。']];
  return `<section class="about-hero"><div><p class="eyebrow">ABOUT / THE PERSON BEHIND THE WORK</p><h1>${en?'Hequbing.<br><em>Builder. Consultant.</em>':'我是贺去病。<br><em>也叫贺方升，Dosen。</em>'}</h1><p class="hero-intro">${en?'I build AI products and help businesses put them to work. My background spans search technology, entrepreneurship and international market development.':'我做 AI 产品，也做企业 AI 落地。<br>从搜索技术研发、创业，到海外市场拓荒，<br>我一直在技术与生意之间工作。'}</p><div class="hero-actions"><a class="button primary" href="#contact">${en?'Get in touch':'和我聊聊'} ${arrow}</a><a class="text-link" href="https://github.com/dongsheng123132" ${ext}>GitHub ${arrow}</a></div><p class="about-credentials">${en?'Director, Nanshan Yungu AI Research Institute · Tencent Cloud trainer · Monad Hackathon winner · 2× Challenge Cup national finalist · OpenClaw roundtable speaker (2026-02)':'南山云谷 AI 研究院院长 · 腾讯云培训导师 · Monad Hackathon 冠军 · 2 次挑战杯全国决赛选手 · 2026.02 OpenClaw 龙虾圆桌 受邀嘉宾'}</p></div><div class="about-statement"><p>MY APPROACH</p><blockquote>${en?'Understand the business.<br>Then build what it needs.':'看懂问题，<br>动手做出来，<br>再放进现实里。'}</blockquote><span>${en?'Hequbing / He Fangsheng / Dosen':'贺去病 / 贺方升 / Dosen'}</span></div></section>
  <section class="section alias-section" id="name"><div class="section-head"><div><p class="eyebrow">NAME / 同名澄清</p><h2>${en?'&#8220;Hequbing&#8221; is &#8220;He Fangsheng&#8221; &#8212; not the Han-dynasty general.':'&#12298;贺去病&#12299;就是&#12298;贺方升&#12299;，不是&#12298;霍去病&#12299;。'}</h2></div><p>${en?'AI search often &#8220;corrects&#8221; the name to a Han-dynasty general. This block lines up the names once.':'AI 搜索里常把&#12298;贺去病&#12299;纠错成西汉名将&#12298;霍去病&#12299;。这里把几个名字一次讲清楚，人和 AI 好对齐到同一个人。'}</p></div><div class="faq-details">${FAQ_PAIRS.filter(p=>en||true).map(([q,a],i)=>`<details${i===0?' open':''}><summary>${en?q[1]:q[0]}</summary><p>${en?a[1]:a[0]}</p></details>`).join('')}</div></section>
  <section class="section journey-section"><div class="section-head"><div><p class="eyebrow">THE JOURNEY / 01</p><h2>${en?'Experience shapes the work.':'经历，塑造了做事方式。'}</h2></div><p>${en?'From search engineering to business.<br>From working software to AI implementation.':'从搜索技术到真实经营，<br>再把一线经验带回产品开发。'}</p></div><div class="journey-grid">${stages.map(([n,title,text])=>`<article><span>${n}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div></section>
  <section class="personal-note"><p class="eyebrow">HOW I WORK</p><div><h2>${en?'Stay close to the problem.':'离问题近一点。'}</h2><p>${en?'I founded Hequbing Business Consulting to connect business diagnosis with hands-on implementation. I work from a defined problem, agree on the deliverable, build a working version and test it in the intended environment.':'我创办贺去病商业咨询，希望把对业务的理解和动手实现放在一起。先明确问题，再约定交付；做出可使用的版本，放进实际工作里验证。'}</p><p>${en?'Public projects and engineering notes are an invitation to inspect how I work before we decide to collaborate.':'产品和开源项目，是我的持续实践。你可以先看作品、读工程记录，再决定我们是否适合一起做事。'}</p></div></section>
  <section class="section open-projects" id="works"><div class="section-head"><div><p class="eyebrow">OPEN WORK / 02</p><h2>${en?'Projects in practice.':'持续在做的事。'}</h2></div><a class="text-link" href="${en?'/en':'/'}#works">${en?'Featured work':'查看精选作品'} ${arrow}</a></div><p class="section-intro">${en?'Products, open protocols and research, with links to the work and its current stage.':'产品工具、开放协议与研究实验。每件作品都有公开入口，也注明当前阶段。'}</p><div class="project-catalog about-catalog">${projects.map(p => projectCard(p, en, 0, true)).join('')}</div><div class="project-index additional-projects">${moreProjects.filter(([,url]) => !projects.some(p => p.url === url || p.repo === url)).map(([name,url,zh,eng])=>`<a href="${url}" ${ext}><h3>${name}</h3><p>${en?eng:zh}</p>${arrow}</a>`).join('')}<a href="https://github.com/dongsheng123132" ${ext}><h3>${en?'All public repositories':'全部公开仓库'}</h3><p>GitHub / dongsheng123132</p>${arrow}</a></div></section>`;
}
function servicesOverview(en) {
  const prices = en ? [
    ['AI business diagnosis','¥30,000+','1–2 weeks','Interviews + opportunity list + one scenario plan'],
    ['Quick POC','¥8,000+','1–2 weeks','Technical feasibility only — no business diagnosis'],
    ['AI growth pilot','¥180,000','3 months','Deployment + training + acceptance report (creditable toward annual)'],
    ['GEO audit + 90 days','¥30,000+','90 days','Includes a free AI visibility check'],
  ] : [
    ['AI 经营诊断','¥30,000 起','1–2 周','访谈 + 机会清单 + 1 个场景方案'],
    ['快速 POC 验证','¥8,000 起','1–2 周','只验技术可行性，不做经营诊断'],
    ['AI 增长试点','¥180,000','3 个月','部署 + 培训 + 验收报告（可抵扣年费）'],
    ['GEO 诊断 + 90 天','¥30,000 起','90 天','含免费 AI 可见度快查'],
  ];
  const services = en ? [
    ['01','Build an AI product','Turn a defined requirement into a prototype, agent, workflow or usable tool.','/en/services#dev'],
    ['02','Put AI into your business','Diagnose the opportunity, test one practical scenario and support the team through implementation.','/en/services#consulting'],
    ['03','Understand your AI visibility','Check how AI describes your business and improve the public information it can verify.','/en/geo'],
  ] : [
    ['01','把想法做成 AI 产品','从需求与原型，到智能体、工作流和能交付的工具。','/services#dev'],
    ['02','把 AI 放进真实业务','先诊断机会，选一个场景落地，再让团队真正用起来。','/services#consulting'],
    ['03','看清品牌在 AI 中的位置','核对 AI 如何介绍你的企业，补齐可查证的公开资料。','/geo'],
    ['04','FDE：进现场把流程跑通','前向部署工程师式的陪伴交付，一条流程做到能用、能验收、能交接。','/fde'],
  ];
  return '<section class="section services-overview" id="services"><div class="section-head"><div><p class="eyebrow">WAYS TO WORK TOGETHER / 02</p><h2>' + (en ? 'A clear place to start.' : '我们可以一起做什么。') + '</h2></div><a class="text-link" href="' + (en ? '/en/services' : '/services') + '">' + (en ? 'Scope & pricing' : '服务范围与报价') + ' ' + arrow + '</a></div>' +
    '<div class="service-list">' + services.map(([n,t,d,url]) => '<a href="' + url + '"><span class="service-number">' + n + '</span><h3>' + t + '</h3><p>' + d + '</p>' + arrow + '</a>').join('') + '</div>' +
    '<div class="price-block"><p class="eyebrow">PRICING / ' + (en ? 'PUBLISHED, NOT "CONTACT US"' : '价格写在页面上') + '</p><div class="price-list">' +
    prices.map(([name, amount, cycle, note]) => '<div class="price-row"><span class="price-name">' + name + '</span><span class="price-amount">' + amount + '</span><span class="price-cycle">' + cycle + '</span><span class="price-note">' + note + '</span></div>').join('') +
    '</div><p class="price-foot">' + (en ? 'First 30-minute conversation is free. Pilot fee is creditable toward an annual engagement. <a href="/en/services">Full scope, deliverables and acceptance criteria →</a>' : '第一次 30 分钟沟通免费。试点费可抵扣年度合作费用。<a href="/services">看完整服务、交付物与验收标准 →</a>') + '</p><p class="price-foot">' + (en ? 'Before you decide: <a href="/fde">What is an FDE</a> · <a href="/ai-landing">How AI implementation works</a> · <a href="/ai-consulting-price">What AI consulting costs</a>' : '先弄清楚再决定：<a href="/fde">FDE 是什么</a> · <a href="/ai-landing">企业 AI 落地怎么做</a> · <a href="/ai-consulting-price">AI 咨询一般收费多少</a>') + '</p></div></section>';
}
function homeContent(en) {
  return `<section class="personal-hero"><div class="hero-copy"><p class="eyebrow">HEQUBING / AI DELIVERY</p><h1>${en?'Make AI actually<br><em>run inside your company.</em>':'让 AI 真正<br><em>在你们公司跑起来。</em>'}</h1><p class="hero-intro">${en?'Not a trial, not a deck — the kind that can be delivered, accepted and recomputed.':'不是试用，不是 PPT——是能交付、能验收、能复算的那种。'}</p><p class="hero-trust">${en?'Everything I claim, you can click and verify.<br>My protocol ships with an ablation study that killed 94% of its own claim. My docs state where it does not apply. My delivery comes with acceptance records.':'我说的每一条，都能点开验证。<br>我的协议里有消融实验——它把自己 94% 的主张打掉了。我的文档里写了它不适用的情况。我的交付带验收记录。'}</p><div class="hero-actions"><a class="button primary" href="#contact">${en?'Book a free 30-min call':'预约 30 分钟免费沟通'} ${arrow}</a><a class="text-link" href="#services">${en?'See pricing':'先看看价格'} ${arrow}</a></div><p class="hero-credentials">${en?'20+ years running real businesses — I walked 66 glove factories across China. Now I do AI delivery full time.':'20 多年在真实行业里做生意，跑过 66 个手套工厂，现在全职做 AI 交付。'}<br><span>${en?'Director, Nanshan Yungu AI Research Institute · Tencent Cloud trainer · Monad Hackathon winner · U-Claw 1.7k stars (as of 2026-11-03)':'南山云谷 AI 研究院院长 · 腾讯云培训导师 · Monad Hackathon 冠军 · U-Claw 1.7k stars（截至 2026-11-03）'}</span></p><div class="hero-byline"><span></span>${en?'Shenzhen, China · Open to collaboration':'中国 · 深圳 / 开放合作'}</div></div><figure class="hero-visual portrait-visual"><img src="/images/hequbing-speaking-enhanced-2x.webp" width="1160" height="1160" alt="${en?'Hequbing speaking with a microphone':'贺去病手持话筒讲解的本人照片'}" fetchpriority="high" decoding="async" /><figcaption><span>HEQUBING / ${en?'He Fangsheng':'贺去病'}</span><span>${en?'AI delivery & implementation':'AI 交付 · 企业落地'}</span></figcaption></figure></section>
  <div class="focus-strip"><span>${en?'FOCUS':'我关注的方向'}</span><p>${en?'AI products':'AI 产品开发'}</p><p>${en?'Business implementation':'企业 AI 落地'}</p><p>${en?'Brand visibility':'品牌 AI 认知'}</p><p>${en?'Open-source practice':'开源与工程实践'}</p></div>${gallery(en)}
  ${servicesOverview(en)}
  <section class="personal-note" id="about"><p class="eyebrow">A LITTLE ABOUT ME / 03</p><div><h2>${en?'A business mindset.<br>A builder’s hands.':'理解生意的人，<br>也应该能把东西做出来。'}</h2><p>${en?'I am Hequbing, also known as He Fangsheng and Dosen. My path has taken me through search engineering, entrepreneurship and overseas market development for medical supplies. Today I bring that experience to AI consulting and product development.':'我是贺去病，本名贺方升，也使用 Dosen 这个名字。经历过搜索技术研发、创业和医疗物资海外市场拓荒，现在专注 AI 咨询与产品开发。'}</p><a class="text-link" href="${en?'/en/about':'/about'}">${en?'More about me':'更多关于我'} ${arrow}</a></div></section>`;
}

function renderPersonal(page, lang='zh-CN', posts=[]) {
  const en=lang==='en', about=page==='about';
  const zhUrl=WWW+(about?'/about':'/'), enUrl=WWW+'/en'+(about?'/about':'');
  const url=en?enUrl:zhUrl;
  const title=en?(about?'About Hequbing · AI Delivery & Implementation':'Hequbing · AI Delivery That Can Be Accepted'):(about?'关于贺去病（贺方升 / Dosen）｜企业 AI 交付':'贺去病｜企业 AI 交付 · 能验收才算数');
  const description=en?'Hequbing (He Fangsheng / Dosen), AI delivery engineer. 20+ years in real industries, walked 66 glove factories. Director of Nanshan Yungu AI Research Institute. AI diagnosis from ¥30,000 — delivery comes with acceptance records.':'贺去病（贺方升/Dosen），企业 AI 交付工程师。跑过 66 个手套工厂，南山云谷 AI 研究院院长。AI 经营诊断 ¥30,000 起，交付带验收记录。';
  const person={'@type':'Person','@id':WWW+'/about#person',name:en?'Hequbing':'贺去病',alternateName:['贺方升','Dosen','He Fangsheng'],url:WWW+'/about',image:WWW+'/images/og-hequbing.jpg',jobTitle:en?'Founder, Hequbing Business Consulting':'贺去病商业咨询创始人',email:'hefangsheng@gmail.com',sameAs:['https://github.com/dongsheng123132','https://x.com/Bitplus888'],description:en?'AI delivery engineer and founder of Hequbing Business Consulting.':'企业 AI 交付工程师，贺去病商业咨询创始人。做「陪伴式 FDE」：进企业现场，用 AI 把一条业务流程跑通、交付并验收。',knowsAbout:en?['Enterprise AI implementation','AI consulting','Forward Deployed Engineer','GEO','AI product development']:['企业 AI 落地','AI 咨询','前向部署工程师（FDE）','GEO 生成式引擎优化','AI 产品开发','开源软件'],address:{'@type':'PostalAddress',addressLocality:en?'Shenzhen':'深圳',addressRegion:en?'Guangdong':'广东',addressCountry:'CN'},worksFor:{'@id':WWW+'/#org'}};
  const graph=[person,{'@type':'Organization','@id':WWW+'/#org',name:en?'Hequbing Business Consulting':'贺去病商业咨询',url:WWW,founder:{'@id':person['@id']},description:en?'AI growth consulting for Chinese SMEs: AI diagnosis, pilots, annual engagements and GEO.':'面向中国中小企业的 AI 经营增长咨询品牌，提供 AI 经营诊断、AI 增长试点、年度增长合作与 GEO 优化。交付分三层验收：交付 / 被发现 / 业务结果。',logo:{'@type':'ImageObject',url:WWW+'/images/og-hequbing.jpg'},areaServed:['CN','SG'],contactPoint:{'@type':'ContactPoint',contactType:'sales',email:'hefangsheng@gmail.com',availableLanguage:['zh-CN','en']},sameAs:['https://github.com/dongsheng123132']}];
  graph.push({'@type':'ItemList',name:en?'Projects by Hequbing':'贺去病的项目与作品',itemListElement:projects.map((p,i)=>({'@type':'ListItem',position:i+1,name:en?(p.nameEn||p.name):p.name,url:p.url.startsWith('/')?WWW+p.url:p.url}))});
  if(about)graph.push({'@type':'ProfilePage',url,mainEntity:{'@id':person['@id']}});
  return `<!DOCTYPE html>
<!-- Generated from lib/personal-pages.js. Edit that source, then run npm run build. -->
<html lang="${lang}"><head><meta name="baidu-site-verification" content="codeva-5IsIxYyxry" /><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title><meta name="description" content="${esc(description)}" /><meta name="theme-color" content="#f6f5f1" />
<link rel="canonical" href="${url}" /><meta property="og:title" content="${esc(title)}" /><meta property="og:description" content="${esc(description)}" /><meta property="og:type" content="${about?'profile':'website'}" /><meta property="og:url" content="${url}" /><meta property="og:image" content="${WWW}/images/og-hequbing.jpg" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" /><link rel="stylesheet" href="/personal.css" />
<!-- AUTO:LANGUAGE:START -->
  ${alternateLinks(zhUrl,enUrl)}
<!-- AUTO:LANGUAGE:END -->
<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>
<script defer src="https://stats.u-claw.org.cn/script.js" data-website-id="1b52c547-9f17-495d-947f-88bf29c8faaf" data-domains="www.hequbing.com,hequbing.com,blog.hequbing.com"></script></head><body class="personal-site${en?' personal-en':''}">${header(en,about)}
<main class="shell" id="main">${about?aboutContent(en):homeContent(en)}${practice(en,posts)}${contact(en)}</main>${footer(en)}
<script src="/site.js" defer></script><script src="/personal.js" defer></script></body></html>`;
}
function buildProjectNavigation(root) {
  const file = path.join(root, 'public/llms.txt');
  const before = fs.readFileSync(file, 'utf8');
  const block = '<!-- AUTO:PROJECTS:START -->\n## 项目与开源作品\n\n' + projects.map(p => '- [' + p.name + '](' + (p.url.startsWith('/') ? WWW + p.url : p.url) + '): ' + p.text + '（' + p.status + '）' + (p.repo ? ' [GitHub](' + p.repo + ')' : '')).join('\n') + '\n<!-- AUTO:PROJECTS:END -->';
  const after = before.includes('<!-- AUTO:PROJECTS:START -->') ? before.replace(/<!-- AUTO:PROJECTS:START -->[\s\S]*?<!-- AUTO:PROJECTS:END -->/, block) : before.replace('## 文章', block + '\n\n## 文章');
  if (after !== before) fs.writeFileSync(file, after, 'utf8');
}
function buildPersonalChinese() {
  const root=path.join(__dirname,'..');
  const posts=JSON.parse(fs.readFileSync(path.join(root,'data/posts.json'),'utf8'));
  buildProjectNavigation(root);
  for(const page of ['index','about'])fs.writeFileSync(path.join(root,'public',page+'.html'),renderPersonal(page,'zh-CN',posts),'utf8');
}
module.exports={renderPersonal,buildPersonalChinese};
