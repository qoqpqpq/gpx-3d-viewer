import { refreshBackendConfig } from './adapters/backend';
import './style.css';
import { demoGpx } from './demo';
import { hashFile, listTracks, saveTrack, saveTracks, deleteTrack } from './adapters/storage';
import { BrowserLocation } from './adapters/location';
import { Guidance } from './core/navigation';
import { pointAt, thin, localXY, wrapLon, radians } from './core/geo';
import type { LocationFix, StoredTrack, Track } from './core/types';
import { RouteMap } from './ui/map2d';
import type { Scene3D } from './ui/scene3d';
import type { AmapScene } from './ui/amap';
import { loadMapSettings, saveMapSettings, type Basemap } from './core/map-settings';
import { advanceSimulation } from './core/simulation';

const paths: Record<string,string> = {
  mountain:'m3 19 7-13 5 8 3-5 5 10M8 19l5-8 5 8', route:'M6 4a2 2 0 1 0 0 .1M18 18a2 2 0 1 0 0 .1M6 8v3a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3', plus:'M12 5v14M5 12h14', upload:'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5', layers:'m12 3 10 6-10 6L2 9l10-6M2 14l10 6 10-6', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2', arrow:'M5 12h14m-6-6 6 6-6 6', play:'m8 5 11 7-11 7Z', pause:'M8 5v14M16 5v14', fit:'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6', minus:'M5 12h14', pin:'M12 21s7-8 7-13A7 7 0 0 0 5 8c0 5 7 13 7 13ZM12 6v4', clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2', up:'m5 16 7-8 7 8M12 8v12', down:'m5 8 7 8 7-8M12 4v12', folder:'M3 6h7l2 3h9v11H3ZM3 6V4h7l2 2', trash:'M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7m4-7v7', edit:'m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6', download:'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5', close:'m6 6 12 12M6 18 18 6', locate:'M12 2v4m0 12v4M2 12h4m12 0h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10', check:'m5 12 4 4L19 6', info:'M12 8v1m0 3v5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', sound:'m3 9 5 0 5-5v16l-5-5H3ZM17 8a6 6 0 0 1 0 8', compass:'m16 8-3 5-5 3 3-5 5-3ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3m-4 9 3 3 5-6'
};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.route}"/></svg>`;
type ControlMap = {
  '#file': HTMLInputElement; '#reverse': HTMLInputElement; '#sound': HTMLInputElement;
  '#scrub': HTMLInputElement; '#token': HTMLInputElement; '#imagery': HTMLInputElement;
  '#rename-input': HTMLInputElement; '#speed': HTMLSelectElement; '#scenario': HTMLSelectElement;
  '#settings-dialog': HTMLDialogElement; '#rename-dialog': HTMLDialogElement; '#delete-dialog': HTMLDialogElement;
  '#play': HTMLButtonElement; '#cancel-import': HTMLButtonElement;
  '#basemap': HTMLSelectElement; '#tdt-key': HTMLInputElement; '#map-labels': HTMLInputElement; '#map-buildings': HTMLInputElement; '#amap-key': HTMLInputElement; '#amap-security': HTMLInputElement;
  '#segment': HTMLSelectElement;
};
function $<K extends keyof ControlMap>(selector: K): ControlMap[K];
function $<T extends HTMLElement = HTMLElement>(selector: string): T;
function $(selector:string): HTMLElement { return document.querySelector<HTMLElement>(selector)!; }
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const km=(m:number)=>(m/1000).toFixed(2);
const elevation=(v:number|null|undefined)=>v==null?'—':Math.round(v).toLocaleString();
const duration=(ms:number|null)=>ms===null?'—':`${Math.floor(ms/3600000)}h ${Math.floor(ms%3600000/60000)}m`;

