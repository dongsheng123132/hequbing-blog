/**
 * 榜单页渲染：把引擎结果渲染成**自包含单文件 HTML**（内联样式、无 CDN、可离线打开）。
 *
 * 设计取向（据用户既定审美）：
 *  - 浅色卡片化 + 单一蓝色强调；深蓝题头 + 红色标线
 *  - 不用深色大屏、不用渐变发光、不用英文装饰、不用大圆角
 *  - 中文优先，数字右对齐，表格斑马纹
 *
 * 合规取向（这是产品能不能活的关键）：
 *  - 页面上必须常驻"排名依据 + 不可购买 + 可复算"声明
 *  - 合成/演示数据必须打醒目警告，防止被当成真实测评传播
 *  - 置信区间重叠必须显式写出"无统计差异"
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const numv = (x, d = 2) => (x === null || x === undefined ? '—' : Number(x).toFixed(d));
const pctv = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);
const civ = (ci) => (!ci || ci[0] === null ? '—' : `${numv(ci[0])} – ${numv(ci[1])}`);

export const STYLE = `
:root{
  --ink:#1b2431; --muted:#64718a; --line:#e2e7ef; --bg:#f4f6f9;
  --card:#ffffff; --navy:#14335f; --accent:#1d5fd0; --red:#c8102e;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif;}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px 64px}
header{background:var(--navy);color:#fff;border-bottom:3px solid var(--red);padding:28px 0 24px;margin-bottom:28px}
header .wrap{padding-bottom:0}
.brand{font-size:13px;letter-spacing:.14em;opacity:.82;margin:0 0 8px}
h1{margin:0 0 6px;font-size:27px;font-weight:650;letter-spacing:.01em}
.sub{margin:0;opacity:.86;font-size:14px}
.nav{margin:12px 0 0;font-size:13px}
.nav a{color:#cfe0ff;text-decoration:none;border-bottom:1px solid rgba(207,224,255,.45);margin-right:16px}
.nav a:hover{border-bottom-color:#fff;color:#fff}
.card{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:20px 22px;margin-bottom:18px}
h2{font-size:17px;margin:0 0 14px;padding-left:10px;border-left:3px solid var(--accent);line-height:1.2}
h2 .hint{font-size:12px;font-weight:400;color:var(--muted);margin-left:8px}
.stats{display:flex;flex-wrap:wrap;gap:26px}
.stat b{display:block;font-size:20px;font-weight:650;letter-spacing:.01em}
.stat span{font-size:12px;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left}
th{background:#eef2f8;color:#33415c;font-weight:600;font-size:12.5px;white-space:nowrap}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
tbody tr:nth-child(even){background:#fafbfd}
tbody tr:hover{background:#f2f6fd}
.rank{font-weight:650;color:var(--navy);white-space:nowrap}
.rank.banded{background:#e8f0fd;border-radius:3px;padding:2px 7px;color:var(--accent)}
.name{font-weight:600}
.score{font-weight:650;font-size:15px}
.bar{background:#e9edf4;height:7px;border-radius:2px;margin-top:5px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent)}
.ci{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
.wlr{font-variant-numeric:tabular-nums;font-size:13px;color:#3c4a63}
.notice{border-left:3px solid var(--red);background:#fff5f6;padding:12px 14px;border-radius:3px;font-size:13.5px;margin-bottom:18px}
.warn{background:#fff8e6;border:1px solid #f0d79a;color:#7a5200;padding:12px 14px;border-radius:3px;font-size:13.5px;margin-bottom:18px}
.note{font-size:13px;color:var(--muted);margin:10px 0 0}
ul.kv{margin:0;padding-left:18px;font-size:13.5px;color:#3c4a63}
ul.kv li{margin:4px 0}
footer{color:var(--muted);font-size:12.5px;text-align:center;padding-top:10px}
code{background:#eef2f8;padding:1px 5px;border-radius:3px;font-size:12.5px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.boards{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:760px){.two,.boards{grid-template-columns:1fr}}
.board{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);
  border-radius:4px;padding:18px 20px;transition:border-color .15s,box-shadow .15s}
.board:hover{border-color:var(--accent);box-shadow:0 1px 6px rgba(29,95,208,.12)}
.board h3{margin:0 0 6px;font-size:16px;font-weight:650;color:var(--navy)}
.board p{margin:0;font-size:13px;color:var(--muted)}
.board .meta{margin-top:10px;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.board .meta b{color:var(--ink);font-weight:600}
`.trim();

function rankCell(r) {
  if (r.band) return `<span class="rank banded">${r.band[0]}–${r.band[1]}</span>`;
  return `<span class="rank">${r.position}</span>`;
}

function mainTable(rows) {
  const body = rows
    .map((r) => {
      const m = r.metrics;
      const w = r.meanWinRate;
      return `<tr>
  <td class="n">${rankCell(r)}</td>
  <td class="name">${esc(r.name)}</td>
  <td class="n">
    <span class="score">${numv(w)}</span>
    <div class="bar"><i style="width:${w === null ? 0 : Math.max(0, Math.min(100, w))}%"></i></div>
  </td>
  <td class="n ci">${civ(r.ci95)}</td>
  <td class="n ci">${numv(r.ars)}</td>
  <td class="n ci">${pctv(m.mentionRate)}</td>
  <td class="n ci">${
    r.engineCount > 1 ? `${(r.coveredEngines ?? []).length}/${r.engineCount}` : '—'
  }</td>
  <td class="n ci">${pctv(m.cav)}</td>
  <td class="n wlr">${r.wins}/${r.losses}/${r.ties}</td>
</tr>`;
    })
    .join('\n');
  return `<table>
<thead><tr>
  <th class="n">名次</th><th>实体</th>
  <th class="n">平均击败率</th><th class="n">95% 置信区间</th>
  <th class="n">ARS</th><th class="n">提及率</th><th class="n">覆盖 AI</th><th class="n">CAV 下界</th>
  <th class="n">胜/负/平</th>
</tr></thead>
<tbody>
${body}
</tbody>
</table>`;
}

function crossTable(view, entities, title, hint) {
  const keys = Object.keys(view);
  if (keys.length < 2) return '';
  const head = keys.map((k) => `<th class="n">${esc(k)}</th>`).join('');
  const body = entities
    .map((e) => {
      const cells = keys
        .map((k) => {
          const row = view[k].rows.find((r) => r.entityId === e.id);
          if (!row) return '<td class="n ci">—</td>';
          return `<td class="n ci">#${row.position} <span style="color:#9aa6bb">/</span> ${numv(row.ars)}</td>`;
        })
        .join('');
      return `<tr><td class="name">${esc(e.name)}</td>${cells}</tr>`;
    })
    .join('\n');
  return `<div class="card">
<h2>${esc(title)}<span class="hint">${esc(hint)}</span></h2>
<table><thead><tr><th>实体</th>${head}</tr></thead><tbody>
${body}
</tbody></table>
<p class="note">分组后每组样本量变小，此处按 ARS 排序，仅用于对比观察，不作为名次依据。</p>
</div>`;
}

/**
 * 分赛道并列榜。
 * 存在理由：DSE 补习社与留学中介不是同一赛道，混算成一个名次序列在事实层面就是错的。
 */
