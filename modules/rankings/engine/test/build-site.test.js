import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { autoFindSamples, buildSite } from '../src/build-site.js';

/**
 * 这个函数被修过两次、两次都静默出错，所以测试必须钉死业务优先级：
 *   真实数据 > 合成数据；同类里取样本量最大的。
 */

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'ari-site-'));
  mkdirSync(join(root, 'data', 'samples'), { recursive: true });
  return root;
}

function write(root, name, rows) {
  const lines = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(join(root, 'data', 'samples', name), lines, 'utf8');
}

const real = (i) => ({ sampleId: `r${i}`, raw: 'ok', engine: 'e1' });
const synth = (i) => ({ sampleId: `s${i}`, raw: 'ok', engine: 'e1', synthetic: true });

test('真实数据优先于合成数据，即使合成数据条数更多', () => {
  const root = makeRoot();
  try {
    // 这正是实际踩到的坑：150 条合成样本压过了 42 条真实样本
    write(root, 'x.real.jsonl', Array.from({ length: 42 }, (_, i) => real(i)));
    write(root, 'x.demo.samples.jsonl', Array.from({ length: 150 }, (_, i) => synth(i)));
    const picked = autoFindSamples(root, 'x');
    assert.equal(picked.rel, 'data/samples/x.real.jsonl');
    assert.equal(picked.synthetic, false);
    assert.equal(picked.n, 42);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('同类数据里取样本量最大的（避免小文件顶掉大文件）', () => {
  const root = makeRoot();
  try {
    // 实际踩到的坑：补采新建的 2 条 all.jsonl 顶掉了 20 条 real.jsonl
    write(root, 'x.all.jsonl', Array.from({ length: 2 }, (_, i) => real(i)));
    write(root, 'x.real.jsonl', Array.from({ length: 20 }, (_, i) => real(i)));
    const picked = autoFindSamples(root, 'x');
    assert.equal(picked.rel, 'data/samples/x.real.jsonl');
    assert.equal(picked.n, 20);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('没有真实数据时才用合成数据', () => {
  const root = makeRoot();
  try {
    write(root, 'x.demo.samples.jsonl', Array.from({ length: 10 }, (_, i) => synth(i)));
    const picked = autoFindSamples(root, 'x');
    assert.equal(picked.rel, 'data/samples/x.demo.samples.jsonl');
    assert.equal(picked.synthetic, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('一个都没有时明确报错，而不是静默返回空', () => {
  const root = makeRoot();
  try {
    assert.throws(() => autoFindSamples(root, 'nope'), /找不到 nope 的样本文件/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('空文件被跳过（不选一个 0 条的文件）', () => {
  const root = makeRoot();
  try {
    writeFileSync(join(root, 'data', 'samples', 'x.all.jsonl'), '\n\n', 'utf8');
    write(root, 'x.real.jsonl', Array.from({ length: 3 }, (_, i) => real(i)));
    const picked = autoFindSamples(root, 'x');
    assert.equal(picked.rel, 'data/samples/x.real.jsonl');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('采样中首期不读取历史样本、不排种子企业，网页和 JSON 同步声明未知', () => {
  const root = makeRoot();
  try {
    mkdirSync(join(root, 'site'));
    write(root, 'x.all.jsonl', Array.from({length:30}, (_,i) => ({...real(i), raw:'1. 种子企业'})));
    writeFileSync(join(root, 'catalog.json'), JSON.stringify({industries:[{id:'x',market:'测试行业',entities:[{id:'seed',name:'种子企业'}],prompts:[{id:'q1',purpose:'ranking',text:'<script>测试问题</script>'}]}]}));
    const config = {siteName:'测试认知榜',catalog:'catalog.json',issue:'2026-10',boards:[{industryId:'x',title:'测试行业',status:'collecting',pendingReason:'测试未就绪'}]};
    const configPath = join(root, 'site', 'site.config.json');
    writeFileSync(configPath, JSON.stringify(config));
    const result = buildSite({configPath, outDir:'out'});
    assert.equal(result.boards,1);
    const index = JSON.parse(readFileSync(join(root,'out','data','index.json'),'utf8'));
    const published = JSON.parse(readFileSync(join(root,'out',index.datasets[0].url),'utf8'));
    assert.equal(published.status,'collecting');
    assert.equal(published.reportable,false);
    assert.equal(published.sampleCount,null);
    assert.equal(published.entityCount,null);
    assert.deepEqual(published.rows,[]);
    assert.equal(index.datasets[0].status,published.status);
    const page = readFileSync(join(root,'out',index.datasets[0].pageUrl),'utf8');
    assert.match(page,/首期采样中/);
    assert.ok(!page.includes('种子企业'));
    assert.ok(!page.includes('<script>'));
    const cohort = {issue:'2026-10',evidenceBoundary:'仅官网自述',industries:[{id:'x',scope:'同类业务待核对',entities:[{
      id:'seed',name:'种子企业',affiliation:'发起人关联企业',sources:[{url:'javascript:alert(1)',supports:'恶意链接'},{url:'https://example.com/',supports:'官网来源'}],pending:['主体核验']
    }]}]};
    config.cohort='cohort.json';
    writeFileSync(join(root,'cohort.json'),JSON.stringify(cohort));
    writeFileSync(configPath,JSON.stringify(config));
    buildSite({configPath,outDir:'with-candidates'});
    const candidateJson=JSON.parse(readFileSync(join(root,'with-candidates',index.datasets[0].url),'utf8'));
    const candidateHtml=readFileSync(join(root,'with-candidates',index.datasets[0].pageUrl),'utf8');
    assert.equal(candidateJson.candidateReview.entities.length,1);
    assert.equal(candidateJson.entityCount,null);
    assert.deepEqual(candidateJson.rows,[]);
    assert.match(candidateHtml,/发起人关联企业/);
    assert.match(candidateHtml,/列出顺序不表示名次/);
    assert.ok(!candidateHtml.includes('javascript:'));
    config.boards[0].status = 'planned';
    writeFileSync(configPath, JSON.stringify(config));
    buildSite({configPath,outDir:'planned',basePath:'/observe/rankings/'});
    const planned = JSON.parse(readFileSync(join(root,'planned',index.datasets[0].url),'utf8'));
    assert.equal(planned.status,'planned');
    assert.equal(planned.sampleCount,null);
    assert.equal(planned.reportable,false);
    assert.deepEqual(planned.rows,[]);
    const plannedPage = readFileSync(join(root,'planned',index.datasets[0].pageUrl),'utf8');
    assert.match(plannedPage,/待采样，尚未发布名次/);
    assert.doesNotMatch(plannedPage,/首期采样中/);
    assert.match(readFileSync(join(root,'planned','index.html'),'utf8'),/待采样，尚未发布名次/);
    assert.match(readFileSync(join(root,'planned','index.html'),'utf8'),/<base href="\/observe\/rankings\/">/);
    assert.throws(()=>buildSite({configPath,outDir:'invalid-base',basePath:'https://example.com/'}),/挂载路径/);
    assert.equal(JSON.parse(readFileSync(join(root,'planned','data','index.json'),'utf8')).datasets[0].status,'planned');
    cohort.issue='2026-09';
    writeFileSync(join(root,'cohort.json'),JSON.stringify(cohort));
    assert.throws(()=>buildSite({configPath,outDir:'wrong-issue'}),/期号/);
    delete config.cohort;
    config.issue = '../escape';
    writeFileSync(configPath,JSON.stringify(config));
    assert.throws(() => buildSite({configPath,outDir:'rejected'}), /YYYY-MM/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
