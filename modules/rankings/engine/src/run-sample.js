#!/usr/bin/env node
/**
 * 真实采样入口：把榜单配置展开成采样矩阵，逐个调用真实模型并落盘。
 *
 *   node src/run-sample.js \
 *     --consortium ../data/consortia/hk-study-abroad.json \
 *     --providers  ../config/providers.local.json \
 *     --regions CN --runs 5 \
 *     --out ../data/samples/hk-study-abroad.raw.jsonl
 *
 * 加 --dry-run 只打印矩阵规模，不发任何请求（先把钱算清楚再跑）。
 *
 * 特性：
 *  - 断点续采：中断后重跑会自动跳过已成功的样本，不重复烧钱
 *  - 失败显式落盘并带 error 字段，续采时自动重试；失败绝不被当作"品牌缺席"
 *  - 凭据从文件读取，不打印、不回显、不写入任何产物
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { loadSamples, sampleConsortium } from './sampler/index.js';
import { openAICompatible } from './sampler/providers/openai-compatible.js';
import { parseSample } from './index.js';
import { checkHealth, renderHealthText } from './health.js';
import { scanUnknownEntities } from './unknown.js';

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

function resolveKey(spec, baseDir) {
  if (spec.apiKeyEnv && process.env[spec.apiKeyEnv]) return process.env[spec.apiKeyEnv];
  if (spec.apiKeyFile) {
    const p = isAbsolute(spec.apiKeyFile) ? spec.apiKeyFile : resolve(baseDir, spec.apiKeyFile);
    if (!existsSync(p)) {
      throw new Error(
        `通道 ${spec.id} 的凭据文件不存在：${p}\n` +
          `请把 API key 写入该文件（见 .secrets/README.md）`,
      );
    }
    const k = readFileSync(p, 'utf8').trim();
    if (!k) throw new Error(`通道 ${spec.id} 的凭据文件为空：${p}`);
    return k;
  }
  if (spec.apiKey) return spec.apiKey;
  throw new Error(`通道 ${spec.id} 未配置任何可用凭据（apiKeyFile / apiKeyEnv）`);
}

function buildProviders(specs, baseDir) {
  return specs.map((s) => {
    if (s.type && s.type !== 'openai-compatible') {
      throw new Error(`暂不支持的通道类型：${s.type}（当前仅支持 openai-compatible）`);
    }
    return openAICompatible({ ...s, apiKey: resolveKey(s, baseDir) });
  });
}

const bar = (done, total, width = 24) => {
  const filled = total ? Math.round((done / total) * width) : 0;
  return `[${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}] ${done}/${total}`;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const need = ['consortium', 'providers'];
  for (const k of need) {
    if (!args[k]) {
      console.error(`缺少 --${k}`);
      process.exit(2);
    }
  }
  const consortium = JSON.parse(readFileSync(resolve(args.consortium), 'utf8'));
  const providersPath = resolve(args.providers);
  const providersRaw = JSON.parse(readFileSync(providersPath, 'utf8'));
  const specs = Array.isArray(providersRaw) ? providersRaw : providersRaw.providers;
  if (!Array.isArray(specs) || !specs.length) {
    console.error('providers 配置必须是非空数组');
    process.exit(2);
  }
  const regions = String(args.regions ?? 'CN').split(',').map((s) => s.trim()).filter(Boolean);
  const runs = Number(args.runs ?? 5);
  const batch = String(args.batch ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const out = resolve(args.out ?? `../data/samples/${consortium.id}.raw.jsonl`);

  const cells = (consortium.prompts?.length ?? 0) * specs.length * regions.length * runs;

  console.log(`榜单：${consortium.title ?? consortium.id}`);
  console.log(`通道：${specs.map((p) => p.id).join('、')}`);
  console.log(`地域：${regions.join('、')}`);
  console.log(`意图：${consortium.prompts?.length ?? 0} 条｜重复：${runs} 次`);
  console.log(`矩阵规模：${cells} 次调用｜输出：${out}`);
  const perCall = Number(args['cost-per-call'] ?? 0);
  if (perCall > 0) console.log(`预估成本：约 ${(cells * perCall).toFixed(2)} 元（单价 ${perCall} 元/次）`);

  if (args['dry-run']) {
    console.log('\n--dry-run：不发任何请求、不读取凭据。去掉该参数即可开跑。');
    return;
  }

  // 凭据只在真正开跑时才解析，保证 --dry-run 可以在没有 key 的情况下先算清成本
  const providers = buildProviders(specs, dirname(providersPath));
  const t0 = Date.now();
  const res = await sampleConsortium({
    consortium,
    providers,
    regions,
    runs,
    batch,
    outPath: out,
    retry: { maxRetries: 2, retryDelayMs: 2000 },
    onProgress: ({ done, total }) => {
      if (done % 10 === 0 || done === total) process.stdout.write(`\r${bar(done, total)}`);
    },
  });
  process.stdout.write('\n');

  const ok = loadSamples(out);
  const all = loadSamples(out, { includeFailed: true });
  const failed = all.length - ok.length;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n完成：新采 ${res.sampled} 条，跳过已完成 ${res.skipped} 条，耗时 ${secs}s`);
  console.log(`有效样本 ${ok.length} 条${failed ? `｜失败 ${failed} 条（重跑本命令会自动重试）` : ''}`);
  if (ok.length && ok.length < 5) {
    console.log(`⚠️ 有效样本不足 5 条，引擎会标记为"不得对外发布"（最小可发布样本量 N=5）`);
  }

  // 采完立刻体检：数据能不能用，比"跑完了"重要得多。
  // 失败率高、解析不出来、回答过短 —— 这些在排名之前就必须看见。
  if (ok.length) {
    const entities = consortium.entities ?? [];
    const parsed = ok.map((s) => parseSample(s, entities, consortium.parse));
    const promptMeta = new Map((consortium.prompts ?? []).map((p) => [p.id, p]));
    const h = checkHealth({ rawSamples: all, parsedSamples: parsed, promptMeta });
    console.log('\n' + renderHealthText(h, consortium.title ?? consortium.id));

    // 漏收录检查：AI 提到但我们没收录的机构，会被静默忽略，
    // 结论就会变成"没人提到这家"——而真相是我们的表不全。这一步是防这个。
    const unknownHits = scanUnknownEntities(ok, entities, { minCount: 2, limit: 10 });
    if (unknownHits.length) {
      console.log('\n⚠️ 疑似漏收录（示例，需人工复核，勿自动入榜）：');
      for (const u of unknownHits) console.log(`  ${String(u.count).padStart(3)} 次  ${u.surface}`);
      console.log('  说明：这是提示工具，中文无词边界、误报常见。确认真实机构后补进实体表并附一手来源。');
    } else {
      console.log('\n未发现跨样本重复的漏收录候选。');
    }
  }

  console.log(`\n下一步：node src/cli.js rank --consortium ${args.consortium} --samples ${args.out ?? out}`);
}

main().catch((e) => {
  console.error(`\n采样失败：${e.message}`);
  process.exit(1);
});
