/** 公开行业观察：业务信息优先，研究证据按需展开。 */
import { SITE_STYLE, industryArt, orbitArt } from './site-theme.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const CONTACT = 'https://www.hequbing.com/about.html#contact';
const DIRECTORY = 'https://www.hequbing.com/observe/';
const REPO = 'https://github.com/dongsheng123132/hequbing-ai-observatory';
const industryInfo = {
  'philippines-logistics': { label: 'CROSS-BORDER LOGISTICS', short: '菲律宾专线物流', intro: '从中国出发，抵达菲律宾。观察 AI 如何识别专线服务商，以及在跨境物流采购中向企业推荐谁。', scope: '海运与空运 · 清关与派送' },
  'power-cord-factories': { label: 'POWER & MANUFACTURING', short: '电源线工厂', intro: '一条电源线背后，是标准、认证与制造能力。观察 AI 在 AC 电源线采购场景中如何识别供应商。', scope: 'AC 电源线 · 制造与配套' },
  'industrial-design': { label: 'INDUSTRIAL DESIGN', short: '工业设计公司', intro: '从产品构想到量产之前，企业如何找到合适的设计伙伴？观察 AI 在真实采购问题中，会提到哪些工业设计公司。', scope: '产品研究 · 外观与结构设计' },
};
const infoFor = b => industryInfo[b.id] ?? { label: 'INDUSTRY OBSERVATION', short: (b.title ?? '').replace(/\s*AI\s*认知榜$/, ''), intro: b.market ?? b.category ?? '', scope: b.category ?? b.market ?? '' };
const statusFor = b => b.status === 'planned' ? '待采样，尚未发布名次' : b.status === 'collecting' ? '首期采样中，尚未发布名次' : '本期观察已发布';

function header({ brand = '贺去病', home = 'index.html', method = 'methodology.html', current = 'industry' } = {}) {
  return `<a class="skip-link" href="#main">跳到主要内容</a><header class="masthead"><div class="wrap">
  <a class="wordmark" href="${esc(home)}" aria-label="${esc(brand)} · 品牌 AI 认知榜首页"><span class="seal" aria-hidden="true">贺</span><span><span class="brand-name">${esc(brand)}</span><span class="brand-caption">品牌 AI 认知榜</span></span></a>
  <nav class="nav" aria-label="主导航"><a href="${esc(home)}"${current === 'industry' ? ' aria-current="page"' : ''}>行业观察</a><a href="${DIRECTORY}">企业档案</a><a href="${esc(method)}"${current === 'method' ? ' aria-current="page"' : ''}>研究方法</a><a class="nav-contact" href="${CONTACT}">联系我们 <span aria-hidden="true">↗</span></a></nav></div></header>`;
}
function footer({ brand = '贺去病', method = 'methodology.html', generatedAt, methodologyVersion } = {}) {
  return `<footer class="site-footer"><div class="wrap"><div class="footer-top"><div><span class="brand-name">${esc(brand)}</span><span class="brand-caption">品牌 AI 认知榜 · HEQUBING</span></div><nav class="footer-nav" aria-label="页尾导航"><a href="${esc(method)}">研究方法</a><a href="${DIRECTORY}">开放企业档案</a><a href="${REPO}">开源项目 ↗</a></nav></div><div class="footer-bottom"><span>观察 AI 如何认识企业。研究独立，名次不出售。</span><span>${generatedAt ? `更新 ${esc(generatedAt)} · ` : ''}${methodologyVersion ? `方法 v${esc(methodologyVersion)}` : '观察 AI 回答不等于评定产品或服务质量'}</span></div></div></footer>`;
}
function page({ title, description, basePath, content }) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${basePath ? `<base href="${esc(basePath)}">` : ''}<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#193e35"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><style>${SITE_STYLE}</style></head><body>${content}</body></html>`;
}
function contactBand() {
  return `<section class="contact-band" id="contact"><div><h2>从看见差异，到找到下一步。</h2><p>带着你的公司、官网与具体问题，和我们聊一聊。</p></div><a class="button" href="${CONTACT}">申请企业诊断 <span aria-hidden="true">↗</span></a></section>`;
}

