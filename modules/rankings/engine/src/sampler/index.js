/**
 * 采样器：把榜单配置展开成采样矩阵，逐条调用真实 AI 并落盘。
 *
 * 设计要点：
 *  - **断点续采**：每条样本落盘后立刻可恢复，中断不重头来。采样慢且贵，这是硬需求。
 *  - **原始回答一字不改**：raw 字段是审计证据，任何加工都发生在解析阶段，不回写样本。
 *  - **失败不吞**：失败的单元写 error 样本并继续，绝不静默跳过（静默跳过会让
 *    "某品牌没被提及"与"那条请求失败了"混为一谈，直接毁掉排名）。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * @typedef {object} Provider
 * @property {string} id 采样通道标识，如 'doubao'
 * @property {(prompt: string, ctx: {region: string, locale: string}) => Promise<{text: string, model?: string}>} ask
 */

/**
 * 展开采样矩阵。
 * @returns {Array<{sampleId:string, engine:string, region:string, locale:string, promptId:string, prompt:string, run:number, batch:string}>}
 */
export function buildMatrix({ consortium, providers, regions, runs = 3, batch = 'b1' }) {
  const prompts = consortium.prompts ?? [];
  if (!prompts.length) throw new Error('榜单配置缺少 prompts');
  if (!providers.length) throw new Error('至少需要一个采样通道');
  if (!regions.length) throw new Error('至少需要一个地域');
  const cells = [];
  for (const p of providers) {
    for (const region of regions) {
      for (const prompt of prompts) {
        for (let run = 1; run <= runs; run++) {
          cells.push({
            sampleId: `${batch}__${p.id}__${region}__${prompt.id}__r${run}`,
            engine: p.id,
            region,
            locale: consortium.locale ?? 'zh-CN',
            promptId: prompt.id,
            // intent 是"改写轴"的分组键：同一 intent 下的多条 Prompt 是同义改写
            intent: prompt.intent ?? prompt.id,
            // 有些问题（如"怎么避坑""收费多少"）本来就不该点名机构，
            // 健康检查据此区分"解析失败"与"问题本身不涉及名单"
            expectsMention: prompt.expectsMention !== false,
            // ranking：问题本身要求推荐/对比，**用于排名**
            // behavior：问题在问方法论，实测 AI 一条机构名都不给，**只记录行为**
            purpose: prompt.purpose ?? 'ranking',
            prompt: prompt.text,
            run,
            batch,
          });
        }
      }
    }
  }
  return cells;
}

/** 读取已完成样本的 sampleId 集合，用于断点续采。 */
export function loadDoneIds(outPath) {
  if (!existsSync(outPath)) return new Set();
  const ids = new Set();
  for (const line of readFileSync(outPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const s = JSON.parse(line);
      // 只有成功样本才算"已完成"；失败样本必须重试
      if (s.sampleId && !s.error) ids.add(s.sampleId);
    } catch {
      /* 半截行（上次写到一半被杀）忽略，会在下次续采时重写 */
    }
  }
  return ids;
}

/**
 * 执行采样。
 * @param {object} p
 * @param {object} p.consortium
 * @param {Provider[]} p.providers
 * @param {string[]} p.regions
 * @param {number} [p.runs]
 * @param {string} p.outPath JSONL 输出路径
 * @param {(ctx:{done:number,total:number,cell:object}) => void} [p.onProgress]
 * @param {{maxRetries?:number, retryDelayMs?:number}} [p.retry]
 * @param {boolean} [p.resume]
 */
export async function sampleConsortium({
  consortium,
  providers,
  regions,
  runs = 3,
  outPath,
  onProgress,
  retry = {},
  resume = true,
  batch = 'b1',
  now = () => new Date().toISOString(),
}) {
  const maxRetries = retry.maxRetries ?? 2;
  const retryDelayMs = retry.retryDelayMs ?? 1500;
  const cells = buildMatrix({ consortium, providers, regions, runs, batch });
  const byId = new Map(providers.map((p) => [p.id, p]));
  const done = resume ? loadDoneIds(outPath) : new Set();

  mkdirSync(dirname(outPath), { recursive: true });

  const pending = cells.filter((c) => !done.has(c.sampleId));
  let finished = 0;

  for (const cell of pending) {
    const provider = byId.get(cell.engine);
    const record = {
      industryId: consortium.id,
      sampleId: cell.sampleId,
      promptId: cell.promptId,
      intent: cell.intent,
      expectsMention: cell.expectsMention,
      purpose: cell.purpose,
      prompt: cell.prompt,
      engine: cell.engine,
      channel: provider.channel ?? 'unknown',
      webSearch: consortium.sampling?.webSearch ?? 'unknown',
      region: cell.region,
      locale: cell.locale,
      run: cell.run,
      batch,
      ts: now(),
      params: consortium.sampling ?? {},
    };
    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await provider.ask(cell.prompt, { region: cell.region, locale: cell.locale });
        record.raw = res.text ?? '';
        record.model = res.model ?? provider.model ?? null;
        record.usage = res.usage ?? null;
        record.finishReason = res.finishReason ?? null;
        record.providerRequestId = res.providerRequestId ?? null;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
        }
      }
    }
    if (lastErr) {
      // 失败必须显式落盘，且带 error 字段；续采时会重试（loadDoneIds 只认成功样本）
      record.error = String(lastErr.message ?? lastErr);
      record.raw = null;
    }
    appendFileSync(outPath, JSON.stringify(record) + '\n', 'utf8');
    finished++;
    onProgress?.({ done: finished, total: pending.length, cell });
  }

  return { total: cells.length, skipped: cells.length - pending.length, sampled: finished };
}

/** 从 JSONL 读回样本，默认丢弃失败样本。 */
export function loadSamples(outPath, { includeFailed = false } = {}) {
  const rows = readFileSync(outPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  return includeFailed ? rows : rows.filter((r) => !r.error && typeof r.raw === 'string');
}