function typeSections(lb) {
  if (!lb.groups || !Object.keys(lb.groups).length) return '';
  const labels = lb.consortium.typeLabels ?? {};
  return Object.entries(lb.groups)
    .map(([key, g]) => {
      const body = g.rows
        .map(
          (r) => `<tr>
  <td class="n">${rankCell(r)}</td>
  <td class="name">${esc(r.name)}</td>
  <td class="n"><span class="score">${numv(r.meanWinRate)}</span>
    <div class="bar"><i style="width:${r.meanWinRate === null ? 0 : Math.max(0, Math.min(100, r.meanWinRate))}%"></i></div>
  </td>
  <td class="n ci">${civ(r.ci95)}</td>
  <td class="n ci">${pctv(r.metrics.mentionRate)}</td>
</tr>`,
        )
        .join('\n');
      // 整个赛道一次都没被提到 —— 这不是"数据缺失"，这本身就是结论
      const allZero = g.rows.length > 0 && g.rows.every((r) => (r.metrics.mentionRate ?? 0) === 0);
      return `<div class="card">
<h2>${esc(labels[key] ?? key)}<span class="hint">分赛道独立排名，不与其它赛道比名次</span></h2>
<table><thead><tr>
  <th class="n">名次</th><th>实体</th><th class="n">平均击败率</th>
  <th class="n">95% 置信区间</th><th class="n">提及率</th>
</tr></thead><tbody>
${body}
</tbody></table>
${
  allZero
    ? `<p class="notice" style="margin-top:14px"><b>这个赛道全部 ${g.rows.length} 个候选，在本次采样的全部回答里一次都没有被 AI 提到。</b>
这不是"排名靠后"，而是认知空白 —— 用户问 AI 时，AI 根本不会想到这个赛道里的任何一家。
对身处其中的机构来说，这是最值得优先处理的信号。</p>`
    : ''
}
</div>`;
    })
    .join('\n');
}

