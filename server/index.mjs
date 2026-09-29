import { createApp } from './app.mjs';
const integer=(name,fallback)=>{const n=Number(process.env[name]??fallback);if(!Number.isSafeInteger(n)||n<1)throw new Error(`Invalid ${name}`);return n;};
const server=createApp({key:process.env.AMAP_WEB_KEY,secret:process.env.AMAP_SECURITY_CODE,adminToken:process.env.ADMIN_TOKEN,origins:(process.env.ALLOWED_ORIGINS??'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8787').split(',').map(s=>s.trim()).filter(Boolean),perMinute:integer('PROXY_PER_MINUTE',180),dailyLimit:integer('PROXY_DAILY_LIMIT',20000)});
const host=process.env.HOST??'127.0.0.1',port=integer('PORT',8787);
server.listen(port,host,()=>console.log(`Backend listening on http://${host}:${port}; AMap configured: ${!!process.env.AMAP_WEB_KEY&&!!process.env.AMAP_SECURITY_CODE}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
