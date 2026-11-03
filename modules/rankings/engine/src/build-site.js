#!/usr/bin/env node
/**
 * 整站生成：把多个榜单渲染成一套可直接部署的静态站点。
 *
 *   node src/build-site.js --config ../site/site.config.json
 *
 * 产出 site/dist/：首页 + 每个榜单页。全部自包含（内联样式、无 CDN、无外链资源），
 * 可直接丢到任何静态托管上。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildLeaderboard } from './index.js';
import { renderLeaderboardHtml } from './render.js';
import { renderMethodologyPage, renderSiteIndex, renderPendingBoard } from './site.js';
import { toPublicIndex, toPublicJson } from './export.js';
import { METHODOLOGY_VERSION, SCORING_ALPHA, MIN_REPORTABLE_N } from './methodology.js';
import { DEFAULT_WEIGHTS } from './score.js';

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

const NAV = '<a href="index.html">← 全部榜单</a><a href="methodology.html">方法论</a>';

/**
 * 自动挑选数据源。
 *
 * 优先级：**真实数据永远优先于合成数据**，同类里再取样本量最大的。
 *
 * 这个函数被修过两次，两次都静默出错，值得记下来：
 *  - 第一版按文件名优先级（all > real > pilot > demo）→ 一次补采新建的 2 条
 *    `xxx.all.jsonl` 顶掉了已有 20 条的 `xxx.real.jsonl`；
 *  - 第二版改成"按样本量最大"→ 合成演示数据（150 条）反而压过了真实数据（42 条），
 *    整站四个榜单全被标成"演示"。
 *  两次都是"看起来更合理"的规则，两次都没有任何报错。
 *  所以最终规则必须显式表达业务优先级，而不是靠文件名或数量猜。
 */
export function autoFindSamples(root, id) {
  const candidates = [
    `data/samples/${id}.all.jsonl`,
    `data/samples/${id}.real.jsonl`,
    `data/samples/${id}.pilot.jsonl`,
    `data/samples/${id}.demo.samples.jsonl`,
  ];
  const found = [];
  for (const c of candidates) {
    const p = resolve(root, c);
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim());
    if (!lines.length) continue;
    let synthetic = c.includes('demo');
    try {
      synthetic = Boolean(JSON.parse(lines[0]).synthetic);
    } catch {
      /* 保持文件名推断 */
    }
    found.push({ path: p, rel: c, n: lines.length, synthetic });
  }
  if (!found.length) {
    throw new Error(
      `找不到 ${id} 的样本文件。已尝试：\n  ${candidates.join('\n  ')}\n` +
        '请先跑采样，或在 site.config.json 里显式指定 samples。',
    );
  }
  const real = found.filter((f) => !f.synthetic);
  const pool = real.length ? real : found; // 有真实数据就绝不用合成数据
  pool.sort((a, b) => b.n - a.n);
  return { ...pool[0], alternativeCount: found.length };
}

/**
 * @param {object} p
 * @param {string} p.configPath site.config.json 路径
 * @param {string} [p.outDir] 覆盖配置里的输出目录
 * @param {string} [p.only] 只构建某个榜单 id（调试用）
 */
