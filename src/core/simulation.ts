import type { Track } from './types';
export function advanceSimulation(track:Track,meter:number,segment:number,delta:number){
  const points=track.segments[segment];
  if(!points)throw new Error('无效分段');
  const start=points[0].distance,end=points.at(-1)!.distance;
  const next=Math.max(start,Math.min(end,meter+delta));
  return {meter:next,ended:delta===0?false:delta<0?next<=start:next>=end,hasNext:delta<0?segment>0:segment<track.segments.length-1};
}
