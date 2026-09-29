import { describe, it, expect } from 'vitest';
import { parseGpx } from '../src/core/gpx';
import { distance, pointAt, thin, simplifyLine } from '../src/core/geo';
import { Guidance, matchRoute } from '../src/core/navigation';
import { demoGpx } from '../src/demo';
import type { LocationFix } from '../src/core/types';

const wrap=(s:string)=>`<gpx version="1.1">${s}</gpx>`;
const pt=(lat:number,lon:number,ele?:number,time?:string)=>`<trkpt lat="${lat}" lon="${lon}">${ele===undefined?'':`<ele>${ele}</ele>`}${time?`<time>${time}</time>`:''}</trkpt>`;
const track=(s:string)=>parseGpx(wrap(`<trk><trkseg>${s}</trkseg></trk>`))[0];
const fix=(lat:number,lon:number,timestamp:number,accuracy=5):LocationFix=>({lat,lon,timestamp,accuracy,crs:'WGS84',source:'simulation'});

describe('GPX data fidelity',()=>{
  it('uses WGS84 ellipsoid distance, with equator reference independent of the parser',()=>{
    expect(distance({lat:0,lon:0},{lat:0,lon:1})).toBeCloseTo(111319.490793,4);
  });
  it('keeps independent segments without connecting or counting their gap',()=>{
    const t=parseGpx(wrap(`<trk><trkseg>${pt(0,0,10)}${pt(0,.01,30)}</trkseg><trkseg>${pt(20,40,500)}${pt(20,40.01,510)}</trkseg></trk>`))[0];
    expect(t.segments).toHaveLength(2);expect(t.stats.distance).toBeLessThan(2300);expect(t.stats.ascent).toBe(30);expect(t.stats.descent).toBe(0);
  });
  it('retains distinct tracks, prefixed namespaces, route points and waypoints',()=>{
    const xml='\uFEFF<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1"><g:wpt lat="0" lon="0"><g:name>Water &amp; rest</g:name></g:wpt><g:trk><g:name>A</g:name><g:trkseg><g:trkpt lat="0" lon="0"/><g:trkpt lat="0" lon="1"/></g:trkseg></g:trk><g:rte><g:name>B</g:name><g:rtept lat="1" lon="0"/><g:rtept lat="1" lon="1"/></g:rte></g:gpx>';
    const tracks=parseGpx(xml);expect(tracks).toHaveLength(2);expect(tracks[1].kind).toBe('route');expect(tracks[0].waypoints[0].name).toBe('Water & rest');
  });
  it('does not invent elevation, ascent or duration for missing data',()=>{
    const t=track(pt(0,0,10)+pt(0,.01)+pt(0,.02,100));expect(t.stats.ascent).toBeNull();expect(t.stats.duration).toBeNull();expect(t.segments[0][1].ele).toBeUndefined();
  });
  it('breaks at invalid points, preserving both sides without an artificial bridge',()=>{
    const t=track(pt(0,0)+pt(99,1)+pt(0,2));expect(t.segments).toHaveLength(2);expect(t.stats.distance).toBe(0);expect(t.warnings.some(w=>w.includes('无效坐标'))).toBe(true);
  });
  it('accepts negative and zero elevation, but rejects reversed timestamps for duration',()=>{
    const t=track(pt(0,0,-20,'2026-01-01T01:00:00Z')+pt(0,.01,0,'2026-01-01T00:00:00Z'));expect(t.stats.min).toBe(-20);expect(t.stats.max).toBe(0);expect(t.stats.duration).toBeNull();expect(t.stats.ascent).toBe(20);
  });
  it('computes elapsed time within segments, excluding recording gaps',()=>{
    const t=parseGpx(wrap(`<trk><trkseg>${pt(0,0,0,'2026-01-01T00:00:00Z')}${pt(0,.01,0,'2026-01-01T00:01:00Z')}</trkseg><trkseg>${pt(0,.02,0,'2026-01-02T00:00:00Z')}${pt(0,.03,0,'2026-01-02T00:02:00Z')}</trkseg></trk>`))[0];expect(t.stats.duration).toBe(180000);
  });
  it('rejects truncated XML, empty files, DTD and excessive nesting',()=>{
    for(const xml of ['', '<gpx><trk>', '<!DOCTYPE gpx [<!ENTITY x "secret">]><gpx/>', '<gpx>'+ '<x>'.repeat(65)+'</x>'.repeat(65)+'</gpx>'])expect(()=>parseGpx(xml)).toThrow();
  });
  it('keeps dateline distances and interpolated longitude local',()=>{
    const t=track(pt(0,179.99)+pt(0,-179.99));expect(t.stats.distance).toBeLessThan(2300);expect(Math.abs(pointAt(t,t.stats.distance/2).lon)).toBeCloseTo(180,3);
  });
  it('does not change statistics when sampling for display',()=>{
    const t=parseGpx(demoGpx())[0],before=JSON.stringify(t.stats);const points=thin(t.segments[0],30);expect(points.length).toBeLessThan(40);expect(JSON.stringify(t.stats)).toBe(before);expect(points[0]).toBe(t.segments[0][0]);expect(points.at(-1)).toBe(t.segments[0].at(-1));
  });
  it('keeps horizontal switchback corners when reducing flat-elevation display geometry',()=>{
    const raw=[...Array.from({length:100},(_,i)=>pt(0,i*.00001,10)),...Array.from({length:100},(_,i)=>pt(i*.00001,.001,10)),...Array.from({length:100},(_,i)=>pt(.001,.001-i*.00001,10))];
    const t=track(raw.join('')),line=simplifyLine(t.segments[0],8);
    expect(line.length).toBeLessThanOrEqual(8);expect(line.some(p=>p.lon===.001&&p.lat<.0001)).toBe(true);expect(line.some(p=>p.lat===.001&&p.lon>.0009)).toBe(true);
  });
  it('parses 50,000 points without silently discarding them',()=>{
    const t=track(Array.from({length:50000},(_,i)=>pt(22,114+i*0.000001,100)).join(''));expect(t.stats.count).toBe(50000);expect(t.stats.distance).toBeGreaterThan(5000);
  },15000);
});

