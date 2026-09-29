import GeographicLib from 'geographiclib-geodesic';
import type { GeoPoint, Track, TrackPoint } from './types';

export const radians = (v: number) => v * Math.PI / 180;
export const wrapLon = (v: number) => ((v + 180) % 360 + 360) % 360 - 180;
export function distance(a: GeoPoint, b: GeoPoint): number {
  return GeographicLib.Geodesic.WGS84.Inverse(a.lat, a.lon, b.lat, b.lon).s12!;
}
export function localXY(p: GeoPoint, origin: GeoPoint): [number, number] {
  return [radians(wrapLon(p.lon - origin.lon)) * 6371008.8 * Math.cos(radians(origin.lat)), radians(p.lat - origin.lat) * 6371008.8];
}
export function pointAt(track: Track, meter: number, preferredSegment?: number): TrackPoint {
  const preferred=preferredSegment===undefined?undefined:track.segments[preferredSegment];
  const segments = preferred&&meter>=preferred[0].distance&&meter<=preferred.at(-1)!.distance?[preferred]:track.segments;
  const last = segments.at(-1)!.at(-1)!;
  if (meter >= last.distance) return last;
  for (const seg of segments) {
    if (meter > seg.at(-1)!.distance) continue;
    let lo = 0, hi = seg.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (seg[m].distance < meter) lo = m + 1; else hi = m; }
    const b = seg[lo], a = seg[Math.max(0, lo - 1)];
    const t = b.distance === a.distance ? 0 : Math.max(0, Math.min(1, (meter - a.distance) / (b.distance - a.distance)));
    return { ...a, lon: wrapLon(a.lon + wrapLon(b.lon - a.lon) * t), lat: a.lat + (b.lat - a.lat) * t, ele: a.ele !== undefined && b.ele !== undefined ? a.ele + (b.ele - a.ele) * t : undefined, distance: Math.max(a.distance, meter) };
  }
  return last;
}
export function thin(points: TrackPoint[], max = 1600): TrackPoint[] {
  if (points.length <= max) return points;
  // Preserve first/last and each bucket's elevation extrema. Never used for statistics.
  const result = [points[0]], size = Math.ceil(points.length / (max / 2));
  for (let i = 1; i < points.length - 1; i += size) {
    const bucket = points.slice(i, Math.min(i + size, points.length - 1));
    let low = bucket[0], high = bucket[0];
    for (const p of bucket) { if ((p.ele ?? Infinity) < (low.ele ?? Infinity)) low = p; if ((p.ele ?? -Infinity) > (high.ele ?? -Infinity)) high = p; }
    if (low.index < high.index) result.push(low, high); else if (low !== high) result.push(high, low); else result.push(low);
  }
  result.push(points.at(-1)!);
  return result;
}

/** Iterative Douglas–Peucker in local metres, including elevation changes.
 * Render geometry only; raw points remain the source for stats and matching. */
export function simplifyLine(points: TrackPoint[], max = 2200): TrackPoint[] {
  if (points.length <= max) return points;
  const origin=points[0], xyz=points.map(p=>{const [x,y]=localXY(p,origin);return [x,y,p.ele??0];});
  const run=(tolerance:number)=>{
    const keep=new Uint8Array(points.length);keep[0]=1;keep[points.length-1]=1;
    const stack=[0,points.length-1],limit=tolerance*tolerance;
    while(stack.length){
      const end=stack.pop()!,start=stack.pop()!,a=xyz[start],b=xyz[end],v=b.map((n,k)=>n-a[k]),den=v.reduce((s,n)=>s+n*n,0);
      let largest=limit,index=-1;
      for(let i=start+1;i<end;i++){
        const q=xyz[i],t=den?Math.max(0,Math.min(1,v.reduce((s,n,k)=>s+(q[k]-a[k])*n,0)/den)):0;
        const square=q.reduce((s,n,k)=>s+(n-a[k]-t*v[k])**2,0);
        if(square>largest){largest=square;index=i;}
      }
      if(index>=0){keep[index]=1;stack.push(start,index,index,end);}
    }
    return points.filter((_,i)=>keep[i]);
  };
  let tolerance=2, result=run(tolerance);
  while(result.length>max&&tolerance<65536){tolerance*=2;result=run(tolerance);}
  return result;
}
