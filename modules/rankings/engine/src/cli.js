#!/usr/bin/env node
/**
 * 命令行入口。
 *
 *   node src/cli.js rank --consortium ../data/consortia/microwave-cn.json \
 *                        --samples ../data/samples/demo-microwave-cn.samples.jsonl \
 *                        [--format md|json|text]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildLeaderboard, parseSample } from './index.js';
import { renderDiagnoseHtml, renderLeaderboardHtml } from './render.js';
import { diagnoseEntity } from './diagnose.js';
import { checkHealth, renderHealthText } from './health.js';
import { renderValidationText, validateConsortium } from './validate.js';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        throw new Error(`${path} 第 ${i + 1} 行不是合法 JSON：${e.message}`);
      }
    });
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const num = (x) => x.toFixed(2);
const numv = (x) => (x === null || x === undefined ? '—' : num(x));
const pctv = (x) => (x === null || x === undefined ? '—' : pct(x));
const civ = (ci) => (!ci || ci[0] === null ? '—' : `${num(ci[0])} – ${num(ci[1])}`);

function fmtBand(r) {
  return r.band ? `${r.band[0]}–${r.band[1]}` : String(r.position);
}

function toMarkdown(lb) {
  const { consortium, rows, meta, byEngine, byRegion } = lb;
  const L = [];
  L.push(`# ${consortium.title ?? consortium.id}`);
  L.push('');
  L.push(
    `> 样本 ${meta.totalSamples} 条｜实体 ${meta.entities} 个｜Prompt ${meta.prompts.length} 个｜` +
      `引擎 ${meta.engines.join('、') || '—'}｜地域 ${meta.regions.join('、') || '—'}`,
  );
  L.push('');
  if (consortium.synthetic || lb.parsedSamples.some((s) => s.synthetic)) {
    L.push('> ⚠️ **本文件为演示用合成样本，不是真实测评结果，禁止对外引用。**');
    L.push('');
  }
  L.push('| 名次 | 实体 | 平均击败率 | 95% CI | ARS | 提及率 | 覆盖 AI | CAV 下界 | 胜/负/平 | 位次分 | 稳定性 |');
  L.push('|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of rows) {
    const m = r.metrics;
    const cover = r.engineCount > 1 ? `${(r.coveredEngines ?? []).length}/${r.engineCount}` : '—';
    L.push(
      `| ${fmtBand(r)} | ${r.name} | **${numv(r.meanWinRate)}** | ${civ(r.ci95)} | ${numv(r.ars)} | ` +
        `${pctv(m.mentionRate)} | ${cover} | ${pctv(m.cav)} | ${r.wins}/${r.losses}/${r.ties} | ` +
        `${numv(m.rankScore)} | ${numv(m.stability)} |`,
    );
  }
  L.push('');
  if (meta.engines.length > 1) {
    L.push(
      `> **覆盖 AI** 是跨通道覆盖率：这个实体在 ${meta.engines.length} 个采样通道里被几个提到过。` +
        `"AI 认识你"取决于用户在用哪个 AI —— 只在 1 个模型里出现，和多个模型都出现，是完全不同的处境。`,
    );
    L.push('');
  }
  L.push(
    '> 名次以**平均成对击败率**为准：成对比较在同一条回答内部完成，' +
      '抵消了 prompt 难度与引擎偏好；ARS 仅用于展示与趋势追踪。',
  );
  L.push('');
  L.push(
    '> **CAV 下界**（Jeffreys 后验下界）是"小样本防虚高"机制：3 次采样全中也只能报 0.56，' +
      '而不是 100%。对外引用提及率时应使用这一列。',
  );
  L.push('');
  const bands = rows.filter((r) => r.band);
  if (bands.length) {
    const uniq = [...new Set(bands.map((r) => `${r.band[0]}–${r.band[1]}`))];
    L.push(`**统计不可区分区间**：第 ${uniq.join('、')} 名区间内置信区间重叠，不得宣称彼此优劣。`);
    L.push('');
  }
  L.push(`评分权重：${Object.entries(meta.weights).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')}`);
  L.push('');
  L.push(
    `方法论版本 **${meta.methodologyVersion}**｜指纹 \`${meta.fingerprint}\`｜显著性水平 α=${meta.alpha}｜` +
      `最小可发布样本量 N=${meta.minReportableN}｜本批样本 ${meta.totalSamples}（${meta.reportable ? '达到' : '**未达到，不得对外发布**'}）`,
  );
  L.push('');
  L.push(`采样参数：Bootstrap ${meta.bootstrapIterations} 次，随机种子 ${meta.seed}（固定种子，结果可复算）`);
  L.push('');

  for (const [label, view] of [['分引擎视角', byEngine], ['分地域视角', byRegion]]) {
    const keys = Object.keys(view);
    if (keys.length < 2) continue;
    L.push(`## ${label}（同一批 Prompt，在不同采样通道上的认知差异）`);
    L.push('');
    L.push(`| 实体 | ${keys.map((k) => `${k} 名次 / ARS`).join(' | ')} |`);
    L.push(`|---|${keys.map(() => '---').join('|')}|`);
    for (const e of lb.consortium.entities) {
      const cells = keys.map((k) => {
        const row = view[k].rows.find((r) => r.entityId === e.id);
        return row ? `#${row.position} / ${num(row.ars)}` : '—';
      });
      L.push(`| ${e.name} | ${cells.join(' | ')} |`);
    }
    L.push('');
  }
  return L.join('\n');
}

function writeOut(args, html, label) {
  if (!args.out) {
    console.log(html);
    return;
  }
  const p = resolve(String(args.out));
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html, 'utf8');
  console.log(`已生成${label}：${p}`);
}

function toDiagnoseMarkdown(d) {
  const m = d.metrics;
  const SEVERITY = {
    absent: '完全缺席',
    severe: '严重不足',
    weak: '时有时无',
    solid: '稳定覆盖',
    unknown: '—',
  };
  const L = [];
  L.push(`# AI 认知诊断报告 · ${d.entity.name}`);
  L.push('');
  L.push(`> ${d.headline}`);
  L.push('');
  L.push('> 本报告不出售名次：只回答"AI 现在怎么回答"与"缺口在哪里"，不承诺任何名次变化。');
  L.push('');
  L.push('## 核心指标');
  L.push('');
  L.push('| 指标 | 值 | 说明 |');
  L.push('|---|---:|---|');
  L.push(`| 提及率 | ${pctv(m.mentionRate)} | 基于 ${d.sampleCount} 条有效回答 |`);
  L.push(`| CAV 下界 | ${pctv(m.cav)} | 小样本折算后的可发布值 |`);
  L.push(`| 平均位次 | ${m.avgRank === null ? '—' : m.avgRank.toFixed(1)} | 分母 ${m.avgRankDenominator} 条 |`);
  L.push(`| 稳定性 | ${numv(m.stability)} | 跨重复采样的一致程度 |`);
  L.push(`| 情感 | ${numv(m.sentiment)} | 0=负面 0.5=中性 1=正面 |`);
  L.push(`| 幻觉率 | ${pctv(m.hallucinationRate)} | 含事实性错误的提及占比 |`);
  L.push('');
  if (d.gaps.length) {
    L.push(`## 认知缺口（${d.gaps.length} 个场景）`);
    L.push('');
    L.push('| 用户会这样问 AI | AI 推荐了 | 你的情况 |');
    L.push('|---|---|---|');
    for (const g of d.gaps) {
      L.push(`| ${g.prompt} | ${g.rivals.map((r) => `${r.name}(${r.count})`).join('、') || '—'} | **未提及** |`);
    }
    L.push('');
  }
  L.push('## 逐场景明细');
  L.push('');
  L.push('| 问题 | 提及 | 提及率 | 平均位次 | 判定 |');
  L.push('|---|---:|---:|---:|---|');
  for (const r of [...d.promptRows].sort((a, b) => (a.mentionRate ?? 0) - (b.mentionRate ?? 0))) {
    L.push(
      `| ${r.prompt} | ${r.mentioned}/${r.total} | ${pctv(r.mentionRate)} | ` +
        `${r.avgRank === null ? '—' : r.avgRank.toFixed(1)} | ${SEVERITY[r.severity] ?? '—'} |`,
    );
  }
  L.push('');
  if (d.hallucinations.length) {
    L.push(`## AI 认错的地方（${d.hallucinations.length} 条）`);
    L.push('');
    for (const h of d.hallucinations) L.push(`- [${h.engine}/${h.region}] ${h.evidence}`);
    L.push('');
  }
  L.push('## 修复建议');
  L.push('');
  for (const [i, a] of d.advice.entries()) {
    L.push(`${i + 1}. **${a.title}**`);
    L.push(`   - 为什么：${a.why}`);
    L.push(`   - 怎么做：${a.how}`);
    L.push(`   - ${a.noPromise}`);
  }
  L.push('');
  L.push('> 本平台不提供、也不接受任何形式的排名采购；任何声称能"保证名次"的方案都与本平台无关。');
  return L.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] ?? 'rank';

  // validate 只需要榜单配置，不需要样本
  if (cmd === 'validate') {
    if (!args.consortium) {
      console.error('缺少 --consortium');
      process.exit(2);
    }
    const c = JSON.parse(readFileSync(args.consortium, 'utf8'));
    const v = validateConsortium(c);
    if ((args.format ?? 'md') === 'json') console.log(JSON.stringify(v, null, 2));
    else console.log(renderValidationText(v, c.title ?? c.id));
    process.exit(v.ok ? 0 : 1);
  }

  if (!args.consortium || !args.samples) {
    console.error('缺少 --consortium 或 --samples');
    process.exit(2);
  }
  const consortium = JSON.parse(readFileSync(args.consortium, 'utf8'));
  const raw = readJsonl(args.samples);
  const format = args.format ?? 'md';
  const site = args.site ?? 'AI 认知榜';

  if (cmd === 'rank') {
    const lb = buildLeaderboard({
      consortium,
      samples: raw,
      // 只用"要求推荐/对比"的问题算排名：实测 AI 在方法论类问题上一条机构名都不给，
      // 用那些样本会把"AI 不给名单"误算成"这些品牌认知度低"
      rankingOnly: Boolean(args['ranking-only']),
    });
    if (format === 'json') {
      console.log(
        JSON.stringify(
          { meta: lb.meta, rows: lb.rows, byEngine: lb.byEngine, byRegion: lb.byRegion },
          null,
          2,
        ),
      );
    } else if (format === 'html') {
      writeOut(args, renderLeaderboardHtml(lb, { siteName: site }), '榜单页');
    } else {
      console.log(toMarkdown(lb));
    }
    return;
  }

  if (cmd === 'diagnose') {
    if (!args.entity) {
      console.error('缺少 --entity（要诊断的实体 id，取值见榜单配置里的 entities[].id）');
      process.exit(2);
    }
    const entities = consortium.entities ?? [];
    const parsed = raw.map((s) => parseSample(s, entities, consortium.parse));
    const d = diagnoseEntity({
      samples: parsed,
      entities,
      entityId: String(args.entity),
      topK: consortium.topK,
      // 与榜单同口径：默认只用"要求推荐/对比"的问题；加 --all-prompts 可看全部（含 AI 不给名单的题）
      rankingOnly: !args['all-prompts'],
      prompts: consortium.prompts,
    });
    const synthetic = Boolean(consortium.synthetic) || raw.some((s) => s.synthetic);
    if (format === 'json') console.log(JSON.stringify(d, null, 2));
    else if (format === 'html') {
      writeOut(args, renderDiagnoseHtml(d, { siteName: site, synthetic }), '诊断报告');
    } else console.log(toDiagnoseMarkdown(d));
    return;
  }

  if (cmd === 'health') {
    // 健康度检查要看**全部**样本（含失败行）——失败率本身就是关键指标
    const entities = consortium.entities ?? [];
    const valid = raw.filter((s) => !s.error && typeof s.raw === 'string');
    const parsed = valid.map((s) => parseSample(s, entities, consortium.parse));
    // 用榜单配置里的 Prompt 表补全 expectsMention，避免把"本就不点名机构的问题"误判成解析故障
    const promptMeta = new Map((consortium.prompts ?? []).map((p) => [p.id, p]));
    const h = checkHealth({ rawSamples: raw, parsedSamples: parsed, promptMeta });
    if (format === 'json') console.log(JSON.stringify(h, null, 2));
    else console.log(renderHealthText(h, consortium.title ?? consortium.id));
    return;
  }

  console.error(
    `未知命令：${cmd}\n用法：\n` +
      `  node src/cli.js rank     --consortium <json> --samples <jsonl> [--format md|json|html] [--out <file>]\n` +
      `  node src/cli.js diagnose --consortium <json> --samples <jsonl> --entity <id> [--format md|json|html] [--out <file>]\n` +
      `  node src/cli.js health   --consortium <json> --samples <jsonl> [--format md|json]`,
  );
  process.exit(2);
}

main();