describe('trajectory guidance',()=>{
  const t=track(pt(0,0)+pt(0,.01));
  it('matches the middle of a segment rather than only recorded vertices',()=>{
    const m=matchRoute(t,fix(.0001,.005,1000));expect(m.distance).toBeCloseTo(11.12,1);expect(m.progress).toBeCloseTo(t.stats.distance/2,2);
  });
  it('requires 5 continuous seconds of reliable deviation and clears with hysteresis',()=>{
    const g=new Guidance();let result;
    for(let i=0;i<=5;i++)result=g.update(t,fix(.001,.001,10000+i*1000),10000+i*1000);
    expect(result!.state).toBe('off-route');expect(result!.alert).toBe(true);
    expect(g.update(t,fix(.001,.001,16000),16000).alert).toBe(false);
    expect(g.update(t,fix(0,.001,17000),17000).state).toBe('off-route');
    for(let i=18;i<=20;i++)result=g.update(t,fix(0,.001,i*1000),i*1000);
    expect(result!.state).toBe('on-route');
  });
  it('never warns on stale or imprecise fixes',()=>{
    const g=new Guidance();expect(g.update(t,fix(.001,.001,1000,80),1000).state).toBe('uncertain');expect(g.update(t,fix(.001,.001,1000),20000).alert).toBe(false);
  });
  it('does not accumulate confirmation time over a lost-location gap',()=>{
    const g=new Guidance();g.update(t,fix(.001,.001,1000),1000);expect(g.update(t,fix(.001,.001,20000),20000).state).toBe('pending');
  });
  it('tracks parallel off-route movement and can recover farther along the route',()=>{
    const long=track(Array.from({length:100},(_,i)=>pt(0,i*.0002)).join(''));
    const g=new Guidance();g.reset(0);
    for(let i=1;i<70;i++)g.update(long,fix(.00135,i*.0002,10000+i*1000),10000+i*1000);
    expect(g.progress).toBeGreaterThan(1400);
    let result;
    for(let i=70;i<75;i++)result=g.update(long,fix(0,i*.0002,10000+i*1000),10000+i*1000);
    expect(result!.state).toBe('on-route');expect(result!.match!.distance).toBeLessThan(1);
  });
  it('uses progress continuity at a crossing, including reverse starts',()=>{
    const loop=track(pt(0,0)+pt(0,.02)+pt(.02,.02)+pt(0,0));
    const start=matchRoute(loop,fix(0,0,1000),0),end=matchRoute(loop,fix(0,0,1000),loop.stats.distance);
    expect(start.progress).toBe(0);expect(end.progress).toBeCloseTo(loop.stats.distance,1);
  });
  it('asks for a new anchor after a distant jump instead of reporting a false deviation',()=>{
    const long=track(Array.from({length:100},(_,i)=>pt(0,i*.0002)).join(''));
    const g=new Guidance();g.reset(0);
    const r=g.update(long,fix(0,.018,10000),10000);expect(r.reason).toBe('reanchor');expect(r.alert).toBe(false);expect(r.match!.distance).toBeLessThan(1);
  });
});

