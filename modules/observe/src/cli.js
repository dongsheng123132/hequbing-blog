#!/usr/bin/env node
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createStore, createSnapshotStore, snapshotState, readJson, atomicJson, withLock, RegistryError } from './store.js';
import { execute } from './core.js';
import { validateCompany } from './schema.js';
import { build, ROOT } from './publish.js';
import { createRegistryServer } from './server.js';

const args=process.argv.slice(2),command=args.shift();
const positional=[],options={};
for(let i=0;i<args.length;i++)if(args[i].startsWith('--'))options[args[i].slice(2)]=args[++i];else positional.push(args[i]);
const dataDir=resolve(options.data??process.env.REGISTRY_DATA_DIR??join(ROOT,'.local'));
const basePath=options.base??process.env.REGISTRY_BASE_PATH??'/observe';
const store=createStore(dataDir);
const actorsPath=resolve(process.env.REGISTRY_ACTORS_FILE??join(dataDir,'actors.json'));
const output=(data)=>process.stdout.write(`${JSON.stringify({ok:true,data})}\n`);
try {
  if(command==='init') {
    const seed=await readJson(options.seed?resolve(options.seed):join(ROOT,'data/seed.json'));
    if(!Array.isArray(seed.companies)||new Set(seed.companies.map((c)=>c.id)).size!==seed.companies.length)throw new RegistryError('INVALID_SEED','初始企业 ID 重复或缺少企业列表。',422);
    const errors=seed.companies.flatMap(validateCompany);
    if(errors.length)throw new RegistryError('INVALID_SEED','初始数据未通过校验。',422,errors);
    let snapshot;
    if(!options.seed)try{snapshot=await readJson(join(ROOT,'data/catalog.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
    if(snapshot)snapshotState(snapshot);
    output(await store.init(seed, snapshot));
  } else if(command==='actor.create') {
    if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(options.id??'')||!['contributor','reviewer'].includes(options.role))throw new RegistryError('ARGUMENT_ERROR','需要 --id 与 --role contributor|reviewer。');
    output(await withLock(actorsPath,async()=>{
      let actors=[];try{actors=await readJson(actorsPath)}catch(e){if(e.code!=='ENOENT')throw e}
      if(actors.some((a)=>a.id===options.id))throw new RegistryError('ALREADY_EXISTS','身份已存在，不覆盖令牌。',409);
      actors.push({id:options.id,role:options.role,token:randomBytes(32).toString('hex')});
      await atomicJson(actorsPath,actors);return{id:options.id,role:options.role,credentialsFile:actorsPath,tokenPrinted:false};
    }));
  } else if(command==='action') {
    const input=options.input?await readJson(resolve(options.input)):{};
    output(await execute(store,positional[0],input,{id:'local-maintainer',role:'reviewer'}));
  } else if(command==='build') {
    const source=options.source??'published';
    if(!['published','runtime'].includes(source))throw new RegistryError('ARGUMENT_ERROR','--source 仅支持 published 或 runtime。');
    const buildStore=source==='published'?createSnapshotStore(join(ROOT,'data/catalog.json')):store;
    output(await build(buildStore,{basePath,transport:options.transport??'github',...(options.out?{outDir:resolve(options.out)}:{})}));
  } else if(command==='snapshot') {
    const catalog=await execute(store,'catalog.export');await atomicJson(join(ROOT,'data/catalog.json'),catalog);
    output({path:join(ROOT,'data/catalog.json'),revision:catalog.revision,contentHash:catalog.contentHash});
  } else if(command==='serve') {
    await store.load();
    let actors=[];try{actors=await readJson(actorsPath)}catch(e){if(e.code!=='ENOENT')throw e}
    const host=options.host??'127.0.0.1',port=Number(options.port??4317);
    if(!['127.0.0.1','::1','localhost'].includes(host)&&actors.length===0)throw new RegistryError('AUTH_REQUIRED','公网监听前须配置独立身份令牌。');
    if(!Number.isInteger(port)||port<1||port>65535)throw new RegistryError('ARGUMENT_ERROR','端口不合法。');
    const server=createRegistryServer({store,actors,basePath});
    server.on('error',(e)=>{process.stderr.write(`${e.code??'SERVER_ERROR'}\n`);process.exitCode=1;});
    server.listen(port,host,()=>output({listening:`http://${host}:${port}${basePath}/`,writeConfigured:actors.length>0}));
    for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
  } else throw new RegistryError('ARGUMENT_ERROR','命令：init | actor.create | action <id> --input file.json | snapshot | build | serve；默认输出 JSON，退出码 0 成功、1 失败。');
} catch(e) {
  process.stdout.write(`${JSON.stringify({ok:false,error:{code:e.code??'INTERNAL_ERROR',message:e.message,...(e.details?{details:e.details}:{})}})}\n`);
  process.exitCode=1;
}
