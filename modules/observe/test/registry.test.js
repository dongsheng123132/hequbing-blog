import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { createStore, createSnapshotStore, atomicJson, readJson } from '../src/store.js';
import { execute, actions } from '../src/core.js';
import { validateCompany, validate, proposalSchema } from '../src/schema.js';
import { bindings, openapi } from '../src/contracts.js';
import { publicFiles, build, ROOT } from '../src/publish.js';
import { createRegistryServer } from '../src/server.js';

const seed=await readJson(join(ROOT,'data/seed.json'));
const alice={id:'alice',role:'contributor'},bob={id:'bob',role:'contributor'},reviewer={id:'reviewer',role:'reviewer'};
async function setup(t) {
  const dir=await mkdtemp(join(tmpdir(),'hequbing-registry-'));
  const store=createStore(dir);await store.init(seed);
  t.after(async()=>{assert.ok(resolve(dir).startsWith(resolve(tmpdir())+ '\\')||resolve(dir).startsWith(resolve(tmpdir())+'/'));await rm(dir,{recursive:true,force:true});});
  return {dir,store};
}
function proposal(suffix='test') {
  const company=structuredClone(seed.companies[1]);Object.assign(company,{id:`company-${suffix}`,name:`企业 ${suffix}`,legalName:null,aliases:[],websites:[`https://${suffix}.example.org/`]});
  return {schemaVersion:'1.0',operation:'create',company,expectedVersion:0,idempotencyKey:`request-${suffix}`,reason:'测试贡献',publicationConsent:true};
}
const code=(expected)=>e=>e.code===expected;
async function accept(store,p) {return execute(store,'proposal.review',{proposalId:p.id,expectedProposalVersion:p.version,decision:'accept',note:'来源已记录，未进行独立认证'},reviewer);}