import { advanceSimulation } from '../src/core/simulation';
import { loadMapSettings, saveMapSettings, validateMapSettings, tiandituLayers, tiandituWmtsUrl } from '../src/core/map-settings';
describe('map sources and segment regressions',()=>{
  const segmented=parseGpx(wrap(`<trk><trkseg>${pt(0,0)}${pt(0,.01)}</trkseg><trkseg>${pt(1,1)}${pt(1,1.01)}</trkseg></trk>`))[0];
  it('keeps both sides of a shared distance boundary selectable',()=>{
    const boundary=segmented.segments[1][0].distance;
    expect(pointAt(segmented,boundary,0).lat).toBe(0);
    expect(pointAt(segmented,boundary,1).lat).toBe(1);
  });
  it('stops playback at gaps in both directions without teleporting',()=>{
    const boundary=segmented.segments[1][0].distance;
    expect(advanceSimulation(segmented,0,0,100000)).toEqual({meter:boundary,ended:true,hasNext:true});
    expect(advanceSimulation(segmented,segmented.stats.distance,1,-100000)).toEqual({meter:boundary,ended:true,hasNext:true});
    expect(advanceSimulation(segmented,segmented.stats.distance,1,-0).ended).toBe(false);
  });
  it('requires reanchoring across disconnected segments even at equal progress',()=>{
    const g=new Guidance();g.reset(segmented.segments[1][0].distance,0);
    const result=g.update(segmented,fix(1,1,1000),1000);expect(result.reason).toBe('reanchor');expect(result.alert).toBe(false);
  });
  it('rejects NaN timestamps instead of poisoning the alert timer',()=>{
    const g=new Guidance();expect(g.update(segmented,fix(0,0,NaN),1000).state).toBe('uncertain');
    expect(g.update(segmented,fix(0,0,1000),1000).state).toBe('on-route');
  });
  it('migrates the existing token and preserves source preferences',()=>{
    const entries=new Map([['ion-token','test-only-token']]);const store={getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>{entries.set(k,v);}};
    expect(loadMapSettings(store).basemap).toBe('ion');
    const settings={token:'test-only-token',tiandituKey:'test-only-key',basemap:'tianditu-img' as const,labels:false};
    saveMapSettings(store,settings);expect(loadMapSettings(store)).toMatchObject(settings);
  });
  it('requires the correct service credential and valid asset IDs',()=>{
    const config={token:'token',tiandituKey:'',basemap:'tianditu-img' as const,labels:true};
    expect(validateMapSettings(config)).toContain('天地图');
    expect(validateMapSettings({...config,tiandituKey:'key'})).toBeUndefined();
    expect(validateMapSettings({...config,tiandituKey:'key',imageryAsset:NaN})).toContain('正整数');
  });
  it('pairs imagery and road tiles with their own labels and encodes keys',()=>{
    expect(tiandituLayers('tianditu-img',true)).toEqual(['img','cia']);
    expect(tiandituLayers('tianditu-vec',true)).toEqual(['vec','cva']);
    expect(tiandituLayers('tianditu-img',false)).toEqual(['img']);
    expect(tiandituWmtsUrl('img','a&b')).toContain('tk=a%26b');
    expect(()=>tiandituWmtsUrl('bad','key')).toThrow();
  });
});

import { toGcj, fromGcj } from '../src/core/coordinates';
describe('AMap display boundary',()=>{
 it('converts a mainland reference point without mutating source GPX coordinates',()=>{
  const p={lon:116.39747,lat:39.908823};const q=toGcj(p);
  expect(q[0]).toBeCloseTo(116.40371358,5);expect(q[1]).toBeCloseTo(39.91022649,5);
  expect(p).toEqual({lon:116.39747,lat:39.908823});
 });
 it('maps clicks back to WGS84 and leaves an overseas point unchanged',()=>{
  const p={lon:114.06,lat:22.55},q=toGcj(p),r=fromGcj(...q);
  expect(r.lon).toBeCloseTo(p.lon,7);expect(r.lat).toBeCloseTo(p.lat,7);
  expect(toGcj({lon:-74,lat:40.7})).toEqual([-74,40.7]);
 });
 it('requires the AMap credential pair and keeps independent provider settings',()=>{
  const config={token:'ion-test',tiandituKey:'tdt-test',labels:true,basemap:'amap' as const};
  expect(validateMapSettings({...config,amapKey:'amap-test'})).toContain('安全密钥');
  const entries=new Map<string,string>(),store={getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>{entries.set(k,v);}};
  saveMapSettings(store,{...config,amapKey:'amap-test',amapSecurity:'security-test',buildings:false});
  expect(loadMapSettings(store)).toMatchObject({...config,amapKey:'amap-test',amapSecurity:'security-test',buildings:false});
 });
});