/**
 * @param {object} lb buildLeaderboard 的返回值
 * @param {{siteName?:string, generatedAt?:string}} [opts]
 */
export function renderLeaderboardHtml(lb, opts = {}) {
  const { consortium, rows, meta, byEngine, byRegion } = lb;
  const siteName = opts.siteName ?? 'AI 认知榜';
  const generatedAt = opts.generatedAt ?? new Date().toISOString().slice(0, 10);
  const isSynthetic = Boolean(consortium.synthetic) || lb.parsedSamples.some((s) => s.synthetic);

  const bands = [...new Set(rows.filter((r) => r.band).map((r) => `${r.band[0]}–${r.band[1]}`))];
  // 样本充分性：并列带覆盖了大半个榜单，说明样本量不足以区分这些实体。
  // 只说"达到最小可发布样本量"（≥5 条）是误导性的 —— 那个门槛只防"一条数据就发榜"。
  const widest = rows.reduce(
    (max, r) => (r.band && (!max || r.band[1] - r.band[0] > max[1] - max[0]) ? r.band : max),
    null,
  );
  const widestBand = widest ? widest[1] - widest[0] + 1 : 0;
  const bandShare = rows.length ? widestBand / rows.length : 0;
  const thinSample = bandShare > 0.5;

  // 样本量过低时**不出榜**。3 条样本排 34 个实体的名次是噪声，不是结果 ——
  // 挂出来就会被当成结论看，这是最危险的一种错误。
  const minNeeded = Math.max(10, Math.ceil(rows.length / 2));
  const tooThinToRank = meta.totalSamples < minNeeded;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(consortium.title ?? consortium.id)} — ${esc(siteName)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <div class="wrap">
    <p class="brand">${esc(opts.brand ?? '贺去病')} · ${esc(siteName)}</p>
    <h1>${esc(consortium.title ?? consortium.id)}</h1>
    <p class="sub">AI 认识谁、推荐谁，又认错了谁</p>
    ${opts.nav ? `<p class="nav">${opts.nav}</p>` : ''}
  </div>
</header>

<div class="wrap">
${
  isSynthetic
    ? `<div class="warn"><b>演示数据警告。</b>本页所有回答均为程序合成的模拟样本，用于验证统计口径与页面形态，
<b>不是真实测评结果，禁止对外引用或传播</b>。</div>`
    : ''
}
  <div class="notice">
    <b>本榜不卖名次。</b>排名由公开方法论的实测数据生成，原始回答全量存档，任何人可复算得到同一结果。
    若两个实体的置信区间重叠，本页只报并列，不宣称优劣。
  </div>

  <div class="card">
    <div class="stats">
      <div class="stat"><b>${meta.totalSamples}</b><span>有效样本${
        meta.rankingOnly
          ? `（要求推荐类${meta.inputSamples && meta.inputSamples !== meta.totalSamples ? `，另有 ${meta.inputSamples - meta.totalSamples} 条方法论类不计入` : ''}）`
          : ''
      }</span></div>
      <div class="stat"><b>${meta.entities}</b><span>候选实体</span></div>
      <div class="stat"><b>${meta.prompts.length}</b><span>问题数</span></div>
      <div class="stat"><b>${meta.engines.length}</b><span>采样通道</span></div>
      <div class="stat"><b>${meta.regions.length}</b><span>地域</span></div>
      <div class="stat"><b>${esc(meta.methodologyVersion)}</b><span>方法论版本</span></div>
    </div>
  </div>

  <div class="card">
    <h2>主榜<span class="hint">按平均成对击败率排序</span></h2>
    ${
      tooThinToRank
        ? `<div class="warn">
      <b>样本量不足，暂不展示排名。</b>
      本榜当前只有 ${meta.totalSamples} 条有效回答（需要至少 ${minNeeded} 条才能对这 ${rows.length} 个候选给出有意义的名次）。
      <b>用这个样本量排出来的名次是噪声，不是结论</b> —— 与其发一个会被推翻的榜，不如先不发。
      请先增加采样量（更多问题、更多 AI、更多次重复）。
    </div>
    <p class="note">下方仍列出各实体的原始指标，供数据核对；但<b>名次一栏不作为任何结论使用</b>。</p>`
        : ''
    }
    ${mainTable(rows)}
    ${
      thinSample
        ? `<div class="notice" style="margin-top:14px">
      <b>样本量提示：本榜最大的并列区间覆盖了 ${Math.round(bandShare * 100)}% 的候选（第 ${widest.join('–')} 名）。</b>
      这意味着当前的回答数量<b>不足以把这些实体区分开</b>。头部几名与"全部零提及"的赛道级结论可以参考，
      但区间内部的名次差异没有统计意义，<b>不得据此处发布具体名次</b>。增加采样量后再看。
    </div>`
        : ''
    }
    ${
      bands.length
        ? `<p class="note"><b>统计不可区分：</b>第 ${bands.join('、')} 名的置信区间互相重叠，
在该区间内不得宣称任何一方优于另一方。</p>`
        : ''
    }
    <p class="note">名次依据是<b>平均成对击败率</b>：成对比较在同一条回答内部完成，
抵消了问题难度与模型偏好；ARS（综合分）仅用于展示与趋势追踪。</p>
    <p class="note"><b>CAV 下界</b>是防小样本虚高的机制：3 次采样全中也只能报 55.6%，而不是 100%。对外引用提及率请用这一列。</p>
  </div>

  ${typeSections(lb)}

  <div class="two">
    ${crossTable(byEngine, consortium.entities ?? [], '同一批问题，不同 AI 的答案', '分采样通道')}
    ${crossTable(
      byRegion,
      consortium.entities ?? [],
      '地域标签下的答案',
      '分地域（该维度未必产生真实差异）',
    )}
  </div>

  ${
    Object.keys(byRegion).length > 1
      ? `<div class="card" style="margin-top:-6px">
    <h2>关于"地域"这一维度<span class="hint">必须说清楚的事</span></h2>
    <p style="margin:0 0 8px;font-size:13.5px">上表的"地域"是采样时打的标签，<b>不等于真实的地区差异</b>。</p>
    <ul class="kv">
      <li>给同一次 API 调用打上不同地区标签，<b>模型不会感知，回答完全相同</b>。</li>
      <li>真正会产生地区差异的，是那些<b>自带联网检索并按地区返回结果</b>的 AI 产品；这一点需要对每个产品实测后才能标注。</li>
      <li>目前本项目<b>真正有意义的"分布式调查"是跨模型与跨语言两个轴</b>，跨地域要成立还需逐产品验证。</li>
    </ul>
    <p class="note">所以对外表述只能说"跨模型 / 跨语言调查"，<b>不能说"各地的 AI 都测了一遍"</b>。</p>
  </div>`
      : ''
  }

  <div class="card">
    <h2>评分方法与可复算性</h2>
    <ul class="kv">
      <li><b>排序依据：</b>成对击败率 = 100 × A 被提及而 B 未被提及的回答数 ÷ 至少一方被提及的回答数。</li>
      <li><b>指标权重：</b>${Object.entries(meta.weights).map(([k, v]) => `${esc(k)} ${(v * 100).toFixed(0)}%`).join(' · ')}（先验设定，不随参赛者变动，不做数据拟合）</li>
      <li><b>空值规范：</b>未被提及计 0；采样失败剔除出分母，绝不当作品牌缺席；分母为 0 记 null；未被提及时情感分记 0。</li>
      <li><b>不确定性：</b>Bootstrap ${meta.bootstrapIterations} 次，显著性水平 α=${esc(meta.alpha)}，最小可发布样本量 N=${esc(meta.minReportableN)}。</li>
      <li><b>随机种子：</b><code>${esc(meta.seed)}</code>（固定种子，同输入必然同输出）</li>
      <li><b>方法论指纹：</b><code>${esc(meta.fingerprint)}</code>（权重、锚点、空值策略任一变动，指纹即变）</li>
      <li><b>原始回答：</b>每条结论均可回溯到一条未经修改的 AI 原始回答及其采样参数。</li>
    </ul>
  </div>

  <footer>
    生成日期 ${esc(generatedAt)}｜${esc(siteName)}｜方法论版本 ${esc(meta.methodologyVersion)}
  </footer>
</div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* 品牌诊断报告                                                        */
/* ------------------------------------------------------------------ */

function metricCard(label, value, sub) {
  return `<div class="stat"><b>${value}</b><span>${esc(label)}${sub ? `<br>${esc(sub)}` : ''}</span></div>`;
}

// 修复建议的生成逻辑在 diagnose.js 的 buildAdvice()，随报告数据一起返回（属业务而非渲染）。

/**
 * @param {ReturnType<import('./diagnose.js').diagnoseEntity>} d
 * @param {{siteName?:string, generatedAt?:string, synthetic?:boolean}} [opts]
 */
export function renderDiagnoseHtml(d, opts = {}) {
  const siteName = opts.siteName ?? 'AI 认知榜';
  const generatedAt = opts.generatedAt ?? new Date().toISOString().slice(0, 10);
  const m = d.metrics;
  const SEVERITY_LABEL = {
    absent: '<span style="color:var(--red);font-weight:600">完全缺席</span>',
    severe: '<span style="color:var(--red)">严重不足</span>',
    weak: '时有时无',
    solid: '稳定覆盖',
    unknown: '—',
  };

  const gapRows = d.gaps.length
    ? d.gaps
        .map(
          (g) => `<tr>
  <td>${esc(g.prompt)}</td>
  <td class="ci">${esc(g.rivals.map((r) => `${r.name}(${r.count})`).join('、')) || '—'}</td>
  <td class="n"><span style="color:var(--red);font-weight:600">${g.severity === 'absent' ? '完全未提及' : `仅 ${pctv(g.mentionRate)}`}</span></td>
</tr>`,
        )
        .join('\n')
    : '';

  const promptRows = d.promptRows
    .slice()
    .sort((a, b) => (a.mentionRate ?? 0) - (b.mentionRate ?? 0))
    .map(
      (r) => `<tr>
  <td>${esc(r.prompt)}</td>
  <td class="n">${r.mentioned}/${r.total}</td>
  <td class="n">${pctv(r.mentionRate)}</td>
  <td class="n ci">${r.avgRank === null ? '—' : r.avgRank.toFixed(1)}</td>
  <td>${SEVERITY_LABEL[r.severity] ?? '—'}</td>
</tr>`,
    )
    .join('\n');

  const spreadTable = (rows, label) => {
    if (rows.length < 2) return '';
    const head = rows.map((r) => `<th class="n">${esc(r[label])}</th>`).join('');
    const rate = rows.map((r) => `<td class="n">${pctv(r.mentionRate)}</td>`).join('');
    const cnt = rows.map((r) => `<td class="n ci">${r.mentioned}/${r.total}</td>`).join('');
    return `<table><thead><tr><th>维度</th>${head}</tr></thead><tbody>
<tr><td>提及率</td>${rate}</tr>
<tr><td class="ci">提及/样本</td>${cnt}</tr>
</tbody></table>`;
  };

  const advices = d.advice ?? [];

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.entity.name)} · AI 认知诊断报告</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <div class="wrap">
    <p class="brand">贺去病 · ${esc(siteName)}</p>
    <h1>AI 认知诊断报告 · ${esc(d.entity.name)}</h1>
    <p class="sub">AI 认识你吗？它把你推荐给了谁？又认错了什么？</p>
  </div>