test('首批真实来源资料合约合法，物流筛选与询价草稿可用',async t=>{
  const {store}=await setup(t);for(const c of seed.companies)assert.deepEqual(validateCompany(c),[]);
  const found=await execute(store,'company.search',{destinationCountry:'PH',mode:'sea'});assert.deepEqual(found.items.map(r=>r.company.id),['phibong']);
  assert.equal((await execute(store,'company.search',{q:'cpent-global.vercel.app'})).total,1);
  assert.equal((await execute(store,'company.search',{mode:'rail'})).total,0);
  const before=(await store.load()).revision;
  const draft=await execute(store,'inquiry.prepare',{companyId:'phibong',offeringId:'ph-sea',requirements:[{field:'货物名称与用途',value:'五金配件'}]});
  assert.equal(draft.sent,false);assert.equal(draft.price,null);assert.ok(draft.missingFields.includes('总重量公斤'));assert.equal((await store.load()).revision,before);
});
test('投稿待审、角色隔离、重复请求可恢复，审核后公开并保留历史',async t=>{
  const {store}=await setup(t),input=proposal();
  await assert.rejects(execute(store,'proposal.submit',input),code('UNAUTHORIZED'));
  const p=await execute(store,'proposal.submit',input,alice);
  assert.equal(p.status,'pending');await assert.rejects(execute(store,'company.get',{id:input.company.id}),code('NOT_FOUND'));
  await assert.rejects(execute(store,'proposal.get',{id:p.id},bob),code('NOT_FOUND'));
  await assert.rejects(execute(store,'proposal.review',{proposalId:p.id},alice),code('FORBIDDEN'));
  assert.equal((await execute(store,'proposal.submit',input,alice)).id,p.id);
  await assert.rejects(execute(store,'proposal.submit',{...input,reason:'different'},alice),code('IDEMPOTENCY_CONFLICT'));
  await accept(store,p);assert.equal((await execute(store,'proposal.submit',input,alice)).status,'accepted');
  const record=await execute(store,'company.get',{id:input.company.id});assert.equal(record.version,1);assert.equal(record.verification,'source_recorded');
  assert.equal((await execute(store,'company.history',{id:input.company.id})).versions.length,1);
});
test('并发审核只接受一个旧版本，拒绝陈旧覆盖，保留先前资料',async t=>{
  const {store}=await setup(t);const old=await execute(store,'company.get',{id:'cpent'});
  const update=(key)=>({schemaVersion:'1.0',operation:'replace',company:{...old.company,summary:`更新 ${key}`},expectedVersion:1,idempotencyKey:`update-${key}`,publicationConsent:true,reason:key});
  const [a,b]=await Promise.all([execute(store,'proposal.submit',update('a'),alice),execute(store,'proposal.submit',update('b'),bob)]);
  const results=await Promise.allSettled([accept(store,a),accept(store,b)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'VERSION_CONFLICT');
  assert.equal((await execute(store,'company.get',{id:'cpent'})).version,2);
  const history=await execute(store,'company.history',{id:'cpent'});assert.equal(history.versions.length,2);assert.equal(history.versions[0].company.summary,old.company.summary);
  assert.ok((await readFile(store.path+'.bak','utf8')).includes('cpent'));
});
test('未知权限字段、无证据引用、错类型路线、重复主体和保留 ID 被拒绝',async t=>{
  const {store}=await setup(t);const p=proposal('bad');p.company.verified=true;
  assert.ok(validate(proposalSchema,p).length);await assert.rejects(execute(store,'proposal.validate',p),code('VALIDATION_ERROR'));
  delete p.company.verified;p.company.offerings[0].evidenceIds=['missing'];assert.ok(validateCompany(p.company).length);
  const dupe=proposal('dupe');dupe.company.websites=['https://www.cptele.com/'];await assert.rejects(execute(store,'proposal.validate',dupe),code('POSSIBLE_DUPLICATE'));
  const reserved=proposal('reserved');reserved.company.id='constructor';assert.ok(validateCompany(reserved.company).length);
  await assert.rejects(execute(store,'company.get',{id:'constructor'}),code('NOT_FOUND'));
});
test('路线多条件只匹配同一条服务，不把两条路线拼接',async t=>{
  const {store}=await setup(t);const company=structuredClone(seed.companies[0]);company.offerings[1].route.destinationCountry='VN';
  const p=await execute(store,'proposal.submit',{schemaVersion:'1.0',operation:'replace',company,expectedVersion:1,idempotencyKey:'route-change',publicationConsent:true,reason:'测试'},alice);await accept(store,p);
  assert.equal((await execute(store,'company.search',{destinationCountry:'PH',mode:'air'})).total,0);
});
test('拒绝提交不会入库；再次初始化不覆盖已有状态',async t=>{
  const {store}=await setup(t);const p=await execute(store,'proposal.submit',proposal('rejected'),alice);
  await execute(store,'proposal.review',{proposalId:p.id,expectedProposalVersion:1,decision:'reject',note:'来源待补充'},reviewer);
  await assert.rejects(accept(store,p),code('VERSION_CONFLICT'));assert.equal((await store.init({companies:[]})).initialized,false);
  assert.equal((await execute(store,'company.search')).total,2);
});
test('公开导出不泄露投稿／令牌，独立站与子路径共用稳定 ID 和契约',async t=>{
  const {store,dir}=await setup(t);await execute(store,'proposal.submit',{...proposal('private'),reason:'private-submission-reason'},alice);
  for(const base of ['/observe','/']){
    const files=await publicFiles(store,base),text=[...files.values()].join('');assert.ok(!text.includes('private-submission-reason'));assert.ok(!text.includes('actorId'));
    assert.ok(files.get('index.html').includes('cpent'));assert.equal(JSON.parse(files.get('manifest.json')).capabilities.quoteSubmission,false);
    assert.equal(openapi(base).servers[0].url,base==='/'?'/api/v1':'/observe/api/v1');
  }
  assert.equal(new Set(bindings.map(b=>b[2])).size,actions.length);
  const result=await build(store,{outDir:join(dir,'public')});assert.ok(result.files.includes('SKILL.md'));
});
test('发布构建只读 Git 快照，不采用陈旧运行状态或未发布审核结果',async t=>{
  const {store,dir}=await setup(t),path=join(dir,'catalog.json');
  const catalog=await execute(store,'catalog.export');await atomicJson(path,catalog);
  await accept(store,await execute(store,'proposal.submit',proposal('unpublished'),alice));
  const snapshot=createSnapshotStore(path);
  const files=await publicFiles(snapshot);
  assert.equal(JSON.parse(files.get('catalog.json')).records.length,2);
  assert.ok(!files.has('companies/company-unpublished.json'));
  await atomicJson(path,await execute(store,'catalog.export'));
  assert.equal((await execute(snapshot,'catalog.export')).records.length,3);
  await assert.rejects(snapshot.update(()=>{}),code('READ_ONLY'));
  await atomicJson(path,{...catalog,revision:'broken'});
  await assert.rejects(snapshot.load(),code('INVALID_SNAPSHOT'));
});
test('HTTP 真实闭环：查询→校验→投稿→审核→公开，包含认证与错误边界',async t=>{
  const {store}=await setup(t);
  const actors=[{...alice,token:'a'.repeat(40)},{...reviewer,token:'r'.repeat(40)}];
  const server=createRegistryServer({store,actors});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  const origin=`http://127.0.0.1:${server.address().port}`,base=origin+'/observe/api/v1';
  async function call(path,{method='GET',body,token,headers={}}={}){
    const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});
    return {status:response.status,...await response.json()};
  }
  assert.equal((await call('/companies?destinationCountry=PH')).data.total,1);
  assert.equal((await call('/companies?limit=nope')).status,422);
  const input=proposal('http');assert.equal((await call('/proposals/validate',{method:'POST',body:input})).ok,true);
  assert.equal((await call('/proposals',{method:'POST',body:input})).status,401);
  assert.equal((await call('/proposals',{method:'POST',body:input,token:actors[0].token,headers:{Origin:'https://evil.example'}})).status,403);
  const p=(await call('/proposals',{method:'POST',body:input,token:actors[0].token})).data;
  assert.equal((await call('/proposals',{token:actors[0].token})).status,403);
  assert.equal((await call(`/proposals/${p.id}/review`,{method:'POST',body:{expectedProposalVersion:1,decision:'accept',note:'来源已记录'},token:actors[1].token})).ok,true);
  assert.equal((await call('/companies/company-http')).data.version,1);
  assert.equal((await fetch(origin+'/observe/../.local/registry/actors.json')).status,404);
  assert.equal((await fetch(origin+'/observe/SKILL.md')).status,200);
});
