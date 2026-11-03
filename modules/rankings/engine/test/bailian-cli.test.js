import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bailianCLI } from '../src/sampler/providers/bailian-cli.js';
import { paidSamplingScope } from '../src/sampler/paid-scope.js';
import { createHash } from 'node:crypto';

test('新增企业行业不扩大付费范围，冻结题库兼容旧断点并拒绝内容漂移', () => {
  const oldPlan = { issue: '2026-10', maxRuns: 3 };
  const oldCatalog = { version: '0.2.1', industries: [{ id: 'a', prompts: [{ text: '原题' }] }] };
  const fingerprint = createHash('sha256').update(JSON.stringify({ plan: oldPlan, catalog: oldCatalog })).digest('hex');
  const plan = { ...oldPlan, industryIds: ['a'], catalogVersion: '0.2.1' };
  const expanded = { version: '0.2.2', industries: [...oldCatalog.industries, { id: 'b', prompts: [{ text: '新题' }] }] };
  const scoped = paidSamplingScope(plan, expanded);
  assert.deepEqual(scoped.catalog, oldCatalog);
  assert.equal(scoped.fingerprint, fingerprint);
  const changed = structuredClone(expanded);
  changed.industries[0].prompts[0].text = '修改后的题';
  assert.notEqual(paidSamplingScope(plan, changed).fingerprint, fingerprint);
  assert.throws(() => paidSamplingScope(oldPlan, expanded), /行业 ID/);
  assert.throws(() => paidSamplingScope({ ...plan, industryIds: ['a', 'a'] }, expanded), /行业 ID/);
  assert.throws(() => paidSamplingScope({ ...plan, industryIds: ['missing'] }, expanded), /不存在/);
});

test('百炼保留实际模型、用量、结束原因与请求 ID，使用非流式 JSON', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bailian-adapter-'));
  try {
    const cliPath = join(dir, 'mock.mjs');
    writeFileSync(cliPath, `const a=process.argv.slice(2);
      if(a.includes('--quiet') || a.includes('--no-stream') || a.includes('--api-key') || !a.includes('json')) process.exit(2);
      console.log(JSON.stringify({model:'actual-model',usage:{prompt_tokens:10,completion_tokens:20},id:'request1',choices:[{finish_reason:'length',message:{content:'原始回答'}}]}));`);
    const result = await bailianCLI({ id:'test', model:'requested-model', cliPath }).ask('固定问题');
    assert.deepEqual(result, {text:'原始回答', model:'actual-model', usage:{prompt_tokens:10,completion_tokens:20}, finishReason:'length', providerRequestId:'request1'});
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('百炼子进程错误不把命令及敏感 stderr 带入原始样本', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bailian-error-'));
  try {
    const cliPath = join(dir, 'mock.mjs');
    writeFileSync(cliPath, `console.error('credential-placeholder');process.exit(2);`);
    await assert.rejects(bailianCLI({id:'test',model:'test',cliPath}).ask('固定问题'), error => {
      assert.match(error.message,/退出码 2/);
      assert.ok(!error.message.includes('credential-placeholder'));
      return true;
    });
  } finally { rmSync(dir, { recursive:true, force:true }); }
});