export function buildSite({ configPath, outDir, only, basePath }) {
  if (basePath !== undefined && !/^\/(?:[a-zA-Z0-9-]+\/)*$/.test(basePath)) throw new Error('站点挂载路径须以 / 开始和结束');
  const configAbs = resolve(configPath);
  // 约定：site.config.json 放在 site/ 下，项目根是它的上一级
  const root = resolve(dirname(configAbs), '..');
  const config = JSON.parse(readFileSync(configAbs, 'utf8'));
  const catalog = config.catalog ? JSON.parse(readFileSync(resolve(root, config.catalog), 'utf8')) : null;
  const cohort = config.cohort ? JSON.parse(readFileSync(resolve(root, config.cohort), 'utf8')) : null;
  if (cohort && cohort.issue !== config.issue) throw new Error('候选清单期号与网站期号不一致');
  const out = resolve(root, outDir ?? config.outDir ?? 'site/dist');
  mkdirSync(out, { recursive: true });

  const boards = [];
  const written = [];
  const builtMeta = [];

  for (const board of config.boards ?? []) {
    if (['planned', 'collecting'].includes(board.status)) {
      const industry = catalog?.industries.find((item) => item.id === board.industryId);
      if (!industry || !/^[a-z0-9-]+$/.test(industry.id)) throw new Error('采样中榜单缺少有效行业题库');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(config.issue ?? '')) throw new Error('首期期号必须为 YYYY-MM');
      if (only && industry.id !== only) continue;
      // 采样中不读取历史/自动挑选的答案，也不把关联种子企业做成唯一冠军。
      const href = `${config.issue}/${industry.id}.html`;
      const dataUrl = `data/${config.issue}/${industry.id}.json`;
      const candidates = cohort?.industries.find(item => item.id === industry.id);
      if (cohort && !candidates) throw new Error('本期候选清单缺少行业');
      const publication = {
        schemaVersion: '1.0', id: industry.id, title: board.title ?? industry.title,
        issue: config.issue, status: board.status, reportable: false,
        reason: board.pendingReason, market: industry.market, cadence: config.cadence,
        sampleCount: null, entityCount: null, engines: [], rows: [],
        prompts: industry.prompts, methodologyVersion: METHODOLOGY_VERSION,
        ...(candidates ? { candidateReview: { ...candidates, evidenceBoundary: cohort.evidenceBoundary, updatedAt: cohort.updatedAt } } : {}),
      };
      mkdirSync(dirname(resolve(out, href)), { recursive: true });
      mkdirSync(dirname(resolve(out, dataUrl)), { recursive: true });
      writeFileSync(resolve(out, href), renderPendingBoard({ ...publication, brand: config.brand, siteName: config.siteName }), 'utf8');
      writeFileSync(resolve(out, dataUrl), JSON.stringify(publication, null, 2), 'utf8');
      written.push(href, dataUrl);
      boards.push({ ...publication, href, dataUrl, category: board.category, regions: [], isSynthetic: false, leaders: [] });
      continue;
    }
    const consortium = JSON.parse(readFileSync(resolve(root, board.consortium), 'utf8'));
    if (only && consortium.id !== only) continue;
    const picked = board.samples
      ? { path: resolve(root, board.samples), rel: board.samples }
      : autoFindSamples(root, consortium.id);
    const samples = readJsonl(picked.path);
    // 与 CLI 同口径：默认只统计"要求推荐/对比"的问题。
    // 不同步会导致网页与命令行给出两套数字 —— 这是最容易被质疑的地方。
    const rankingOnly = board.rankingOnly ?? config.rankingOnly ?? false;
    const lb = buildLeaderboard({ consortium, samples, rankingOnly });

    const href = `${consortium.id}.html`;
    const html = renderLeaderboardHtml(lb, {
      siteName: config.siteName,
      brand: config.brand,
      nav: NAV,
    });
    writeFileSync(resolve(out, href), html, 'utf8');
    written.push(href);
    builtMeta.push(lb.meta);

    // 开放数据与页面同源生成，保证订阅方拿到的数字与网页上完全一致
    const dataDir = resolve(out, 'data');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      resolve(dataDir, `${consortium.id}.json`),
      JSON.stringify(toPublicJson({ consortium, lb }), null, 2),
      'utf8',
    );
    written.push(`data/${consortium.id}.json`);

    boards.push({
      id: consortium.id,
      title: consortium.title ?? consortium.id,
      href,
      category: consortium.category,
      sampleCount: lb.meta.totalSamples,
      entityCount: lb.meta.entities,
      engines: lb.meta.engines,
      regions: lb.meta.regions,
      isSynthetic: Boolean(consortium.synthetic) || samples.some((s) => s.synthetic),
      dataSource: picked.rel,
      // 首页只露"被提到最多"的几家，不用名次口径表述，避免首页就变成名次宣示
      leaders: lb.rows
        .slice(0, 3)
        .filter((r) => r.metrics.mentionRate > 0)
        .map((r) => r.name),
    });
  }

  boards.sort((a, b) => (b.sampleCount ?? -1) - (a.sampleCount ?? -1));

  const index = renderSiteIndex({
    basePath,
    siteName: config.siteName,
    brand: config.brand,
    tagline: config.tagline,
    cadence: config.cadence,
    boards,
    generatedAt: new Date().toISOString().slice(0, 10),
    methodologyVersion: METHODOLOGY_VERSION,
  });
  writeFileSync(resolve(out, 'index.html'), index, 'utf8');
  written.push('index.html');

  // 方法论页：从第一个成功构建的榜单里取真实参数，避免页面上写的是手抄的旧值
  const firstMeta = builtMeta[0] ?? {};
  const methodology = renderMethodologyPage({
    siteName: config.siteName,
    brand: config.brand,
    generatedAt: new Date().toISOString().slice(0, 10),
    methodologyVersion: METHODOLOGY_VERSION,
    fingerprint: firstMeta.fingerprint,
    weights: firstMeta.weights ?? DEFAULT_WEIGHTS,
    alpha: firstMeta.alpha ?? SCORING_ALPHA,
    minN: firstMeta.minReportableN ?? MIN_REPORTABLE_N,
  });
  writeFileSync(resolve(out, 'methodology.html'), methodology, 'utf8');
  written.push('methodology.html');

  writeFileSync(
    resolve(out, 'data', 'index.json'),
    JSON.stringify(toPublicIndex({ siteName: config.siteName, boards }), null, 2),
    'utf8',
  );
  written.push('data/index.json');

  return { outDir: out, boards: boards.length, files: written };
}

function main() {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      args[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  if (!args.config) {
    console.error('缺少 --config <site.config.json>');
    process.exit(2);
  }
  const res = buildSite({ configPath: String(args.config), outDir: args.out, only: args.only });
  console.log(`已生成 ${res.files.length} 个文件 → ${res.outDir}`);
  for (const f of res.files) console.log(`  ${f}`);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('build-site.js')) {
  main();
}