export function renderSiteIndex({ siteName, brand, tagline, boards, generatedAt, methodologyVersion, cadence, basePath }) {
  const issue = boards.find(b => b.issue)?.issue ?? generatedAt?.slice(0, 7) ?? '';
  const cards = boards.map((b, i) => {
    const info = infoFor(b);
    return `<a class="board" href="${esc(b.href)}"><div class="board-top"><span class="serial">${String(i + 1).padStart(2, '0')} / 行业</span><span class="status ${b.status === 'planned' ? 'planned' : ''}">${b.status === 'planned' ? '调查筹备' : b.status === 'collecting' ? '采样进行中' : '已发布'}</span></div><div class="industry-art">${industryArt(b.id)}</div><div class="industry-label" lang="en">${info.label}</div><h3>${esc(info.short)}</h3><p>${esc(info.scope)}</p><p>${['planned', 'collecting'].includes(b.status) ? esc(statusFor(b)) : `${esc(b.sampleCount)} 条样本 · ${esc(b.entityCount)} 个候选`}${b.isSynthetic ? ' · 演示数据' : ''}</p><div class="board-footer"><span>查看本期观察</span><span class="arrow" aria-hidden="true">↗</span></div></a>`;
  }).join('');
  return page({ title: `${brand} · ${siteName}`, description: `${tagline} 贺去病定期观察物流、制造与工业设计行业的 AI 品牌认知，公开研究方法与企业资料。`, basePath, content: `${header({brand})}
  <main class="wrap" id="main"><section class="hero"><div><p class="eyebrow">HEQUBING · BRAND INTELLIGENCE</p><h1>当客户问 AI，<br><em>你的品牌在哪里。</em></h1><p class="hero-copy">采购决策，正在多一个入口。<br>我们持续观察 AI 认识谁、提到谁，又遗漏了谁。<br>让企业看清自己在 AI 回答中的位置。</p><div class="actions"><a class="button" href="#industries">查看行业观察 <span aria-hidden="true">↓</span></a><a class="text-link" href="#self-check">了解品牌自查 <span aria-hidden="true">↗</span></a></div></div><div class="hero-plate"><span class="plate-label">THE NEXT POINT OF DISCOVERY</span>${orbitArt()}<div class="plate-caption"><span>品牌与 AI 的认知交汇</span><span>研究视角 / 001</span></div></div></section>
  <div class="issue-strip" aria-label="本期研究概况"><div><span class="figure">${esc(issue.replace('-', ' / '))}</span><div><strong>本期行业观察</strong><span>按月留档，持续追踪</span></div></div><div><span class="figure">${String(boards.length).padStart(2, '0')}</span><div><strong>行业研究议题</strong><span>同题观察，分期发布</span></div></div><div><span class="figure long-figure">公开 · 可溯</span><div><strong>方法与来源</strong><span>每一步有据可查</span></div></div></div>
  ${boards.some(b => b.isSynthetic) ? '<div class="warn"><b>本站当前包含演示数据。</b>带“演示数据”标记的榜单由程序合成，不是真实测评结果，禁止对外引用。</div>' : ''}
  <section class="section" id="industries"><div class="section-heading"><div><p class="eyebrow">01 / INDUSTRY OBSERVATIONS</p><h2>沿着行业，看见品牌。</h2></div><p>从具体的采购问题出发，<br>记录不同 AI 对同一行业的回答。</p></div><div class="board-grid">${cards}</div><div class="section-note"><span>${esc(cadence)}</span><a href="methodology.html">了解发布标准 ↗</a></div></section>
  <section class="feature-band" id="self-check"><div><p class="eyebrow">FOR YOUR BUSINESS</p><h2>客户的下一次提问，<br>会不会出现你的名字？</h2></div><div><p>用本行业的固定问题，先获得独立的 AI 回答，再核对你的公司与同行。识别提及差异、资料缺口与下一步行动。</p><div class="actions"><a class="button light" href="${REPO}/releases/latest">获取品牌自查工具 <span aria-hidden="true">↗</span></a><a class="text-link" href="${REPO}/blob/main/skills/hequbing-industry-survey/SKILL.md">查看使用方法</a></div><p style="font-size:11px;margin-top:18px">供企业 AI 使用的 Skill · 自查结果不改变已冻结的公开榜单</p></div></section>
  <section class="section"><div class="section-heading"><div><p class="eyebrow">02 / RESEARCH PRINCIPLES</p><h2>值得参考，也经得起追问。</h2></div><a class="text-link" href="methodology.html">完整研究方法 <span aria-hidden="true">↗</span></a></div><div class="principles"><article class="principle"><span class="serial">01</span><h3>同题，才能比较。</h3><p>在同一条真实回答中比较品牌提及。固定问题、保留模型与时间信息，交代清楚每一次观察的条件。</p></article><article class="principle"><span class="serial">02</span><h3>未知，就保留未知。</h3><p>样本不足，先公开调查进展；置信区间重叠，只报并列。把不确定性写清楚，是研究的一部分。</p></article><article class="principle"><span class="serial">03</span><h3>研究，保持独立。</h3><p>本榜不卖名次。原始回答全量存档，方法可复核。诊断服务与名次解耦，不承诺任何排名变化。</p></article></div></section>${contactBand()}</main>${footer({brand,generatedAt,methodologyVersion})}` });
}

