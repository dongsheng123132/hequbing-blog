import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { execute } from './core.js';
import { bindings, normalizeBase } from './contracts.js';
import { publicFiles } from './publish.js';
import { RegistryError } from './store.js';

const equal = (a,b) => { const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length&&timingSafeEqual(x,y); };
export function createRegistryServer({ store, actors = [], basePath = '/observe' }) {
  const base = normalizeBase(basePath);
  for (const a of actors) if (!a.id || !['contributor','reviewer'].includes(a.role) || typeof a.token!=='string' || a.token.length<32) throw new Error('无效的身份配置');
  const buckets = new Map();
  const server = http.createServer(async (req,res) => {
    const headers = { 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'" };
    const send = (status, data, type='application/json; charset=utf-8') => {
      if (res.destroyed) return;
      res.writeHead(status, { ...headers, 'Content-Type':type }); res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
    };
    try {
      const url = new URL(req.url,'http://registry.local');
      if ((req.url?.length??0)>8192) throw new RegistryError('REQUEST_TOO_LARGE','URL 过长。',414);
      if (req.method==='GET' && url.pathname===`${base}/health`) { await store.load(); return send(200,{ok:true,data:{status:'ready'}}); }
      if (req.method==='GET' && url.pathname===base && base) { res.writeHead(308,{Location:`${base}/`}); return res.end(); }
      if (!url.pathname.startsWith(`${base}/`)) throw new RegistryError('NOT_FOUND','未找到入口。',404);
      const apiPrefix = `${base}/api/v1`;
      if (!url.pathname.startsWith(`${apiPrefix}/`)) {
        if (req.method!=='GET') throw new RegistryError('NOT_FOUND','未找到入口。',404);
        const path = url.pathname.slice(base.length+1)||'index.html';
        const files = await publicFiles(store,base);
        if (!files.has(path)) throw new RegistryError('NOT_FOUND','未找到公开文件。',404);
        const type=path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.md')?'text/plain; charset=utf-8':path.endsWith('.js')?'text/javascript; charset=utf-8':'application/json; charset=utf-8';
        res.writeHead(200,{...headers,'Content-Type':type}); return res.end(files.get(path));
      }
      let match;
      for (const [method,path,action] of bindings) {
        if (method!==req.method) continue;
        const found = url.pathname.slice(apiPrefix.length).match(new RegExp(`^${path.replace('{id}','([a-z0-9][a-z0-9-]*)')}$`));
        if (found) { match={action,id:found[1]};break; }
      }
      if (!match) throw new RegistryError('NOT_FOUND','未知 API 路径或方法。',404);
      const credential = (req.headers.authorization??'').replace(/^Bearer /,'');
      const identity = credential ? actors.find((a)=>equal(a.token,credential)) : undefined;
      const actor = identity ? { id:identity.id,role:identity.role } : null;
      if (credential&&!identity) throw new RegistryError('UNAUTHORIZED','令牌无效。',401);
      let input=Object.fromEntries(url.searchParams);
      if (req.method==='POST') {
        // CLI/AI HTTP 无 Origin；浏览器跨源写入不接受，避免借维护者浏览器提交。
        if (req.headers.origin) {
          let origin; try { origin = new URL(req.headers.origin); } catch { throw new RegistryError('FORBIDDEN','Origin 无效。',403); }
          if (origin.host!==req.headers.host) throw new RegistryError('FORBIDDEN','不接受跨源写入。',403);
        }
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')) throw new RegistryError('CONTENT_TYPE','需要 application/json。',415);
        const key=actor?.id??req.socket.remoteAddress;
        const now=Date.now(); if(buckets.size>10000) for(const [k,b] of buckets) if(now-b.at>60000)buckets.delete(k);
        let bucket=buckets.get(key);if(!bucket||now-bucket.at>60000){bucket={at:now,n:0};buckets.set(key,bucket)}
        if(++bucket.n>60) throw new RegistryError('RATE_LIMITED','请求过于频繁，请稍后重试。',429);
        let bytes=0;const chunks=[];
        if(Number(req.headers['content-length'])>262144) throw new RegistryError('REQUEST_TOO_LARGE','请求超过 256 KiB。',413);
        for await (const chunk of req) { bytes+=chunk.length;if(bytes>262144)throw new RegistryError('REQUEST_TOO_LARGE','请求超过 256 KiB。',413);chunks.push(chunk); }
        try { input=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RegistryError('INVALID_JSON','JSON 无法解析。',400); }
      }
      if(match.id){ if(match.action==='proposal.review') input={...input,proposalId:match.id};else input={...input,id:match.id}; }
      const data=await execute(store,match.action,input,actor);
      send(200,{ok:true,data});
    } catch(e) {
      const known=e instanceof RegistryError;
      send(known?e.status:500,{ok:false,error:{code:known?e.code:'INTERNAL_ERROR',message:known?e.message:'服务内部错误。请联系维护者。',...(known&&e.details?{details:e.details}:{})}});
      if(!known) process.stderr.write(`registry error: ${e.name}\n`);
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  server.setTimeout(15000,(socket)=>socket.destroy());
  return server;
}