$('#app').innerHTML=`
  <header class="topbar"><a class="brand" href="/" aria-label="山径首页"><span class="brand-symbol">${icon('mountain')}</span><span>山径<span class="brand-en">RIDGELINE</span></span></a><div class="top-title">路线工作台 <span class="build-badge">桌面预览 · 0.2</span></div><div class="top-actions"><span id="network" class="connection"><i></i>本地优先</span><button id="settings" class="icon-button" title="地图与说明" aria-label="地图与说明">${icon('settings')}</button><span class="avatar">山</span></div></header>
  <div class="workspace"><aside class="library"><div class="library-heading"><h2>${icon('folder')} 我的路线</h2><span id="route-count">0</span></div><button class="import-button" id="import">${icon('plus')} 导入 GPX <span>↗</span></button><input id="file" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden><p class="library-note">文件留在这台设备，随时再出发。</p><div id="route-list" class="route-list" aria-label="轨迹库"></div><button id="add-demo" class="text-button">${icon('route')} 打开演示路线</button><div class="library-footer"><span class="small-label">MADE FOR THE TRAIL</span><p>把路线看清楚。<br>让每一步更从容。</p><div>${icon('shield')} GPX 本地处理，不上传</div></div></aside>
  <main class="main"><section class="route-heading"><div><div class="eyebrow"><span class="status-dot"></span> 路线探索 <span id="route-kind">GPX TRACK</span></div><h1 id="route-name">正在准备路线…</h1><div id="route-meta" class="route-meta">本地路线工作台</div></div><div class="route-actions"><button id="rename" class="icon-button" title="重命名路线" aria-label="重命名路线">${icon('edit')}</button><button id="export" class="icon-button" title="导出原始 GPX" aria-label="导出原始 GPX">${icon('download')}</button><button id="remove" class="icon-button" title="删除路线" aria-label="删除路线">${icon('trash')}</button></div></section>
  <section class="metrics" aria-label="路线统计"><div class="metric">${icon('route')}<div><span>路线距离</span><strong id="distance">—</strong></div></div><div class="metric">${icon('up')}<div><span>累计爬升</span><strong id="ascent">—</strong></div></div><div class="metric">${icon('down')}<div><span>累计下降</span><strong id="descent">—</strong></div></div><div class="metric">${icon('mountain')}<div><span>最高海拔</span><strong id="highest">—</strong></div></div><div class="metric">${icon('clock')}<div><span>记录历时</span><strong id="duration">—</strong></div></div></section>
  <div class="explore-grid"><section class="map-card"><div class="map-toolbar"><div class="segmented" aria-label="地图模式"><button id="view2d" class="active" aria-pressed="true">${icon('route')} 二维路线</button><button id="view3d" aria-pressed="false">${icon('layers')} 三维预览</button></div><button id="terrain-settings" class="map-settings">${icon('settings')} 底图与地形</button></div><div class="map-stage" id="map-stage"><canvas id="map" aria-label="二维轨迹示意图，可拖动缩放，点击路线选择位置"></canvas><div id="cesium" hidden></div><div class="map-label"><i></i><span id="map-status">本地路线 · 无底图</span></div><div class="compass">N<span>▲</span></div><div class="map-controls"><button id="zoom-in" aria-label="放大">${icon('plus')}</button><button id="zoom-out" aria-label="缩小">${icon('minus')}</button><button id="local-map" aria-label="仅显示本地路线" title="仅显示本地路线">2D</button><button id="retry-map" aria-label="重试地图连接" title="重试地图连接">↻</button><button id="fit" aria-label="显示全线" title="显示全线">${icon('fit')}</button></div><div id="map-hint" class="map-hint">拖动平移 · 滚轮缩放 · 点击路线选点</div><div id="demo-tag" class="demo-tag">合成演示路线 · 不用于实地行进</div></div></section>
  <aside class="guidance-card"><div class="panel-title"><h2>${icon('compass')} 行进模拟</h2><span class="mini-tag" id="mode-tag">模拟</span></div><p class="panel-description">在电脑上走一遍，看看提醒是否合适。</p><div id="guidance-status" class="guidance-status" role="status" aria-live="polite"><span class="guidance-symbol">${icon('compass')}</span><strong id="guidance-title">准备出发</strong><p id="guidance-detail">选择起始位置，然后开始模拟。</p></div><div class="progress-stats"><div><span>沿线进度</span><strong id="walked">0.00 <small>km</small></strong></div><div><span>剩余</span><strong id="remaining">— <small>km</small></strong></div></div><div class="progress-track"><div id="progress-fill"></div></div><label id="segment-field" class="segment-field" hidden>当前分段<select id="segment" aria-label="当前分段"></select></label><div class="simulation-controls"><label>播放速度<select id="speed" aria-label="播放速度"><option value="10">10 ×</option><option value="30" selected>30 ×</option><option value="60">60 ×</option></select></label><label>模拟情境<select id="scenario" aria-label="模拟情境"><option value="normal">沿路线行进</option><option value="off">偏离路线 150 m</option><option value="weak">定位精度不足</option></select></label><label class="check-label"><input type="checkbox" id="reverse">反向行进</label><label class="check-label"><input type="checkbox" id="sound" checked>声音提醒</label></div><button id="play" class="primary-button">${icon('play')} 开始模拟</button><button id="locate" class="secondary-button">${icon('locate')} 使用浏览器定位</button><p class="device-note">浏览器仅验证前台逻辑，锁屏与后台定位需要 Android 真机。</p></aside></div>
  <section class="profile-card"><div class="profile-heading"><h2>海拔剖面 <span>ELEVATION PROFILE</span></h2><div id="selected-value">—</div></div><div class="profile-body"><div id="elevation-axis" class="elevation-axis"></div><svg id="profile" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-label="海拔剖面，使用下方滑块选取位置"></svg><div id="profile-empty" hidden>这条路线没有高程数据，仍可拖动里程查看路线。</div></div><input id="scrub" class="scrub" aria-label="路线里程" type="range" min="0" max="1000" value="0" step="1"><div class="distance-axis" id="distance-axis"></div><div class="profile-footer"><span><i></i>GPX 原始高程 · 垂直基准未核实</span><span id="selected-coordinates">WGS84</span></div></section>
  <section class="quality"><span>${icon('info')} 数据说明</span><div id="quality-text">统计基于原始点；显示简化不改变距离与爬升。</div></section><footer class="main-footer"><span>出发前看路线，行进中保持方向。</span><span>DESIGNED FOR THE OUTDOORS ↗</span></footer></main></div>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <dialog id="settings-dialog" aria-labelledby="map-settings-title"><form method="dialog"><div class="dialog-heading"><h2 id="map-settings-title">底图与地形</h2><button class="icon-button" aria-label="关闭">${icon('close')}</button></div><p>选择城市地图或地形模式。天地图底图可搭配 Cesium 地形；高德使用自己的地图和地形。</p><label class="field">底图来源<select id="basemap" aria-label="底图来源"><option value="amap-terrain">高德 · 地形（测试版）</option><option value="amap">高德 · 城市地图与三维楼块</option><option value="ion">Cesium 全球影像（使用现有 token）</option><option value="tianditu-img">天地图 · 卫星影像</option><option value="tianditu-vec">天地图 · 道路地图</option><option value="none">无底图（仅路线 / 地形）</option></select></label><label class="check-label"><input id="map-labels" type="checkbox" checked>显示地名注记</label><label class="check-label"><input id="map-buildings" type="checkbox">显示建筑（仅三维）</label><p class="dialog-note">高德模式显示高德楼块，其余三维模式显示 Cesium OSM 建筑；均非实景模型。</p><label class="field">Cesium ion token <span id="token-state"></span><input id="token" type="password" autocomplete="off" placeholder="只读 token；已配置时留空保留"></label><label class="field" id="tdt-field">天地图浏览器端 Key <span id="tdt-state"></span><input id="tdt-key" type="password" autocomplete="off" placeholder="与 Cesium token 不同"><a href="https://console.tianditu.gov.cn/" target="_blank" rel="noopener noreferrer">前往天地图控制台申请 ↗</a></label><div id="amap-fields" hidden><p id="backend-state" class="dialog-note" role="status">正在检查地图代理…</p><div id="amap-local-fields"><label class="field">高德 Web 端（JS API）Key <span id="amap-state"></span><input id="amap-key" type="password" autocomplete="off" placeholder="已配置时留空保留"></label><label class="field">高德安全密钥 securityJsCode<input id="amap-security" type="password" autocomplete="off" placeholder="与上方 Key 配套的安全密钥"></label></div><p class="dialog-note">高德地图独立显示，不叠加 Cesium 地形。地形模式使用 2.1Beta，仅三维下开启山体起伏；楼块和路线贴地效果待实测。城市模式使用 2.0；网页样式与高德 App 可能不同。凭据仅用于当前标签页本地预览；公开部署需改用服务端安全代理。</p></div><label class="field" id="imagery-field">Cesium 影像 Asset ID（可选）<input id="imagery" inputmode="numeric" placeholder="留空使用 Cesium 默认全球影像"></label><p class="dialog-note">凭据仅留在当前标签页会话，不写入源文件。底图请求会发给所选服务商；GPX 原文件不上传。未申请天地图 Key 时，可先选 Cesium 影像（需有对应资产权限）。</p><p id="settings-error" class="form-error" role="alert" hidden></p><button id="apply-settings" type="button" class="primary-button">应用地图设置</button><button id="clear-keys" type="button" class="text-button">清除本标签页的地图凭据</button><div class="dialog-divider"></div><h3>电脑预览的边界</h3><p>适合行前查看和前台模拟。Android 锁屏定位、耗电与户外可靠性仍需真机验证。无底图时可用本地路线，不能据此判断未知区域能否通行。</p></form></dialog>
  <dialog id="rename-dialog"><form id="rename-form"><div class="dialog-heading"><h2>重命名路线</h2><button type="button" class="icon-button" id="close-rename" aria-label="关闭">${icon('close')}</button></div><label class="field">路线名称<input id="rename-input" maxlength="200" required></label><button class="primary-button">保存名称</button></form></dialog>
  <dialog id="delete-dialog"><form method="dialog"><h2>删除这条本地路线？</h2><p>这会移除浏览器保存的副本，不会删除电脑上的原始 GPX 文件。</p><div class="dialog-actions"><button class="secondary-button">取消</button><button type="button" id="confirm-delete" class="danger-button">删除路线</button></div></form></dialog>
  <div id="importing" class="import-overlay" hidden><div>${icon('upload')}<h2>正在整理路线</h2><p id="import-status">解析 GPX 并计算统计…</p><button id="cancel-import" class="secondary-button">取消导入</button></div></div>`;

