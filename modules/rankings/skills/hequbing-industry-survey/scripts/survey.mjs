import { existsSync } from 'node:fs';
const runtime = new URL('../runtime/survey-cli.js', import.meta.url);
// 开发树复用唯一源码；分发包使用构建时带出的同一份运行时。
const { runSurveyCli } = await import(existsSync(runtime) ? runtime.href : new URL('../../../engine/src/survey-cli.js', import.meta.url).href);
runSurveyCli(new URL('../data/industries.json', import.meta.url));
