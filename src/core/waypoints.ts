/**
 * U-03: 航点信息增强。
 * 把航点锚定到路线里程上（取最近轨迹点），供海拔剖面标记与点击详情使用。
 * 纯函数、无副作用。
 */
import type { Track, Waypoint } from './types';
import { distance } from './geo';

export interface AnchoredWaypoint extends Waypoint {
  /** 航点在路线上的里程（米），取最近轨迹点的累计距离 */
  routeDistance: number;
  /** 所在分段索引 */
  segment: number;
}

/**
 * 把航点按最近轨迹点锚定到路线里程。
 * 航点可能不在轨迹线上（如手工标注的补给点），这里只取最近点的里程作近似。
 */
export function anchorWaypoints(track: Track): AnchoredWaypoint[] {
  const out: AnchoredWaypoint[] = [];
  const hasPoints = track.segments.some(s => s.length > 0);
  for (const wp of track.waypoints) {
    if (!hasPoints) { out.push({ ...wp, routeDistance: 0, segment: 0 }); continue; }
    let best: { d: number; distance: number; segment: number } | undefined;
    for (const seg of track.segments) {
      for (const p of seg) {
        const d = distance(wp, p);
        if (!best || d < best.d) best = { d, distance: p.distance, segment: p.segment };
      }
    }
    if (best) out.push({ ...wp, routeDistance: best.distance, segment: best.segment });
  }
  return out.sort((a, b) => a.routeDistance - b.routeDistance);
}