let records:StoredTrack[]=[], current:StoredTrack|undefined, selected=0;
let scene:Scene3D|AmapScene|undefined, mode:'2d'|'3d'='2d', sceneGeneration=0;
let simulation:ReturnType<typeof setInterval>|undefined, browserActive=false, lastFix:LocationFix|undefined;
let reverse=false, simMeter=0, lastTick=0;
let activeSegment=0;
const guidance=new Guidance(), browserLocation=new BrowserLocation();
const routeMap=new RouteMap($('#map'), meter=>{if(!browserActive){stopSimulation();selectMeter(meter);resetGuidance();}});
let toastTimer:ReturnType<typeof setTimeout>;
function toast(message:string){ $('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500); }
function renderLibrary(){
  $('#route-count').textContent=String(records.length);
  $('#route-list').innerHTML=records.map(r=>`<button class="route-item ${r.track.id===current?.track.id?'selected':''}" data-id="${esc(r.track.id)}"><span class="route-thumb">${icon('route')}</span><span class="route-item-text"><strong>${esc(r.track.name)}</strong><span>${km(r.track.stats.distance)} km <b>·</b> ↑ ${elevation(r.track.stats.ascent)} m</span><small>${r.track.demo?'演示数据':r.track.kind==='route'?'GPX 路线点':'本地 GPX'} · ${r.track.segments.length} 段</small></span>${r.track.id===current?.track.id?'<span class="selected-dot"></span>':''}</button>`).join('');
}
function choose(record:StoredTrack){
  stopAll();current=record;selected=0;activeSegment=0;reverse=false;$('#reverse').checked=false;
  sessionStorage.setItem('route-id',record.track.id);
  const t=record.track;
  $('#route-name').textContent=t.name;
  $('#route-meta').textContent=`${t.demo?'合成演示 · ':''}${t.stats.count.toLocaleString()} 个轨迹点　/　${t.segments.length} 个分段　/　${t.waypoints.length} 个航点`;
  $('#route-kind').textContent=t.kind==='route'?'GPX ROUTE':'GPX TRACK';
  $('#distance').innerHTML=`${km(t.stats.distance)} <small>km</small>`;
  $('#ascent').innerHTML=`${elevation(t.stats.ascent)} <small>m</small>`;
  $('#descent').innerHTML=`${elevation(t.stats.descent)} <small>m</small>`;
  $('#highest').innerHTML=`${elevation(t.stats.max)} <small>m</small>`;
  $('#duration').textContent=duration(t.stats.duration);
  $('#quality-text').textContent=[...t.warnings,'距离采用 WGS84 测地线；升降使用 3 m 高程滞回，缺高程时不报完整爬升。'].join('；');
  $('#demo-tag').hidden=!t.demo;
  $('#scrub').max=String(Math.max(1,t.stats.distance));
  $('#segment-field').hidden=t.segments.length<=1;
  $('#segment').innerHTML=t.segments.map((s,i)=>`<option value="${i}">第 ${i+1} 段 · ${km(s.at(-1)!.distance-s[0].distance)} km</option>`).join('');
  routeMap.setTrack(t);scene?.setTrack(t);renderLibrary();renderProfile();selectMeter(0);resetGuidance();
}
function renderProfile(){
  if(!current)return;
  const t=current.track, min=t.stats.min??0, max=t.stats.max??1, span=Math.max(30,max-min);
  const y=(e:number)=>108-(e-min)/span*93,x=(d:number)=>d/Math.max(t.stats.distance,1)*1000;
  const runs:string[]=[];
  for(const seg of t.segments){
    // Split missing elevation before display sampling, never bridge a missing interval.
    let part:typeof seg=[];
    const flush=()=>{ if(part.length)runs.push(thin(part,500).map(p=>`${x(p.distance).toFixed(2)},${y(p.ele!).toFixed(2)}`).join(' '));part=[]; };
    for(const p of seg){if(p.ele===undefined)flush();else part.push(p);}flush();
  }
  $('#profile').innerHTML=`<defs><linearGradient id="profile-gradient" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#90a875" stop-opacity=".36"/><stop offset="1" stop-color="#90a875" stop-opacity=".05"/></linearGradient></defs>${[15,61,108].map(v=>`<line x1="0" y1="${v}" x2="1000" y2="${v}" stroke="#e5e7dd" stroke-dasharray="4 5"/>`).join('')}${runs.map(s=>`<polygon points="${s.split(' ')[0].split(',')[0]},120 ${s} ${s.split(' ').at(-1)!.split(',')[0]},120" fill="url(#profile-gradient)"/><polyline points="${s}" fill="none" stroke="#6b8653" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}<line id="profile-cursor" x1="0" y1="0" x2="0" y2="120" stroke="#cd6944" stroke-dasharray="4 3"/><circle id="profile-point" cx="0" cy="108" r="4" fill="#ce704c"/>`;
  $('#profile-empty').hidden=t.stats.elevationCount>0;
  $('#elevation-axis').innerHTML=[max,(min+max)/2,min].map(v=>`<span>${t.stats.elevationCount?Math.round(v)+' m':'—'}</span>`).join('');
  $('#distance-axis').innerHTML=Array.from({length:6},(_,i)=>`<span>${(t.stats.distance/1000*i/5).toFixed(1)} km</span>`).join('');
}
function selectMeter(meter:number){
  if(!current)return;selected=Math.max(0,Math.min(current.track.stats.distance,meter));
  const t=current.track,p=pointAt(t,selected,activeSegment);activeSegment=p.segment;$('#segment').value=String(activeSegment);
  $('#scrub').value=String(selected);
  $('#selected-value').innerHTML=`<span>${km(selected)} km</span><b>${elevation(p.ele)} <small>m</small></b>`;
  $('#selected-coordinates').textContent=`${Math.abs(p.lat).toFixed(5)}° ${p.lat>=0?'N':'S'} · ${Math.abs(p.lon).toFixed(5)}° ${p.lon>=0?'E':'W'} · WGS84`;
  const x=selected/Math.max(t.stats.distance,1)*1000, y=p.ele===undefined?108:108-(p.ele-(t.stats.min??0))/Math.max(30,(t.stats.max??0)-(t.stats.min??0))*93;
  $('#profile-cursor').setAttribute('x1',String(x));$('#profile-cursor').setAttribute('x2',String(x));$('#profile-point').setAttribute('cx',String(x));$('#profile-point').setAttribute('cy',String(y));$('#profile-point').style.display=p.ele===undefined?'none':'';
  routeMap.setSelected(p);scene?.setSelected(p);
  if(!simulation&&!browserActive)updateProgress(selected);
}
function updateProgress(meter:number){if(!current)return;const total=current.track.stats.distance,walked=reverse?total-meter:meter;$('#walked').innerHTML=`${km(walked)} <small>km</small>`;$('#remaining').innerHTML=`${km(Math.max(0,total-walked))} <small>km</small>`;$('#progress-fill').style.width=`${total?walked/total*100:0}%`;}
function status(title:string,detail:string,kind='ready'){ $('#guidance-title').textContent=title;$('#guidance-detail').textContent=detail;$('#guidance-status').className=`guidance-status ${kind}`; }
function resetGuidance(){guidance.reset(selected,activeSegment);lastFix=undefined;routeMap.setLive();scene?.setLive();status('准备出发','选择起始位置，然后开始模拟。');updateProgress(selected);}
let audio:AudioContext|undefined;
function prepareAudio(){if($('#sound').checked){try{audio??=new AudioContext();void audio.resume();}catch{}}}
function alertUser(){if(!$('#sound').checked)return;try{if(audio){const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=740;gain.gain.setValueAtTime(.12,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.45);oscillator.start();oscillator.stop(audio.currentTime+.45);}}catch{} navigator.vibrate?.([150,100,150]);}
function handleFix(fix:LocationFix){
  if(!current)return;lastFix=fix;const result=guidance.update(current.track,fix);
  if(Number.isFinite(fix.lat)&&Number.isFinite(fix.lon)&&Math.abs(fix.lat)<=90&&Math.abs(fix.lon)<=180&&Number.isFinite(fix.timestamp)&&Date.now()-fix.timestamp<10000&&fix.accuracy<=35){routeMap.setLive(fix);scene?.setLive(fix);}else{routeMap.setLive();scene?.setLive();}
  if(result.match){updateProgress(guidance.progress??result.match.progress);if(browserActive)selectMeter(guidance.progress??result.match.progress);}
  const d=result.match?Math.round(result.match.distance):0;
  if(result.state==='on-route')status('正在沿线行进',`距路线 ${d} m · 定位精度 ±${Math.round(fix.accuracy)} m`,'good');
  else if(result.state==='pending')status('正在确认偏离',`距路线 ${d} m，持续 5 秒后提醒。`,'pending');
  else if(result.state==='off-route')status('已偏离路线',`距路线约 ${d} m，请停下核对原轨迹。`,'off');
  else if(result.reason==='reanchor')status('请重新确认路段','位置跨越较远路段，请停止后选取起始里程。','uncertain');
  else status('位置暂不可靠','精度不足或位置过期，暂停偏离判断。','uncertain');
  if(result.alert)alertUser();
}
function stopSimulation(){if(simulation)clearInterval(simulation);simulation=undefined;$('#play').innerHTML=`${icon('play')} 开始模拟`;}
function stopAll(){stopSimulation();browserLocation.stop();browserActive=false;$('#segment').disabled=false;$('#scrub').disabled=false;$('#profile').style.pointerEvents='';$('#profile').style.opacity='';lastFix=undefined;$('#locate').innerHTML=`${icon('locate')} 使用浏览器定位`;$('#play').disabled=false;$('#reverse').disabled=false;$('#mode-tag').textContent='模拟';}
function tick(){
  if(!current)return;const now=Date.now(),dt=Math.min((now-lastTick)/1000,1);lastTick=now;
  const step=advanceSimulation(current.track,simMeter,activeSegment,(reverse?-1:1)*1.3*Number($('#speed').value)*dt);simMeter=step.meter;
  selectMeter(simMeter);
  const points=current.track.segments[activeSegment];
  const p=pointAt(current.track,simMeter,activeSegment),ahead=pointAt(current.track,Math.min(points.at(-1)!.distance,simMeter+20),activeSegment);
  const [dx,dy]=localXY(ahead,p),length=Math.hypot(dx,dy)||1,offset=$('#scenario').value==='off'?150:0;
  const ox=length>1?-dy/length*offset:offset,oy=dx/length*offset;
  handleFix({...p,lat:p.lat+oy/111195,lon:wrapLon(p.lon+ox/(111195*Math.max(.01,Math.cos(radians(p.lat))))),accuracy:$('#scenario').value==='weak'?80:6,timestamp:now,crs:'WGS84',source:'simulation'});
  if(step.ended){stopSimulation();status(step.hasNext?'已到分段边界':'本段模拟已结束',step.hasNext?'断口不代表可通行，请选择下一分段后继续。':'这是路线回放结果，不代表实地到达。');}
}
$('#play').addEventListener('click',()=>{
  if(!current)return;if(simulation){stopSimulation();status('模拟已暂停','可调整里程、方向或模拟情境。');return;}
  stopAll();prepareAudio();simMeter=selected;const points=current.track.segments[activeSegment];if((!reverse&&selected>=points.at(-1)!.distance)||(reverse&&selected<=points[0].distance))simMeter=reverse?points.at(-1)!.distance:points[0].distance;
  guidance.reset(simMeter,activeSegment);lastTick=Date.now();simulation=setInterval(tick,500);$('#play').innerHTML=`${icon('pause')} 暂停模拟`;tick();
});
$('#locate').addEventListener('click',()=>{
  if(!current)return;if(browserActive){stopAll();resetGuidance();return;}stopAll();prepareAudio();browserActive=true;guidance.reset(selected,activeSegment);$('#mode-tag').textContent='浏览器';$('#locate').innerHTML=`${icon('close')} 停止定位`;$('#play').disabled=true;$('#reverse').disabled=true;$('#segment').disabled=true;$('#scrub').disabled=true;$('#profile').style.pointerEvents='none';$('#profile').style.opacity='0.5';status('等待设备位置','请允许浏览器定位；电脑定位可能不够精确。');
  browserLocation.start(handleFix,message=>{stopAll();status('无法获取位置',message,'uncertain');toast(message);});
});
setInterval(()=>{if(browserActive&&lastFix&&Date.now()-lastFix.timestamp>10000){routeMap.setLive();scene?.setLive();status('位置已过期','超过 10 秒未更新，暂停偏离判断。','uncertain');}},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(simulation||browserActive)){stopAll();status('行进已暂停','页面已进入后台，请返回后手动重新开始。','uncertain');}});
$('#reverse').addEventListener('change',()=>{if(!current)return;stopSimulation();reverse=$('#reverse').checked;activeSegment=reverse?current.track.segments.length-1:0;selectMeter(reverse?current.track.stats.distance:0);resetGuidance();});
$('#segment').addEventListener('change',()=>{if(!current||browserActive)return;stopSimulation();activeSegment=Number($('#segment').value);const points=current.track.segments[activeSegment];selectMeter(reverse?points.at(-1)!.distance:points[0].distance);resetGuidance();});
$('#scrub').addEventListener('input',()=>{if(browserActive)return;stopSimulation();selectMeter(Number($('#scrub').value));resetGuidance();});
$('#profile').addEventListener('pointerdown',e=>{if(browserActive||!current)return;const r=$('#profile').getBoundingClientRect();stopSimulation();selectMeter((e.clientX-r.left)/r.width*current.track.stats.distance);resetGuidance();});
$('#route-list').addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-id]');const record=records.find(r=>r.track.id===button?.dataset.id);if(record)choose(record);});

async function switchMode(next:'2d'|'3d',localOnly=false){
  const generation=++sceneGeneration;scene?.destroy();scene=undefined;mode=next;
  sessionStorage.setItem('view-mode',next);
  const settings=loadMapSettings(sessionStorage),useGl=!localOnly&&(next==='3d'||settings.basemap!=='none');
  $('#view2d').classList.toggle('active',next==='2d');$('#view3d').classList.toggle('active',next==='3d');$('#view2d').setAttribute('aria-pressed',String(next==='2d'));$('#view3d').setAttribute('aria-pressed',String(next==='3d'));
  $('#map').hidden=useGl;$('#cesium').hidden=!useGl;$('.compass').hidden=useGl;$('#map-hint').textContent=next==='2d'?'拖动平移 · 滚轮缩放 · 点击路线选点':'左键平移 · 滚轮缩放 · Ctrl + 拖动倾斜';
  if(settings.basemap.startsWith('amap')&&useGl)$('#map-hint').textContent=next==='3d'?'高德三维 · 右键拖动旋转倾斜':'高德城市二维 · 点击路线选点';
  if(!useGl){$('#map-status').textContent='本地路线 · 无底图';routeMap.draw();return;}
  $('#map-status').textContent='正在启动三维引擎…';
  try{
    const Scene=settings.basemap.startsWith('amap')?(await import('./ui/amap')).AmapScene:(await import('./ui/scene3d')).Scene3D;if(generation!==sceneGeneration)return;
    scene=new Scene($('#cesium'),s=>{if(generation===sceneGeneration)$('#map-status').textContent=s;},message=>{setTimeout(()=>{if(generation===sceneGeneration){void switchMode('2d',true);toast(message);}},0);},next,(meter,segment)=>{if(!browserActive){stopSimulation();activeSegment=segment;selectMeter(meter);resetGuidance();}});
    if(current){scene.setTrack(current.track);scene.setSelected(pointAt(current.track,selected,activeSegment));}
    if(lastFix)scene.setLive(lastFix);
    void scene.connect(settings);
  }catch{if(generation===sceneGeneration){void switchMode('2d',true);toast('地图引擎不可用，已保留本地二维路线。请尝试开启浏览器硬件加速。');}}
}
$('#view2d').addEventListener('click',()=>{if(mode!=='2d')void switchMode('2d');});$('#view3d').addEventListener('click',()=>{if(mode!=='3d')void switchMode('3d');});
$('#fit').addEventListener('click',()=>scene?scene.fit():routeMap.fit());$('#zoom-in').addEventListener('click',()=>scene?scene.zoom(1.3):routeMap.zoomBy(1.3));$('#zoom-out').addEventListener('click',()=>scene?scene.zoom(.75):routeMap.zoomBy(.75));
$('#local-map').addEventListener('click',()=>void switchMode('2d',true));$('#retry-map').addEventListener('click',()=>void switchMode(mode));
function updateSettingsFields(){const type=$('#basemap').value;$('#amap-fields').hidden=!type.startsWith('amap');$('#tdt-field').hidden=!type.startsWith('tianditu-');$('#imagery-field').hidden=type!=='ion';$('#settings-error').hidden=true;}
async function settings(){const backend=(await refreshBackendConfig()).amap;$('#backend-state').textContent=backend.enabled?'已连接服务器代理 · 安全密钥由后端保管':import.meta.env.DEV?'后端未配置 · 当前为本地直连调试模式，上线前需配置服务器凭据':'后端未配置，请在服务器设置高德凭据后重启服务';$('#amap-local-fields').hidden=backend.enabled||!import.meta.env.DEV;const config=loadMapSettings(sessionStorage);$('#amap-key').value='';$('#amap-security').value='';$('#amap-state').textContent=config.amapKey?'已配置，留空保留':'尚未配置';$('#token').value='';$('#tdt-key').value='';$('#token-state').textContent=config.token?'已配置，留空保留':'尚未配置';$('#tdt-state').textContent=config.tiandituKey?'已配置，留空保留':'需要独立 Key';$('#imagery').value=config.imageryAsset?.toString()??'';$('#basemap').value=config.basemap;$('#map-labels').checked=config.labels;$('#map-buildings').checked=config.buildings!==false;updateSettingsFields();$('#settings-dialog').showModal(); }
$('#settings').addEventListener('click',settings);$('#terrain-settings').addEventListener('click',settings);
$('#basemap').addEventListener('change',updateSettingsFields);
$('#apply-settings').addEventListener('click',()=>{
  const old=loadMapSettings(sessionStorage),asset=$('#imagery').value.trim();
  try{saveMapSettings(sessionStorage,{amapKey:$('#amap-key').value.trim()||old.amapKey,amapSecurity:$('#amap-security').value.trim()||old.amapSecurity,token:$('#token').value.trim()||old.token,tiandituKey:$('#tdt-key').value.trim()||old.tiandituKey,basemap:$('#basemap').value as Basemap,labels:$('#map-labels').checked,buildings:$('#map-buildings').checked,imageryAsset:asset?Number(asset):undefined});$('#token').value='';$('#tdt-key').value='';$('#amap-key').value='';$('#amap-security').value='';$('#settings-dialog').close();void switchMode($('#basemap').value==='amap-terrain'?'3d':mode);}
  catch(error){$('#settings-error').textContent=(error as Error).message;$('#settings-error').hidden=false;}
});
$('#clear-keys').addEventListener('click',()=>{saveMapSettings(sessionStorage,{token:'',tiandituKey:'',basemap:'none',labels:true});$('#amap-key').value='';$('#amap-security').value='';$('#token').value='';$('#tdt-key').value='';$('#settings-dialog').close();void switchMode('2d',true);toast('地图凭据已清除，本地轨迹不受影响。');});

let worker:Worker|undefined, cancelReject:((reason:Error)=>void)|undefined, importGeneration=0;
function parseAsync(xml:string,filename:string):Promise<Track[]>{
  return new Promise((resolve,reject)=>{
    const w=new Worker(new URL('./parse.worker.ts',import.meta.url),{type:'module'});worker=w;cancelReject=reject;
    const timer=setTimeout(()=>{w.terminate();if(worker===w)worker=undefined;reject(new Error('解析超时，请分轨导入。'));},30000);
    w.onmessage=e=>{clearTimeout(timer);w.terminate();if(worker===w){worker=undefined;cancelReject=undefined;}if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.tracks);};
    w.onerror=()=>{clearTimeout(timer);w.terminate();if(worker===w)worker=undefined;reject(new Error('解析进程启动失败，请刷新后重试。'));};
    cancelReject=reason=>{clearTimeout(timer);w.terminate();reject(reason);};w.postMessage({xml,filename});
  });
}
async function importFile(file:File){
  if(file.size>20*1024*1024){toast('文件超过 20 MB，请先分轨导出。');return;}
  if($('#importing').hidden===false)return;
  const generation=++importGeneration;$('#importing').hidden=false;$('#cancel-import').disabled=false;$('#import-status').textContent='解析 GPX 并计算统计…';
  try{
    const xml=await file.text(),hash=await hashFile(xml);if(generation!==importGeneration)return;
    const tracks=await parseAsync(xml,file.name);if(generation!==importGeneration)return;
    $('#import-status').textContent='正在保存本地副本…';$('#cancel-import').disabled=true;
    const incoming=tracks.map((track,i)=>({track:{...track,id:`${hash}-${i}`},xml,hash,original:file})).filter(record=>!records.some(r=>r.track.id===record.track.id));
    if(!incoming.length){choose(records.find(r=>r.hash===hash)!);toast('这份文件已完整导入，已打开本地副本。');return;}
    await saveTracks(incoming);records.unshift(...incoming);choose(incoming[0]);
    toast(`已导入 ${incoming.length} 条路线，原文件保存在本地副本中。`);
  }catch(e){toast(e instanceof Error?e.message:'导入失败，请重试。');renderLibrary();}
  finally{if(generation===importGeneration)$('#importing').hidden=true;}
}
$('#import').addEventListener('click',()=>$('#file').click());$('#file').addEventListener('change',()=>{const f=$('#file').files?.[0];if(f)void importFile(f);$('#file').value='';});
$('#cancel-import').addEventListener('click',()=>{++importGeneration;worker?.terminate();worker=undefined;cancelReject?.(new Error('已取消导入。'));cancelReject=undefined;$('#importing').hidden=true;});
document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});document.addEventListener('drop',e=>{e.preventDefault();const file=e.dataTransfer?.files[0];if(file)void importFile(file);});
let demo:StoredTrack;
$('#add-demo').addEventListener('click',()=>{if(demo){if(!records.find(r=>r.track.id===demo.track.id))records.push(demo);choose(demo);}});
$('#rename').addEventListener('click',()=>{if(current){$('#rename-input').value=current.track.name;$('#rename-dialog').showModal();}});
$('#close-rename').addEventListener('click',()=>$('#rename-dialog').close());
$('#rename-form').addEventListener('submit',async e=>{e.preventDefault();if(!current)return;const name=$('#rename-input').value.trim();if(!name)return;const updated={...current,track:{...current.track,name}};try{await saveTrack(updated);records=records.map(r=>r.track.id===updated.track.id?updated:r);choose(updated);$('#rename-dialog').close();}catch(e){toast((e as Error).message);}});
$('#remove').addEventListener('click',()=>{if(current?.track.demo){toast('演示路线用于快速预览，无需删除本地文件。');return;}if(current)$('#delete-dialog').showModal();});
$('#confirm-delete').addEventListener('click',async()=>{if(!current)return;const id=current.track.id;try{await deleteTrack(id);records=records.filter(r=>r.track.id!==id);choose(records[0]??demo);$('#delete-dialog').close();toast('本地副本已删除。');}catch(e){toast((e as Error).message);}});
$('#export').addEventListener('click',()=>{if(!current)return;const url=URL.createObjectURL(current.original??new Blob([current.xml],{type:'application/gpx+xml;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=current.track.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function network(){ $('#network').innerHTML=`<i class="${navigator.onLine?'':'offline'}"></i>${navigator.onLine?'本地优先':'离线 · 本地路线可用'}`; }window.addEventListener('online',network);window.addEventListener('offline',network);network();
async function boot(){
  await refreshBackendConfig();
  const xml=demoGpx(),tracks=await parseAsync(xml,'ridgeline-demo.gpx');const track=tracks[0];track.id='demo-ridgeline';track.demo=true;demo={track,xml,hash:'demo'};
  try{records=await listTracks();}catch(e){toast((e as Error).message);}
  if(!records.some(r=>r.track.id===track.id))records.push(demo);records.sort((a,b)=>Number(!!a.track.demo)-Number(!!b.track.demo)||b.track.importedAt-a.track.importedAt);
  const savedRoute=sessionStorage.getItem('route-id');choose(records.find(r=>r.track.id===savedRoute)??records[0]);if(loadMapSettings(sessionStorage).basemap!=='none'||sessionStorage.getItem('view-mode')==='3d')void switchMode(sessionStorage.getItem('view-mode')==='3d'?'3d':'2d');
}
void boot().catch(()=>{status('初始化失败','请刷新页面重试。','uncertain');toast('无法启动解析模块，请检查本地服务。');});