</header>

<div class="wrap">
${
  opts.synthetic
    ? `<div class="warn"><b>演示数据警告。</b>本报告基于程序合成的模拟样本生成，<b>不是真实测评结果，禁止对外引用</b>。</div>`
    : ''
}
  <div class="notice">
    <b>本报告不出售名次。</b>报告只回答"AI 现在怎么回答"与"缺口在哪里"，
    不承诺、也不涉及任何名次变化。名次由 AI 基于公开信息自行决定。
  </div>

  <div class="card">
    <h2>一句话结论</h2>
    <p style="margin:0;font-size:15px">${esc(d.headline)}</p>
  </div>

  <div class="card">
    <h2>核心指标<span class="hint">基于 ${d.sampleCount} 条有效回答</span></h2>
    <div class="stats">
      ${metricCard('提及率', pctv(m.mentionRate), 'AI 提到你的场景占比')}
      ${metricCard('CAV 下界', pctv(m.cav), '小样本折算后的可发布值')}
      ${metricCard('平均位次', m.avgRank === null ? '—' : m.avgRank.toFixed(1), `分母 ${m.avgRankDenominator} 条`)}
      ${metricCard('稳定性', m.stability === null ? '—' : m.stability.toFixed(2), '跨重复采样的一致程度')}
      ${metricCard('情感', m.sentiment === null ? '—' : m.sentiment.toFixed(2), '0=负面 0.5=中性 1=正面')}
      ${metricCard('幻觉率', m.hallucinationRate === null ? '—' : pctv(m.hallucinationRate), '含事实性错误的提及占比')}
    </div>
  </div>

  ${
    gapRows
      ? `<div class="card">
    <h2>认知缺口<span class="hint">最值得先处理的 ${d.gaps.length} 个场景</span></h2>
    <table><thead><tr><th>用户会这样问 AI</th><th>AI 推荐了</th><th class="n">你的情况</th></tr></thead>
    <tbody>${gapRows}</tbody></table>
    <p class="note">这些问题的共同点：AI 有明确的推荐对象，但那个对象不是你。
    说明在这些决策场景下，可被公开引用的信息里没有你。</p>
  </div>`
      : ''
  }

  <div class="card">
    <h2>逐场景明细</h2>
    <table><thead><tr><th>问题</th><th class="n">提及</th><th class="n">提及率</th><th class="n">平均位次</th><th>判定</th></tr></thead>
    <tbody>${promptRows}</tbody></table>
  </div>

  ${
    d.byEngine.length > 1 || d.byRegion.length > 1
      ? `<div class="two">
    ${d.byEngine.length > 1 ? `<div class="card"><h2>分通道<span class="hint">不同 AI 的差别</span></h2>${spreadTable(d.byEngine, 'engine')}</div>` : ''}
    ${d.byRegion.length > 1 ? `<div class="card"><h2>分地域<span class="hint">不同地区的差别</span></h2>${spreadTable(d.byRegion, 'region')}</div>` : ''}
  </div>`
      : ''
  }

  ${
    d.hallucinations.length
      ? `<div class="card">
    <h2>AI 认错的地方<span class="hint">${d.hallucinations.length} 条</span></h2>
    <table><thead><tr><th>AI 通道</th><th>地区</th><th>回答原文片段</th></tr></thead>
    <tbody>${d.hallucinations
      .map((h) => `<tr><td>${esc(h.engine)}</td><td>${esc(h.region)}</td><td class="ci">${esc(h.evidence)}</td></tr>`)
      .join('\n')}</tbody></table>
  </div>`
      : ''
  }

  <div class="card">
    <h2>修复建议</h2>
    ${advices
      .map(
        (a, i) => `<div style="margin-bottom:16px">
      <p style="margin:0 0 4px;font-weight:600">${i + 1}. ${esc(a.title)}</p>
      <p style="margin:0 0 4px;font-size:13.5px"><b>为什么：</b>${esc(a.why)}</p>
      <p style="margin:0 0 4px;font-size:13.5px"><b>怎么做：</b>${esc(a.how)}</p>
      <p style="margin:0;font-size:12.5px;color:var(--muted)">${esc(a.noPromise)}</p>
    </div>`,
      )
      .join('\n')}
    <p class="note">以上建议均为信息补齐与口径统一，属于咨询与内容工程范畴。
    <b>本平台不提供、也不接受任何形式的排名采购</b>；任何声称能"保证名次"的方案都与本平台无关。</p>
  </div>

  <footer>
    生成日期 ${esc(generatedAt)}｜${esc(siteName)}｜本报告模型与样本参数可复算
  </footer>
</div>
</body>
</html>`;
}
