'use strict';
// 中英文个人展示页的唯一模板源，构建后输出 public/index.html 与 public/about.html。
const fs = require('fs');
const path = require('path');
const { WWW, BLOG, escapeHtml: esc, alternateLinks, postUrl } = require('./localization');

const projects = [
  { id:'uclaw', type:'product', name:'U-Claw 虾盘', nameEn:'U-Claw', zh:'把 AI 工作空间，装进 U 盘。', en:'An AI workspace that travels with you.', text:'便携 U 盘工作空间，让配置、记忆与会话随身带走。公开源码，持续迭代。', textEn:'A portable USB workspace that keeps AI configuration, memory and sessions together. Open source and under active development.', url:'https://github.com/dongsheng123132/u-claw', label:'PORTABLE AI / OPEN SOURCE', image:'uclaw-project-concept.webp', imageClass:'product-concept-cover', imageWidth:1672, imageHeight:941, alt:'U-Claw 公开仓库的便携 AI 项目概念图', altEn:'U-Claw portable AI concept artwork from its public repository', imageNote:'项目概念图', imageNoteEn:'Project concept', link:'了解虾盘与当前版本', linkEn:'Explore U-Claw' },
  { id:'uking', type:'product', name:'U-King', zh:'AI 工具，从安装到使用。', en:'AI tools, from setup to everyday use.', text:'把 AI 工具部署、模型配置与使用支持，做成能交付的产品。', textEn:'A product for deploying AI tools, configuring models and supporting day-to-day use.', url:'https://www.u-king.org', label:'AI TOOLS', cover:'uking', link:'进入产品官网', linkEn:'Visit the product' },
  { id:'opencodex', type:'product', name:'OpenCodex', zh:'多个 AI 编程终端，同屏协作。', en:'Multiple AI coding terminals, one workspace.', text:'以项目文件夹为起点，在同一工作台分屏运行 AI 编程终端。当前为持续迭代的早期版本。', textEn:'Open a project folder and work with multiple AI coding terminals in a split-screen workspace. An early version under active development.', url:'https://github.com/dongsheng123132/opencodex', label:'AI CODING / OPEN SOURCE', image:'opencodex-workspace-example.png', imageClass:'app-example-cover', imageWidth:2880, imageHeight:1700, alt:'OpenCodex 仓库展示的多终端工作台界面示例', altEn:'Multi-terminal workspace example from the OpenCodex repository', imageNote:'仓库界面示例', imageNoteEn:'Repository UI example', link:'查看项目与演示', linkEn:'View the project and demo' },
  { id:'observe', type:'research', name:'品牌 AI 认知榜', nameEn:'Brand AI Observatory', zh:'当客户问 AI，你的品牌在哪里。', en:'What does AI know about your brand?', text:'从同一道采购问题出发，记录品牌提及、核对企业资料，公开调查进展与方法。', textEn:'Observe brand mentions through shared purchasing questions, company evidence and transparent research methods.', url:'/observe/rankings', label:'BRAND INTELLIGENCE', cover:'observe', link:'查看行业观察', linkEn:'Explore the research' },
  { id:'open365', type:'product', name:'Open365', zh:'让电脑维护，更清楚一点。', en:'Make computer maintenance clearer.', text:'公开源码的 Windows 维护工具，围绕清理、启动项与网络问题提供可查看的操作。', textEn:'An open-source Windows maintenance toolkit for cleanup, startup items and network troubleshooting.', url:'https://github.com/dongsheng123132/Open365', label:'OPEN SOURCE / WINDOWS', image:'open365-demo.png', imageClass:'terminal-cover', alt:'Open365 扫描界面示例', altEn:'Open365 scan interface example', link:'查看公开仓库', linkEn:'View the repository' },
  { id:'benxiang', type:'experiment', name:'本象协议', nameEn:'Benxiang Protocol', zh:'探索 AI 如何持续完成长程任务。', en:'Exploring how AI can sustain long-running work.', text:'围绕状态、证据与执行过程开展工程实验。公开实践记录，也记录尚未解决的问题。', textEn:'Engineering experiments on state, evidence and execution, including open questions and practical limits.', url:postUrl('long-term-ai-computer-challenge'), label:'ENGINEERING EXPERIMENT', image:'benxiang-keyvisual.jpg', imageClass:'concept-cover', alt:'本象协议文章概念配图', altEn:'Concept illustration for the Benxiang Protocol article', link:'阅读实验记录', linkEn:'Read the experiment (Chinese)' },
];
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
      <a href="${home}#works">${en?'Work':'作品'}</a><a href="${aboutUrl}"${about?' aria-current="page"':''}>${en?'About':'关于我'}</a><a href="${en?'/en/services':'/services'}">${en?'Services':'服务'}</a><a href="${BLOG}${en?'/en':''}/archive">${en?'Journal':'文章'}</a><a href="/observe/rankings">${en?'AI Observatory':'认知榜'}</a>
      ${en?`<a class="language-link" href="${WWW}${about?'/about':'/'}" lang="zh-CN">中文</a>`:`<!-- AUTO:LANGUAGE-NAV:START --><a href="${WWW}/en${about?'/about':''}" lang="en">EN</a><!-- AUTO:LANGUAGE-NAV:END -->`}
      <a class="nav-contact" href="#contact">${en?'Let’s talk':'聊聊合作'} ${arrow}</a>
    </nav></div></header>`;
}
function gallery(en) {
  const cards=projects.map((p,i)=>`<article class="work-card" data-work-type="${p.type}"><a class="work-image-link" href="${p.url}"${p.url.startsWith('https:')?' '+ext:''} aria-label="${esc(en?(p.nameEn||p.name):p.name)} — ${en?p.linkEn:p.link}">
    ${p.image?`<div class="work-cover ${p.imageClass}"><img src="/images/${p.image}" alt="${esc(en?p.altEn:p.alt)}" width="${p.imageWidth||(p.id==='open365'?1156:1200)}" height="${p.imageHeight||(p.id==='open365'?1214:800)}" loading="lazy" decoding="async" /></div>`:`<div class="work-cover typographic-cover ${p.cover}"><span class="cover-eyebrow">${p.label}</span><strong>${p.cover==='uking'?'U-King':en?'Brand<br>AI Observatory':'品牌<br>AI 认知榜'}</strong><span class="cover-caption">${p.cover==='uking'?'TOOLS FOR REAL WORK':'HEQUBING / RESEARCH'}</span></div>`}
    ${p.imageNote?`<span class="work-image-note">${en?p.imageNoteEn:p.imageNote}</span>`:''}<span class="work-open" aria-hidden="true">↗</span></a><div class="work-meta"><span>${p.label}</span><span>${String(i+1).padStart(2,'0')}</span></div><h3><a href="${p.url}"${p.url.startsWith('https:')?' '+ext:''}>${esc(en?(p.nameEn||p.name):p.name)}</a></h3><p class="work-tagline">${en?p.en:p.zh}</p><p class="work-description">${en?p.textEn:p.text}</p><a class="text-link" href="${p.url}"${p.url.startsWith('https:')?' '+ext:''}>${en?p.linkEn:p.link} ${arrow}</a></article>`).join('\n');
  return `<section class="section works-section" id="works"><span id="delivered" class="anchor"></span><div class="section-head"><div><p class="eyebrow">SELECTED WORK / 01</p><h2>${en?'Ideas, put to work.':'做出来的，才算数。'}</h2></div><p>${en?'Products, research and ongoing experiments.<br>Every project has somewhere you can go next.':'产品、研究与持续进行的工程实验。<br>每件作品，都有一个可以继续了解的入口。'}</p></div>
  <div class="work-filters" aria-label="${en?'Filter projects':'筛选作品'}" hidden>${[['all',en?'All work':'全部作品'],['product',en?'Products':'产品工具'],['research',en?'Research':'品牌研究'],['experiment',en?'Experiments':'工程实验']].map(([id,label])=>`<button type="button" data-work-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div><p class="sr-only" data-work-count aria-live="polite"></p><div class="work-grid">${cards}</div>
  <p class="gallery-note"><a class="text-link" href="${en?'/en/about':'/about'}#works">${en?'More projects & open-source work':'更多项目与开源实践'} ${arrow}</a></p></section>`;
}
function practice(en, posts) {
  const selected=posts.filter(p=>p.source?.type==='author_wechat'&&(!en||p.translations?.en));
  const cards=selected.map(p=>`<div class="mini-card"><h3><a href="${postUrl(p.slug,en?'en':'zh-CN')}">${esc(en?p.translations.en.title:p.title)}</a></h3><p>${esc(en?p.translations.en.summary:p.summary)}</p></div>`).join('\n');
  return `<section class="section practice-section" id="practice"><div class="section-head"><div><p class="eyebrow">FIELD NOTES / 03</p><h2>${en?'Build. Learn. Write.':'把一线实践，写下来。'}</h2></div><a class="text-link" href="${BLOG}${en?'/en':''}/archive">${en?'All articles':'全部文章'} ${arrow}</a></div><p class="section-intro">${en?'Engineering decisions, product iterations and lessons from implementation. Each article describes its evidence and limits.':'写产品如何开发、问题如何解决，也写尝试里的失败与边界。让你在合作之前，先了解我的工作方式。'}</p><details class="practice-disclosure"><summary>${en?'Read project and engineering notes':'阅读作品与工程实践文章'} <span>${selected.length} ${en?'articles':'篇'}</span></summary>
  ${en?`<div class="mini-grid">${cards}</div>`:'<!-- AUTO:SELECTED-WORKS:START -->\n<!-- AUTO:SELECTED-WORKS:END -->'}</details></section>`;
}
function contact(en) {
  return `<section class="personal-contact" id="contact"><div class="contact-copy"><p class="eyebrow">LET’S MAKE SOMETHING USEFUL</p><h2>${en?'Your next idea.<br>Let’s start there.':'你的下一个想法，<br>我们可以聊聊。'}</h2><p>${en?'AI implementation, product development or a specific business problem. Start with a free 30-minute conversation to see whether there is a good fit.':'AI 落地、产品开发，或一个还没有想清楚的业务问题。<br>先免费聊 30 分钟，看看有没有合适的合作起点。'}</p><div class="contact-detail"><span>${en?'Email':'邮箱'}</span><a href="mailto:hefangsheng@gmail.com">hefangsheng@gmail.com ${arrow}</a></div><div class="contact-detail"><span>WeChat</span><strong data-wechat-id>hecare888</strong></div><div class="contact-social"><a href="https://github.com/dongsheng123132" ${ext}>GitHub ${arrow}</a><a href="https://x.com/FangshengH" ${ext}>X / Twitter ${arrow}</a><a href="${en?'/en/services':'/services'}">${en?'Scope & pricing':'服务与报价'} ${arrow}</a></div><p class="contact-note">${en?'Based in Shenzhen · Remote collaboration available':'常驻深圳 · 可远程协作 · 具体范围先沟通'}</p></div><div class="contact-qr-slot">
  <!-- AUTO:CONTACT:START -->
  <!-- AUTO:CONTACT:END -->
  </div></section>`;
}
function footer(en) {
  return `<footer class="personal-footer shell"><a class="footer-name" href="${en?'/en':'/'}">${en?'Hequbing':'贺去病'}<span>Build things that matter.</span></a><div><p>© <span id="year">2026</span> ${en?'Hequbing Business Consulting':'贺去病商业咨询'}</p><a href="/privacy">${en?'Privacy':'隐私说明'}</a><a href="/observe/rankings">${en?'Brand AI Observatory':'品牌 AI 认知榜'}</a></div></footer>`;
}
function aboutContent(en) {
  const stages=en?[
    ['01','Search engineering','Start with how information is found, organized and used.'],['02','Entrepreneurship','Connect technical decisions with customers, delivery and the business itself.'],['03','International business','Develop overseas markets for medical supplies and work across different business contexts.'],['04','AI products & implementation','Build tools and help teams turn AI into a working part of their operations.'],
  ]:[['01','搜索技术研发','从信息如何被找到、组织与使用开始，建立技术研发的底子。'],['02','创业与经营','走到客户、交付与经营现场，理解技术决策背后的成本和取舍。'],['03','海外市场拓荒','在医疗物资领域拓展海外市场，把产品、供应链与真实需求连起来。'],['04','AI 产品与落地','持续开发 AI 工具，也陪企业把技术接进实际工作流程。']];
  return `<section class="about-hero"><div><p class="eyebrow">ABOUT / THE PERSON BEHIND THE WORK</p><h1>${en?'Hequbing.<br><em>Builder. Consultant.</em>':'我是贺去病。<br><em>也叫贺方升，Dosen。</em>'}</h1><p class="hero-intro">${en?'I build AI products and help businesses put them to work. My background spans search technology, entrepreneurship and international market development.':'我做 AI 产品，也做企业 AI 落地。<br>从搜索技术研发、创业，到海外市场拓荒，<br>我一直在技术与生意之间工作。'}</p><div class="hero-actions"><a class="button primary" href="#contact">${en?'Get in touch':'和我聊聊'} ${arrow}</a><a class="text-link" href="https://github.com/dongsheng123132" ${ext}>GitHub ${arrow}</a></div></div><div class="about-statement"><p>MY APPROACH</p><blockquote>${en?'Understand the business.<br>Then build what it needs.':'看懂问题，<br>动手做出来，<br>再放进现实里。'}</blockquote><span>${en?'Hequbing / He Fangsheng / Dosen':'贺去病 / 贺方升 / Dosen'}</span></div></section>
  <section class="section journey-section"><div class="section-head"><div><p class="eyebrow">THE JOURNEY / 01</p><h2>${en?'Experience shapes the work.':'经历，塑造了做事方式。'}</h2></div><p>${en?'From search engineering to business.<br>From working software to AI implementation.':'从搜索技术到真实经营，<br>再把一线经验带回产品开发。'}</p></div><div class="journey-grid">${stages.map(([n,title,text])=>`<article><span>${n}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div></section>
  <section class="personal-note"><p class="eyebrow">HOW I WORK</p><div><h2>${en?'Stay close to the problem.':'离问题近一点。'}</h2><p>${en?'I founded Hequbing Business Consulting to connect business diagnosis with hands-on implementation. I work from a defined problem, agree on the deliverable, build a working version and test it in the intended environment.':'我创办贺去病商业咨询，希望把对业务的理解和动手实现放在一起。先明确问题，再约定交付；做出可使用的版本，放进实际工作里验证。'}</p><p>${en?'Public projects and engineering notes are an invitation to inspect how I work before we decide to collaborate.':'产品和开源项目，是我的持续实践。你可以先看作品、读工程记录，再决定我们是否适合一起做事。'}</p></div></section>
  <section class="section open-projects" id="works"><div class="section-head"><div><p class="eyebrow">OPEN WORK / 02</p><h2>${en?'More things I work on.':'持续在做的事。'}</h2></div><a class="text-link" href="${en?'/en':'/'}#works">${en?'Featured work':'查看精选作品'} ${arrow}</a></div><div class="project-index">${moreProjects.map(([name,url,zh,eng])=>`<a href="${url}" ${ext}><h3>${name}</h3><p>${en?eng:zh}</p>${arrow}</a>`).join('')}<a href="/observe/rankings"><h3>${en?'Brand AI Observatory':'品牌 AI 认知榜'}</h3><p>${en?'Industry research and company evidence':'行业观察与开放企业资料'}</p>${arrow}</a><a href="https://github.com/dongsheng123132" ${ext}><h3>${en?'All public repositories':'全部公开仓库'}</h3><p>GitHub / dongsheng123132</p>${arrow}</a></div></section>`;
}
function homeContent(en) {
  return `<section class="personal-hero"><div class="hero-copy"><p class="eyebrow">HEQUBING / AI BUILDER & CONSULTANT</p><h1>${en?'Hequbing.<br><em>Ideas into practice.</em>':'贺去病。<br><em>懂生意，也写代码。</em>'}</h1><p class="hero-intro">${en?'I build AI products and help businesses put AI to work.<br>From a real problem to something people can use.':'我做 AI 产品，也和企业一起把 AI 用起来。<br>从一个真实问题，到一件真正能用的作品。'}</p><div class="hero-actions"><a class="button primary" href="#works">${en?'Explore my work':'看看我的作品'} <span aria-hidden="true">↓</span></a><a class="text-link" href="#contact">${en?'Let’s talk':'聊聊你的想法'} ${arrow}</a></div><div class="hero-byline"><span></span>${en?'Shenzhen, China · Open to collaboration':'中国 · 深圳 / 开放合作'}</div></div><figure class="hero-visual portrait-visual"><img src="/images/hequbing-speaking-enhanced.webp" width="1254" height="1254" alt="${en?'Hequbing speaking with a microphone':'贺去病手持话筒讲解的本人照片'}" fetchpriority="high" decoding="async" /><figcaption><span>HEQUBING / ${en?'He Fangsheng':'贺去病'}</span><span>${en?'AI products & implementation':'AI 产品 · 企业 AI 落地'}</span></figcaption></figure></section>
  <div class="focus-strip"><span>${en?'FOCUS':'我关注的方向'}</span><p>${en?'AI products':'AI 产品开发'}</p><p>${en?'Business implementation':'企业 AI 落地'}</p><p>${en?'Brand visibility':'品牌 AI 认知'}</p><p>${en?'Open-source practice':'开源与工程实践'}</p></div>${gallery(en)}
  <section class="personal-note" id="about"><p class="eyebrow">A LITTLE ABOUT ME / 02</p><div><h2>${en?'A business mindset.<br>A builder’s hands.':'理解生意的人，<br>也应该能把东西做出来。'}</h2><p>${en?'I am Hequbing, also known as He Fangsheng and Dosen. My path has taken me through search engineering, entrepreneurship and overseas market development for medical supplies. Today I bring that experience to AI consulting and product development.':'我是贺去病，本名贺方升，也使用 Dosen 这个名字。经历过搜索技术研发、创业和医疗物资海外市场拓荒，现在专注 AI 咨询与产品开发。'}</p><a class="text-link" href="${en?'/en/about':'/about'}">${en?'More about me':'更多关于我'} ${arrow}</a></div></section>
  <section class="section services-overview" id="services"><div class="section-head"><div><p class="eyebrow">WAYS TO WORK TOGETHER</p><h2>${en?'A clear place to start.':'我们可以一起做什么。'}</h2></div><a class="text-link" href="${en?'/en/services':'/services'}">${en?'Scope & pricing':'服务范围与报价'} ${arrow}</a></div><div class="service-list">${(en?[
    ['01','Build an AI product','Turn a defined requirement into a prototype, agent, workflow or usable tool.','/en/services#dev'],['02','Put AI into your business','Diagnose the opportunity, test one practical scenario and support the team through implementation.','/en/services#consulting'],['03','Understand your AI visibility','Check how AI describes your business and improve the public information it can verify.','/en/geo'],
  ]:[['01','把想法做成 AI 产品','从需求与原型，到智能体、工作流和能交付的工具。','/services#dev'],['02','把 AI 放进真实业务','先诊断机会，选一个场景落地，再让团队真正用起来。','/services#consulting'],['03','看清品牌在 AI 中的位置','核对 AI 如何介绍你的企业，补齐可查证的公开资料。','/geo']]).map(([n,t,d,url])=>`<a href="${url}"><span class="service-number">${n}</span><h3>${t}</h3><p>${d}</p>${arrow}</a>`).join('')}</div></section>`;
}

function renderPersonal(page, lang='zh-CN', posts=[]) {
  const en=lang==='en', about=page==='about';
  const zhUrl=WWW+(about?'/about':'/'), enUrl=WWW+'/en'+(about?'/about':'');
  const url=en?enUrl:zhUrl;
  const title=en?(about?'About Hequbing · Builder & Consultant':'Hequbing · AI Products & Business Implementation'):(about?'关于贺去病（贺方升 / Dosen）｜AI 产品与实践':'贺去病｜AI 产品创造者 · 企业 AI 落地');
  const description=en?'Hequbing (He Fangsheng / Dosen) builds AI products and helps businesses implement AI. Explore real projects, engineering notes and ways to collaborate.':'贺去病（贺方升 / Dosen），AI 产品创造者与企业 AI 落地实践者。了解真实作品、开源项目、工程实践与合作方式，微信 hecare888。';
  const person={'@type':'Person','@id':WWW+'/about#person',name:en?'Hequbing':'贺去病',alternateName:['贺方升','Dosen','He Fangsheng'],url:WWW+'/about',image:WWW+'/images/hequbing-speaking-enhanced.png',jobTitle:en?'Founder, Hequbing Business Consulting':'贺去病商业咨询创始人',email:'hefangsheng@gmail.com',sameAs:['https://github.com/dongsheng123132','https://x.com/FangshengH']};
  const graph=[person,{'@type':'Organization','@id':WWW+'/#org',name:en?'Hequbing Business Consulting':'贺去病商业咨询',url:WWW,founder:{'@id':person['@id']}}];
  if(about)graph.push({'@type':'ProfilePage',url,mainEntity:{'@id':person['@id']}});
  return `<!DOCTYPE html>
<!-- Generated from lib/personal-pages.js. Edit that source, then run npm run build. -->
<html lang="${lang}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title><meta name="description" content="${esc(description)}" /><meta name="theme-color" content="#f6f5f1" />
<link rel="canonical" href="${url}" /><meta property="og:title" content="${esc(title)}" /><meta property="og:description" content="${esc(description)}" /><meta property="og:type" content="${about?'profile':'website'}" /><meta property="og:url" content="${url}" /><meta property="og:image" content="${WWW}/images/hequbing-speaking-enhanced.png" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" /><link rel="stylesheet" href="/personal.css" />
<!-- AUTO:LANGUAGE:START -->
  ${alternateLinks(zhUrl,enUrl)}
<!-- AUTO:LANGUAGE:END -->
<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>
</head><body class="personal-site${en?' personal-en':''}">${header(en,about)}
<main class="shell" id="main">${about?aboutContent(en):homeContent(en)}${practice(en,posts)}${contact(en)}</main>${footer(en)}
<script src="/site.js" defer></script><script src="/personal.js" defer></script></body></html>`;
}
function buildPersonalChinese() {
  const root=path.join(__dirname,'..');
  const posts=JSON.parse(fs.readFileSync(path.join(root,'data/posts.json'),'utf8'));
  for(const page of ['index','about'])fs.writeFileSync(path.join(root,'public',page+'.html'),renderPersonal(page,'zh-CN',posts),'utf8');
}
module.exports={renderPersonal,buildPersonalChinese};