/** 仅公布当期调查计划及真实候选资料；不读取样本、不生成名次。 */
export function renderPendingBoard({ id, title, brand, siteName, issue, reason, market, cadence, prompts = [], candidateReview, status }) {
  const info = infoFor({id,title,market});
  const planned = status === 'planned';
  const statusText = statusFor({status});
  const companies = candidateReview?.entities ?? [];
  const candidateCards = companies.map((e, i) => {
    const sources = e.sources.filter(s => /^https?:\/\//i.test(s.url));
    return `<article class="company"><div class="company-heading"><div><h3>${esc(e.name)}</h3><p class="company-role">研究候选${e.affiliation === '发起人关联企业' ? ' · 发起人关联企业' : ''}</p></div><span class="company-index" aria-hidden="true">ARCHIVE / ${String(i + 1).padStart(2, '0')}</span></div><div class="company-links">${sources[0] ? `<a href="${esc(sources[0].url)}" target="_blank" rel="noopener noreferrer">访问企业官网 ↗</a>` : ''}<a href="${DIRECTORY}">浏览开放企业目录 ↗</a></div><details><summary>来源与核验说明 · ${sources.length} 项官网资料</summary><div class="evidence"><ul>${sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">官网来源 ↗</a> · ${esc(s.supports)}</li>`).join('')}</ul><p>待核对：${esc(e.pending.join('；'))}</p></div></details></article>`;
  }).join('');
  const questionList = prompts.map(p => `<li><p>${esc(p.text)}</p><small>${p.purpose === 'ranking' ? '观察候选企业提及' : '观察采购方法，不进入提及率分母'}</small></li>`).join('');
  return page({ title: `${title} · ${issue} — ${brand}`, description: `${title}的调查范围与固定题库。${statusText}；支持企业 AI 认知自查与资料纠错。`, content: `${header({brand,home:'../index.html',method:'../methodology.html'})}<main class="wrap" id="main"><nav class="breadcrumb" aria-label="当前位置"><a href="../index.html">行业观察</a><span aria-hidden="true">/</span><span>${esc(info.short)}</span><span aria-hidden="true">/</span><span>${esc(issue)}</span></nav>
  <section class="hero detail-hero"><div><p class="eyebrow">${esc(info.label)} · ${esc(issue)}</p><h1>${esc(info.short)}</h1><p class="detail-kicker">AI 认知榜 · 行业观察</p><p class="hero-copy">${esc(info.intro)}</p></div><div class="hero-plate"><span class="plate-label">HEQUBING / INDUSTRY RESEARCH</span>${industryArt(id)}<div class="plate-caption"><span>${esc(info.scope)}</span><span>${esc(issue)}</span></div></div></section>
  <div class="issue-strip"><div><span class="figure">${esc(issue.replace('-', ' / '))}</span><div><strong>研究期号</strong><span>按月留档</span></div></div><div><span class="figure">${String(prompts.length).padStart(2,'0')}</span><div><strong>固定研究问题</strong><span>同题跨模型观察</span></div></div><div><span class="figure long-figure">${planned ? '筹备中' : '采样中'}</span><div><strong>本期进展</strong><span>尚未发布名次</span></div></div></div>
  <div class="detail-grid"><div class="detail-main"><section><div class="section-heading"><div><p class="eyebrow">COMPANY LANDSCAPE</p><h2>从真实企业开始观察。</h2></div></div><p class="section-intro">${esc(candidateReview?.scope ?? market)}</p><p class="company-role">候选核对清单 · ${companies.length} 家</p><div class="company-list">${candidateCards || '<p class="section-intro">本期候选资料正在整理。</p>'}</div><p class="caveat">以上为研究候选，列出顺序不表示名次。${candidateReview?.updatedAt ? `资料核对日期：${esc(candidateReview.updatedAt)}。` : ''}</p>${candidateReview?.evidenceBoundary ? `<details class="question-disclosure"><summary>研究范围与资料边界</summary><p class="caveat" style="margin:0 0 20px">${esc(candidateReview.evidenceBoundary)}</p></details>` : ''}</section>
  <section class="question-section"><p class="eyebrow">THE QUESTIONS WE ASK</p><h2>把采购问题，交给 AI。</h2><p class="section-intro">先固定问题，再记录回答。覆盖企业选择、具体采购场景与判断标准。</p><details class="question-disclosure"><summary>查看本期 ${prompts.length} 个固定问题</summary><ol class="questions">${questionList}</ol></details></section>
  <section class="detail-cta"><p class="eyebrow">YOUR NEXT STEP</p><h2>先看，你的公司有没有被提到。</h2><p>请你的 AI 在独立新会话中回答固定问题，保存模型、时间与联网状态；再提供公司名称与官网，核对同行差异。资料不足时保留未知，自查结果不自动并入公开榜。</p><div class="actions"><a class="button" href="${REPO}/releases/latest">获取品牌自查工具 <span aria-hidden="true">↗</span></a><a class="text-link" href="${CONTACT}">申请企业诊断 <span aria-hidden="true">↗</span></a></div></section></div>
  <aside class="detail-sidebar" aria-label="本期调查进展"><div class="progress-panel"><p class="eyebrow">RESEARCH STATUS</p><h2>${statusText}</h2><p>${esc(reason)}</p><ol class="progress-steps"><li>01 / 调查建档<span>题库已建立</span></li><li>02 / 模型采样<span>${planned ? '待开始' : '进行中'}</span></li><li>03 / 核验与发布<span>待完成</span></li></ol></div><div class="sidebar-links"><a href="../methodology.html">了解研究方法 <span aria-hidden="true">↗</span></a><a href="${DIRECTORY}">补充企业资料 <span aria-hidden="true">↗</span></a></div><p class="caveat">${esc(cadence)}<br>本页公布调查范围与题库，候选范围及正式样本数待核验。</p></aside></div></main>${footer({brand,method:'../methodology.html'})}` });
}

export function renderMethodologyPage({ siteName, brand, generatedAt, methodologyVersion, fingerprint, weights, alpha, minN }) {
  const w = Object.entries(weights ?? {}).map(([k,v]) => `<li><code>${esc(k)}</code> ${(v * 100).toFixed(0)}%</li>`).join('');
  const sections = ['排序依据','综合分的用途','不确定性','空值与失败','问题的范围','可复算性','已知局限','研究独立性'];
  return page({ title: `研究方法 — ${brand} · ${siteName}`, description: '公开品牌 AI 认知调查的计算口径、证据边界与发布标准。', content: `${header({brand,current:'method'})}<main class="wrap" id="main"><section class="method-hero"><p class="eyebrow">THE METHOD BEHIND THE OBSERVATION</p><h1>让每一次判断，<br>有据可查。</h1><p class="hero-copy">公开计算口径，也公开方法的边界。完整复算需要对应的原始回答、实体表与参数；摘要数据不能替代它们。</p><p class="method-meta" style="margin-top:22px">方法论版本 ${esc(methodologyVersion)} · 更新 ${esc(generatedAt)}</p></section><div class="method-layout"><nav class="method-nav" aria-label="方法目录">${sections.map((s,i)=>`<a href="#method-${i+1}">${String(i+1).padStart(2,'0')} / ${s}</a>`).join('')}</nav><div class="method-document">
  <section class="card" id="method-1">
    <h2>一、排序依据：成对击败率</h2>
    <p>榜单名次<b>不是</b>由综合分排出来的，而是由成对击败率排出来的：</p>
    <ul class="kv">
      <li><code>A 对 B 的击败率 = 100 × (A 被提及而 B 未被提及的回答数) ÷ (至少一方被提及的回答数)</code></li>
      <li>分母为 0（双方都没出现）时记 <code>null</code>，不记 0。</li>
      <li>某实体的名次依据是它对其余每一个实体的击败率的平均值。</li>
    </ul>
    <p class="note">为什么不用绝对分：成对比较在<b>同一条回答内部</b>完成配对，
    让两家企业面对相同回答条件；题库、模型和时间窗的选择仍会影响结论，不能据此宣称消除了系统性偏差。</p>
  </section>

  <section class="card" id="method-2">
    <h2>二、综合分（ARS）只用于展示</h2>
    <p>综合分按下列权重加权合成，仅用于展示与趋势追踪，<b>不参与名次判定</b>：</p>
    <ul class="kv">${w}</ul>
    <p class="note">权重是先验设定、公开、可被榜单配置覆盖，但<b>不做数据拟合</b>。
    拟合出来的权重会被合理质疑成"为某个品牌调参"。</p>
  </section>

  <section class="card" id="method-3">
    <h2>三、不确定性怎么处理</h2>
    <ul class="kv">
      <li><b>置信区间：</b>对回答做有放回重采样（Bootstrap），得到击败率的 95% 置信区间。</li>
      <li><b>并列带：</b>置信区间重叠的名次合并报告为区间（如"第 5–8 名"），不得宣称彼此优劣。</li>
      <li><b>小样本惩罚（CAV）：</b>衡量"被提及的比例"时使用 Jeffreys 后验下界，
        样本越小报得越低。3 次采样全都提到，下界也只有 55.6%，而不是 100%。</li>
      <li><b>改写轴：</b>同一意图下用多种措辞提问，稳定性按意图分组统计，
        把"换个说法答案就变"的不确定性算进去。</li>
      <li><b>显著性水平 α = ${esc(alpha)}，最小可发布样本量 N = ${esc(minN)}。</b>
        样本量不足时，页面会明确标注"不得对外发布"。</li>
    </ul>
  </section>

  <section class="card" id="method-4">
    <h2>四、空值与失败的处理</h2>
    <ul class="kv">
      <li><b>未被提及记 0</b>——确实零次提及，不是数据缺失。</li>
      <li><b>采样失败的回答被剔除出分母</b>，绝不算作品牌缺席。
      把"请求失败"和"AI 没提到"混为一谈会直接毁掉排名。</li>
      <li><b>分母为 0 记 null</b>，不记 0：没测过不等于表现差。</li>
      <li><b>未被提及时情感分记 0</b>，不能把"中性"映射成 0.5 白送分。</li>
      <li><b>免责声明段落里的品牌名被剔除</b>，那不是推荐。</li>
    </ul>
  </section>

  <section class="card" id="method-5">
    <h2>五、为什么只统计"要求推荐"类问题</h2>
    <p>实测发现一个必须处理的现象：<b>AI 在"哪家好 / 哪个好"这类问题上会给出机构名单，
    而在"怎么办 / 有没有必要 / 找哪家"这类问题上，常常一条机构名都不给</b>
    （实测 25 条回答里 18 条零提及，且零提及全部集中在后者）。</p>
    <p>如果两类问题混在同一个分母里，<b>"AI 在这个问题上根本不推荐任何人"会被误算成
    "这些机构认知度低"</b>——这是一个会直接歪曲结论的错误。</p>
    <ul class="kv">
      <li><b>进入排名的</b>：问题本身要求推荐或对比（标注 <code>purpose: ranking</code>）。</li>
      <li><b>不进入排名的</b>：问题是在问方法论或判断标准（<code>purpose: behavior</code>）。
        它们单独记录 AI 的行为——<b>"AI 在这类问题上拒绝点名"本身就是结论</b>。</li>
      <li>同一批数据，用全部问题算出来的提及率会显著低于只用推荐类问题算出来的，
        页面上标注的是后者，并注明样本量。</li>
    </ul>
  </section>

  <section class="card" id="method-6">
    <h2>六、可复算性</h2>
    <ul class="kv">
      <li>每个榜单标注<b>方法论版本</b>与<b>指纹</b>。权重、归一化锚点、空值策略、显著性水平
        任一变动，指纹即变，历史榜单不会与新榜单混为一谈。</li>
      <li>当前版本：<code>${esc(methodologyVersion)}</code>，指纹 <code>${esc(fingerprint ?? '见各榜单页')}</code>。</li>
      <li>所有随机过程使用固定种子（<code>mulberry32</code>），同输入必然同输出；
        引擎中禁用 <code>Math.random()</code>。</li>
      <li>原始回答全量存档，带通道、模型版本、地域、语言、时间戳与采样参数。</li>
    </ul>
  </section>

  <section class="card" id="method-7">
    <h2>七、已知局限</h2>
    <ul class="kv">
      <li><b>解析器是规则式的。</b>能识别编号列表、Markdown 表格、项目符号、中英混排与繁简写法；
        对纯段落叙述，会标记为"低顺序置信度"，因为那种写法里"先提到"不等于"更推荐"。</li>
      <li><b>引用信源归因尚未实现。</b>当前只统计"提到了哪个实体"，还统计不了"引用了谁的话"。</li>
      <li><b>幻觉判定依赖人工标注。</b>每个实体需要一份事实基准才能自动判定 AI 是否说错。</li>
      <li><b>分组视图样本量较小</b>，分通道/分地域对比用 ARS 排序，仅作观察参考，不参与名次判定。</li>
    </ul>
  </section>

  <section class="card" id="method-8">
    <h2>八、我们不做什么</h2>
    <ul class="kv">
      <li>不售卖名次、上榜、置顶，也不接受任何形式的"合作费换入选"。</li>
      <li>不对机构作主观评价：页面上的每条判断都限定为"AI 在某个问题上如此回答"。</li>
      <li>不承诺任何排名变化。诊断与修复服务只做信息补齐与口径统一。</li>
    </ul>
  </section>

</div></div></main>${footer({brand,generatedAt,methodologyVersion})}` });
}
