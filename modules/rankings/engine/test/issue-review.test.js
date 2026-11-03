import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewIssue } from '../src/issue-review.js';
const catalog = {industries:[{id:'x',title:'测试',prompts:[{id:'p',purpose:'ranking',text:'固定问题'}]}]};
const cohort = {issue:'2026-10',industries:[{id:'x',entities:[{id:'a',name:'甲工厂'}]}]};
const row = (model,run) => ({sampleId:`${model}-${run}`,industryId:'x',promptId:'p',prompt:'固定问题',engine:'provider',model,
  channel:'api',webSearch:false,region:'unknown',locale:'zh-CN',batch:'b',ts:'2026-10-05T01:00:00Z',run,raw:'甲工厂'});
const review = samples => reviewIssue({catalog,cohort,industryId:'x',samples});

test('失败不进入分母，旧题不混入，新问题覆盖不足不通过',()=>{
  const report=review([row('a',1),{...row('a',2),error:'timeout',raw:null}]);
  assert.equal(report.coverage.validSamples,1);
  assert.equal(report.coverage.failedRows,1);
  assert.equal(report.byModel[0].metrics[0].samples,1);
  assert.equal(report.checks[0].passed,false);
  assert.throws(()=>review([{...row('a',1),prompt:'另一套旧题'}]),/冻结题库/);
});
test('重复模型和重复单元不能冒充完整多模型多轮调查',()=>{
  assert.equal(review([1,2,3].map(r=>row('a',r))).checks[0].passed,false);
  assert.throws(()=>review([row('a',1),{...row('a',1),sampleId:'changed-id'}]),/重复回答/);
  assert.equal(review([row('a',1),row('a',1)]).coverage.duplicateRows,1);
});
test('同题两模型各三轮只通过采样覆盖，不跳过主体和漏收录审查',()=>{
  const report=review(['a','b'].flatMap(m=>[1,2,3].map(r=>row(m,r))));
  assert.equal(report.checks[0].passed,true);
  assert.equal(report.reportable,false);
  assert.equal(report.checks.find(c=>c.id==='unknown_entities').passed,false);
  assert.equal(review([{...row('a',1),ts:'2026-09-10T00:00:00Z'}]).checks.find(c=>c.id==='issue_window').passed,false);
});
