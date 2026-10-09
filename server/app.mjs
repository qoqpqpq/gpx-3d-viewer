import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';

export function createApp(options={}) {
 const {key='',secret='',adminToken='',origins=[],perMinute=180,dailyLimit=20000,fetchImpl=fetch,now=Date.now,dist=resolve('dist')}=options;
 const targets=new Map([['/v4/map/styles','https://webapi.amap.com/v4/map/styles'],['/v3/vectormap','https://fmap01.amap.com/v3/vectormap']]);
 let day='',used=0;const clients=new Map();
 const stats={startedAt:new Date(now()).toISOString(),proxyRequests:0,upstreamRequests:0,upstreamBytes:0,rejected:0,upstreamErrors:0};
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 const authorized=req=>{const actual=Buffer.from(req.headers.authorization??''),expected=Buffer.from(`Bearer ${adminToken}`);return !!adminToken&&actual.length===expected.length&&timingSafeEqual(actual,expected);};
 const accept=req=>{
  if(req.headers['sec-fetch-site']==='cross-site')return false;
  const source=req.headers.origin??req.headers.referer;
  if(!source)return false;
  try{return origins.includes(new URL(source).origin);}catch{return false;}
 };
 const budget=(req,res)=>{
  const today=new Date(now()).toISOString().slice(0,10);if(day!==today){day=today;used=0;}
  const time=now(),ip=req.socket.remoteAddress??'unknown';
  for(const [id,b] of clients)if(time-b.at>=60000)clients.delete(id);
  let bucket=clients.get(ip);if(!bucket){if(clients.size>=10000)return false;bucket={at:time,count:0};clients.set(ip,bucket);}
  if(bucket.count>=perMinute||used>=dailyLimit){res.setHeader('Retry-After',used>=dailyLimit?'3600':'60');return false;}
  bucket.count++;used++;return true;
 };
 async function handle(req,res){
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'){json(res,405,{error:'method_not_allowed'});return;}
  if(url.pathname==='/api/health'){json(res,200,{ok:true});return;}
  if(url.pathname==='/api/map-config'){json(res,200,{amap:{enabled:!!key&&!!secret,key:key&&secret?key:undefined,serviceHost:'/_AMapService'}});return;}
  if(url.pathname==='/api/usage'){
   if(!authorized(req)){json(res,401,{error:'unauthorized'});return;}
   const today=new Date(now()).toISOString().slice(0,10);if(day!==today){day=today;used=0;}
   json(res,200,{...stats,day,dayRequests:used,dailyLimit,perMinute,scope:'This process only; AMap proxy requests, not provider billing totals.'});return;
  }
  if(url.pathname.startsWith('/_AMapService/')){
   stats.proxyRequests++;
   const target=targets.get(url.pathname.slice('/_AMapService'.length));
   if(!target||!accept(req)){stats.rejected++;json(res,403,{error:'proxy_request_denied'});return;}
   if(!key||!secret){json(res,503,{error:'amap_not_configured'});return;}
   if(req.url.length>8192){json(res,414,{error:'url_too_long'});return;}
   if(!budget(req,res)){stats.rejected++;json(res,429,{error:'rate_limit_exceeded'});return;}
   const upstream=new URL(target);
   for(const [name,value] of url.searchParams){if(!['key','jscode','securityJsCode','url','target'].includes(name))upstream.searchParams.append(name,value);}
   upstream.searchParams.set('key',key);upstream.searchParams.set('jscode',secret);
   // Client headers, cookies, arbitrary hosts and redirects are never forwarded.
   try{
    stats.upstreamRequests++;
    const result=await fetchImpl(upstream,{redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!result.ok){stats.upstreamErrors++;json(res,502,{error:'map_upstream_failed'});return;}
    const chunks=[];let length=0;
    for await(const chunk of result.body??[]){length+=chunk.length;if(length>8*1024*1024)throw new Error('response_limit');chunks.push(Buffer.from(chunk));}
    stats.upstreamBytes+=length;
    res.writeHead(200,{'Content-Type':result.headers.get('content-type')??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(Buffer.concat(chunks));
   }catch{stats.upstreamErrors++;json(res,502,{error:'map_upstream_unavailable'});}return;
  }
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/_AMapService')){json(res,404,{error:'not_found'});return;}
  // Serve only the built frontend; never expose environment files or repository sources.
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{json(res,400,{error:'bad_path'});return;}
  const parts=pathname.split('/');if(parts.some(p=>p.startsWith('.')||p.includes('\\'))){json(res,404,{error:'not_found'});return;}
  const path=resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(dist+sep)){json(res,404,{error:'not_found'});return;}
  try{
   if(!(await stat(path)).isFile())throw new Error();
   const data=await readFile(path);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2','.jpg':'image/jpeg','.gif':'image/gif','.xml':'application/xml'};
   res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':pathname.includes('/assets/')?'public, max-age=31536000, immutable':'no-cache'});res.end(data);
  }catch{json(res,404,{error:'not_found'});}
 }
 return http.createServer((req,res)=>{void handle(req,res).catch(()=>{if(!res.headersSent)json(res,500,{error:'internal_error'});else res.destroy();});});
}
