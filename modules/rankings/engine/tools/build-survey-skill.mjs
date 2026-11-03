import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = resolve(root, 'skills/hequbing-industry-survey');
const { version } = JSON.parse(readFileSync(resolve(source, 'data/industries.json'), 'utf8'));
const out = resolve(process.argv[2] ?? resolve(root, `.local/skill-packages/hequbing-industry-survey-${version}`));
if (existsSync(out)) throw new Error('输出目录已存在；请指定新的包目录，避免覆盖审阅版本');
mkdirSync(out, { recursive: true });
cpSync(source, out, { recursive: true });
const runtime = ['survey-actions.js', 'survey-cli.js', 'parse.js', 'zh.js', 'metrics.js', 'beta.js', 'methodology.js', 'rng.js'];
mkdirSync(resolve(out, 'runtime'));
const files = {};
for (const name of runtime) {
  const origin = resolve(root, 'engine/src', name);
  cpSync(origin, resolve(out, 'runtime', name));
  files[`runtime/${name}`] = createHash('sha256').update(readFileSync(origin)).digest('hex');
}
writeFileSync(resolve(out, 'package.json'), JSON.stringify({ name: 'hequbing-industry-survey', version, type: 'module', private: true, engines: { node: '>=20' } }, null, 2));
writeFileSync(resolve(out, 'build-manifest.json'), JSON.stringify({ version, generatedRuntime: true, files }, null, 2));
console.log(JSON.stringify({ ok: true, output: out, runtimeFiles: runtime.length }));
