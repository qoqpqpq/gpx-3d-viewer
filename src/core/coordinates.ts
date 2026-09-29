import type { GeoPoint } from './types';
// Display-only WGS84 -> GCJ-02 approximation. Never write back to GPX or use for distance/guidance.
export function toGcj(p:GeoPoint):[number,number]{
 const {lon,lat}=p;
 if(lon<72.004||lon>137.8347||lat<.8293||lat>55.8271)return [lon,lat];
 const x=lon-105,y=lat-35,pi=Math.PI;
 let dy=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));
 dy+=(20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3;
 dy+=(20*Math.sin(y*pi)+40*Math.sin(y*pi/3))*2/3;
 dy+=(160*Math.sin(y*pi/12)+320*Math.sin(y*pi/30))*2/3;
 let dx=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));
 dx+=(20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3;
 dx+=(20*Math.sin(x*pi)+40*Math.sin(x*pi/3))*2/3;
 dx+=(150*Math.sin(x*pi/12)+300*Math.sin(x*pi/30))*2/3;
 const r=lat*pi/180,magic=1-.00669342162296594323*Math.sin(r)**2,root=Math.sqrt(magic);
 return [lon+dx*180/(6378245/root*Math.cos(r)*pi),lat+dy*180/(6378245*(1-.00669342162296594323)/(magic*root)*pi)];
}
export function fromGcj(lon:number,lat:number):GeoPoint{
 let p={lon,lat};for(let i=0;i<5;i++){const q=toGcj(p);p={lon:p.lon+lon-q[0],lat:p.lat+lat-q[1]};}return p;
}
