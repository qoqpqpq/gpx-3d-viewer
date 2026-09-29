import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.mjs';
async function fixture(t,options={}){
 const calls=[];const app=createApp({key:'public-key',secret:'server-secret',adminToken:'admin-test',origins:['https://app.example'],fetchImpl:async(url,opts)=>{calls.push({url:new URL(url),opts});return new Response('tile',{headers:{'content-type':'application/octet-stream'}});},...options});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{app.closeAllConnections();app.close(resolve);}));
 const base=`http://127.0.0.1:${app.address().port}`;
 return {calls,get:(path,init={})=>fetch(base+path,init),proxy:(path='v3/vectormap',query='')=>fetch(`${base}/_AMapService/${path}${query}`,{headers:{referer:'https://app.example/map'}})};
}
test('public config never exposes security code; statistics require authentication',async t=>{
 const f=await fixture(t);const config=await (await f.get('/api/map-config')).text();assert.ok(config.includes('public-key'));assert.ok(!config.includes('server-secret'));
 assert.equal((await f.get('/api/usage')).status,401);assert.equal((await f.get('/api/usage',{headers:{authorization:'Bearer admin-test'}})).status,200);
});
test('only fixed map endpoints are proxied; server replaces supplied credentials',async t=>{
 const f=await fixture(t);assert.equal((await f.proxy('v3/vectormap','?key=bad&jscode=bad&x=1&target=http://evil')).status,200);
 assert.equal(f.calls[0].url.hostname,'fmap01.amap.com');assert.equal(f.calls[0].url.searchParams.get('jscode'),'server-secret');assert.equal(f.calls[0].url.searchParams.get('key'),'public-key');assert.equal(f.calls[0].url.searchParams.has('target'),false);assert.equal(f.calls[0].opts.redirect,'error');
 assert.equal((await f.proxy('v3/place/text')).status,403);assert.equal((await f.get('/_AMapService/v3/vectormap')).status,403);
 assert.equal((await f.get('/_AMapService/v3/vectormap',{headers:{origin:'https://evil.example'}})).status,403);assert.equal(f.calls.length,1);
});
test('IP limit and global daily budget reject before upstream; forwarded IP cannot bypass limit',async t=>{
 const f=await fixture(t,{perMinute:1});assert.equal((await f.proxy()).status,200);
 assert.equal((await f.get('/_AMapService/v3/vectormap',{headers:{referer:'https://app.example','x-forwarded-for':'8.8.8.8'}})).status,429);assert.equal(f.calls.length,1);
 const g=await fixture(t,{dailyLimit:1});await g.proxy();assert.equal((await g.proxy()).status,429);
});
test('UTC day and minute counters recover after expiry',async t=>{
 let time=Date.UTC(2026,8,28,23,59,50);const f=await fixture(t,{now:()=>time,dailyLimit:1});await f.proxy();assert.equal((await f.proxy()).status,429);time+=70000;assert.equal((await f.proxy()).status,200);
});
test('upstream failures are sanitized and counted without leaking URL or secret',async t=>{
 const f=await fixture(t,{fetchImpl:async()=>{throw new Error('server-secret in URL');}});const response=await f.proxy();assert.equal(response.status,502);assert.ok(!(await response.text()).includes('server-secret'));
 const stats=await (await f.get('/api/usage',{headers:{authorization:'Bearer admin-test'}})).json();assert.equal(stats.upstreamErrors,1);
});
test('unconfigured proxy is explicit; mutations and source files cannot be served',async t=>{
 const f=await fixture(t,{key:'',secret:''});assert.equal((await f.proxy()).status,503);
 assert.equal((await f.get('/api/health',{method:'POST'})).status,405);
 for(const path of ['/.env.server','/src/main.ts','/api/missing','/%2eenv.server'])assert.equal((await f.get(path)).status,404);
 assert.equal((await f.get('/')).status,200);
});
