import { refreshBackendConfig } from '../adapters/backend';
import type { MapSettings } from '../core/map-settings';
import type { Track, GeoPoint } from '../core/types';
import { simplifyLine } from '../core/geo';
import { toGcj, fromGcj } from '../core/coordinates';
import { matchRoute } from '../core/navigation';
// The SDK is isolated in its own document, so changing keys/modes tears down all SDK state.
export class AmapScene {
 private frame=document.createElement('iframe'); private dead=false;private ready=false;
 private track?:Track;private selected?:GeoPoint;private live?:GeoPoint;
 private timer?:ReturnType<typeof setTimeout>;
 private terrain=false;
 constructor(container:HTMLElement,private status:(s:string)=>void,private fail:(s:string)=>void,private mode:'2d'|'3d',private select:(meter:number,segment:number)=>void){
  this.frame.title='高德城市地图';this.frame.style.cssText='width:100%;height:100%;border:0;display:block';container.append(this.frame);window.addEventListener('message',this.receive);
 }
 private receive=(event:MessageEvent)=>{
  if(this.dead||event.source!==this.frame.contentWindow||event.origin!==location.origin)return;
  const d=event.data;if(d?.channel!=='ridgeline-amap')return;
  if(d.type==='ready'&&!this.ready){clearTimeout(this.timer);this.ready=true;this.status(this.terrain?(this.mode==='3d'?'高德地形（测试版）· 地图已就绪':'高德二维 · 地形仅三维可见'):(this.mode==='3d'?'高德城市三维 · 放大查看楼块':'高德城市二维'));if(this.track)this.setTrack(this.track);if(this.selected)this.setSelected(this.selected);if(this.live)this.setLive(this.live);}
  if(d.type==='error'){clearTimeout(this.timer);this.fail('高德地图未连接，请检查 Web 端 Key、安全密钥、域名配置及网络。');}
  if(d.type==='click'&&this.track&&Number.isFinite(d.lon)&&Number.isFinite(d.lat)){
   const p=fromGcj(d.lon,d.lat),m=matchRoute(this.track,{...p,crs:'WGS84',source:'simulation',accuracy:0,timestamp:Date.now()});
   if(m.distance<100)this.select(m.progress,m.segment);
  }
 };
 private send(type:string,data:unknown){if(!this.dead&&this.ready)this.frame.contentWindow?.postMessage({channel:'ridgeline-host',type,data},location.origin);}
 async connect(settings:MapSettings){
  const backend=(await refreshBackendConfig()).amap;if(this.dead)return;
  if(!backend.enabled&&(!import.meta.env.DEV||!settings.amapKey||!settings.amapSecurity)){this.fail('高德未配置：请在服务器 .env.server 中设置 Key 和安全密钥后重启后端。');return;}
  this.terrain=settings.basemap==='amap-terrain';
  this.frame.title=this.terrain?'高德地形地图（测试版）':'高德城市地图';
  this.status(this.terrain?'高德地形（测试版）连接中…':'高德城市地图连接中…');
  this.frame.onload=()=>{if(!this.dead)this.frame.contentWindow?.postMessage({channel:'ridgeline-host',type:'init',data:{key:backend.enabled?backend.key:settings.amapKey,serviceHost:backend.enabled?location.origin+backend.serviceHost:undefined,security:backend.enabled?undefined:settings.amapSecurity,mode:this.mode,terrain:this.terrain,labels:settings.labels,buildings:settings.buildings!==false}},location.origin);};
  this.frame.srcdoc=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>html,body,#map{height:100%;width:100%;margin:0;background:#eef0e8}</style></head><body><div id="map"></div><script>(${amapRuntime.toString()})(${JSON.stringify(location.origin)});<\/script></body></html>`;
  this.timer=setTimeout(()=>{if(!this.ready&&!this.dead)this.fail('高德地图连接超时，已保留本地路线。请检查凭据与网络后重试。');},25000);
 }
 setTrack(track:Track){this.track=track;this.send('track',track.segments.map(s=>simplifyLine(s,Math.max(2,Math.floor(5000/track.segments.length))).map(toGcj)));}
 setSelected(p:GeoPoint){this.selected=p;this.send('selected',toGcj(p));}
 setLive(p?:GeoPoint){this.live=p;this.send('live',p?toGcj(p):null);}
 fit(){this.send('fit',null);} zoom(multiplier:number){this.send('zoom',multiplier>1?1:-1);}
 destroy(){this.dead=true;clearTimeout(this.timer);window.removeEventListener('message',this.receive);this.frame.remove();}
}
// Self-contained SDK boundary; serialized into a local iframe. No credentials are embedded in HTML.
export function amapRuntime(origin:string){
 const w=window as any;let map:any,A:any,lines:any[]=[],selected:any,live:any,started=false;
 const tell=(type:string,extra:object={})=>parent.postMessage({channel:'ridgeline-amap',type,...extra},origin);
 const fit=()=>{if(lines.length)map.setFitView(lines,false,[65,65,65,65],17);};
 // CircleMarker in the terrain beta can render displaced copies as the camera
 // changes. Marker explicitly supports terrain-relative height=0 in 2.1.
 const dot=(position:number[],color:string,size:number,title:string)=>{
  const content=document.createElement('span');content.title=title;
  content.style.cssText=`display:block;width:${size}px;height:${size}px;box-sizing:border-box;border:2px solid white;border-radius:50%;background:${color};box-shadow:0 1px 3px #0005;`;
  return new A.Marker({position,content,anchor:'center',offset:[0,0],height:0,bubble:true,title,zIndex:200});
 };
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==origin||event.data?.channel!=='ridgeline-host')return;
  const {type,data}=event.data;
  if(type==='init'&&!started){
   started=true;w._AMapSecurityConfig=data.serviceHost?{serviceHost:data.serviceHost}:{securityJsCode:data.security};
   const script=document.createElement('script');script.src='https://webapi.amap.com/maps?v='+(data.terrain?'2.1Beta':'2.0')+'&key='+encodeURIComponent(data.key);
   script.onerror=()=>tell('error');script.onload=()=>{try{
    A=w.AMap;map=new A.Map('map',{viewMode:data.mode==='3d'?'3D':'2D',terrain:!!data.terrain&&data.mode==='3d',pitch:data.mode==='3d'?55:0,zoom:16,zooms:[3,20],center:[114.06,22.55],rotateEnable:true,pitchEnable:data.mode==='3d',showBuildingBlock:data.buildings,showLabel:data.labels,mapStyle:'amap://styles/normal'});
    map.on('complete',()=>tell('ready'));
    map.on('click',(e:any)=>tell('click',{lon:e.lnglat.getLng(),lat:e.lnglat.getLat()}));
   }catch{tell('error');}};document.head.append(script);return;
  }
  if(!map)return;
  if(type==='track'){
   map.remove(lines);lines=[];
   if(selected)map.remove(selected);if(live)map.remove(live);selected=undefined;live=undefined;
   for(const path of data){if(path.length>1)lines.push(new A.Polyline({path,strokeColor:'#e67d32',strokeWeight:5,isOutline:true,outlineColor:'#fff',borderWeight:1,bubble:true}));
    for(const [i,center] of [path[0],path[path.length-1]].entries())lines.push(dot(center,i?'#e67d32':'#325940',12,i?'分段终点':'分段起点'));}
   map.add(lines);fit();
  }
  if(type==='selected'||type==='live'){
   const old=type==='selected'?selected:live;if(old)map.remove(old);
   const marker=data?dot(data,type==='selected'?'#ff8c3e':'#488bc5',16,type==='selected'?'当前选点':'当前位置'):undefined;
   if(marker)map.add(marker);if(type==='selected')selected=marker;else live=marker;
  }
  if(type==='fit')fit();if(type==='zoom')map.setZoom(map.getZoom()+data);
 });
}


