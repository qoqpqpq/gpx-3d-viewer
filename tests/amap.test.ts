import { it, expect, vi } from 'vitest';
import { amapRuntime } from '../src/ui/amap';
it('anchors markers to terrain and removes all old points on route replacement',()=>{
 let receive:(e:any)=>void=()=>{},script:any;
 const active=new Set<any>(),parent={postMessage:vi.fn()};
 class Overlay {constructor(public options:any){}}
 class MapMock {
  on(){} setFitView(){} getZoom(){return 16;} setZoom(){}
  add(items:any){for(const i of Array.isArray(items)?items:[items])active.add(i);}
  remove(items:any){for(const i of Array.isArray(items)?items:[items])active.delete(i);}
 }
 vi.stubGlobal('parent',parent);
 vi.stubGlobal('window',{AMap:{Map:MapMock,Marker:Overlay,Polyline:Overlay},addEventListener:(_:string,fn:any)=>{receive=fn;}});
 vi.stubGlobal('document',{createElement:(tag:string)=>tag==='script'?(script={}):{style:{}},head:{append:()=>{script.onload();}}});
 try{
  amapRuntime('http://localhost');
  const send=(type:string,data:any)=>receive({source:parent,origin:'http://localhost',data:{channel:'ridgeline-host',type,data}});
  send('init',{key:'test',security:'test',terrain:true,mode:'3d'});
  send('track',[[[114,22],[114.01,22.01]],[[114.02,22.02],[114.03,22.03]]]);
  send('selected',[114,22]);send('live',[114,22]);send('live',[114.01,22]);
  expect(active.size).toBe(8); // two lines, four ends, one selection, one live fix
  for(const o of active)if(o.options.position)expect(o.options).toMatchObject({height:0,anchor:'center',offset:[0,0]});
  const old=[...active];send('track',[[[115,23],[115.01,23.01]]]);
  expect(active.size).toBe(3);expect(old.some(o=>active.has(o))).toBe(false);
 }finally{vi.unstubAllGlobals();}
});
