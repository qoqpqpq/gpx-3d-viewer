import { createApp } from './app.mjs';
const integer=(name,fallback)=>{const n=Number(process.env[name]??fallback);if(!Number.isSafeInteger(n)||n<1)throw new Error(`Invalid ${name}`);return n;};
// Quota-alert thresholds: a percentage of the matching limit ("80" = 80%).
const quotaThreshold=(name,fallback)=>{const raw=process.env[name];if(raw===undefined||raw==='')return fallback;const n=Number(raw);if(!Number.isFinite(n)||n<=0||n>100)throw new Error(`Invalid ${name}`);return n/100;};
const perMinuteLimit=integer('PROXY_PER_MINUTE',180),dailyLimitValue=integer('PROXY_DAILY_LIMIT',20000);
const server=createApp({key:process.env.AMAP_WEB_KEY,secret:process.env.AMAP_SECURITY_CODE,adminToken:process.env.ADMIN_TOKEN,origins:(process.env.ALLOWED_ORIGINS??'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8787').split(',').map(s=>s.trim()).filter(Boolean),perMinute:perMinuteLimit,dailyLimit:dailyLimitValue,perMinuteWarning:quotaThreshold('PROXY_PER_MINUTE_WARN',0.8),perMinuteCritical:quotaThreshold('PROXY_PER_MINUTE_CRITICAL',1),dailyWarning:quotaThreshold('PROXY_DAILY_WARN',0.8),dailyCritical:quotaThreshold('PROXY_DAILY_CRITICAL',1)});
const host=process.env.HOST??'127.0.0.1',port=integer('PORT',8787);
server.listen(port,host,()=>console.log(`Backend listening on http://${host}:${port}; AMap configured: ${!!process.env.AMAP_WEB_KEY&&!!process.env.AMAP_SECURITY_CODE}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
