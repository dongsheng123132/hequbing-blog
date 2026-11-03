import { readFileSync } from 'node:fs';
import { surveyAction } from './survey-actions.js';

export function runSurveyCli(catalogPath, argv = process.argv.slice(2)) {
  try {
    const [command = 'list', ...rest] = argv;
    const args = {};
    for (let i = 0; i < rest.length; i += 2) {
      if (!['--industry', '--input', '--entities'].includes(rest[i]) || !rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error('参数无效');
      args[rest[i].slice(2)] = rest[i + 1];
    }
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const input = { industry: args.industry };
    if (args.entities) input.entities = JSON.parse(readFileSync(args.entities, 'utf8'));
    if (command === 'report' || command === 'brief') {
      if (!args.input) throw new Error('缺少 --input');
      const raw = readFileSync(args.input, 'utf8').replace(/^\uFEFF/, '');
      if (command === 'report') input.samples = raw.split(/\r?\n/).filter((s) => s.trim()).map((s) => JSON.parse(s));
      else input.request = JSON.parse(raw);
    }
    console.log(JSON.stringify({ ok: true, action: `survey.${command}`, result: surveyAction(`survey.${command}`, input, catalog) }, null, 2));
  } catch (e) {
    // 不回显原始 JSON，避免错误行里的私有资料进入日志。
    const message = e instanceof SyntaxError ? '输入不是有效 JSON/JSONL' : e.message;
    console.log(JSON.stringify({ ok: false, error: { code: 'SURVEY_INVALID_INPUT', message } }));
    process.exitCode = 1;
  }
}
