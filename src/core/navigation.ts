import { localXY } from './geo';
import type { LocationFix, Track, TrackPoint } from './types';

export interface Match { distance: number; progress: number; segment: number; point: TrackPoint; requiresReanchor?: boolean }
export function matchRoute(track: Track, fix: LocationFix, previous?: number, window = 400, activeSegment?:number): Match {
  let nearest: Match | undefined, global: Match | undefined;
  for (const segment of track.segments) {
    for (let i = 0; i < segment.length; i++) {
      const a = segment[Math.max(0, i - 1)], b = segment[i];
      const [ax, ay] = localXY(a, fix), [bx, by] = localXY(b, fix);
      const dx = bx - ax, dy = by - ay;
      const t = dx * dx + dy * dy === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
      const d = Math.hypot(ax + t * dx, ay + t * dy), progress = a.distance + (b.distance - a.distance) * t;
      const candidate = { distance: d, progress, segment: a.segment, point: t < 0.5 ? a : b };
      if (!global || d < global.distance) global = candidate;
      if ((activeSegment===undefined||a.segment===activeSegment)&&(previous === undefined || Math.abs(progress - previous) <= window) && (!nearest || d < nearest.distance)) nearest = candidate;
    }
  }
  // A fix far ahead is not evidence of traversing the missing distance. Report
  // its true nearest-line distance but ask for a new anchor instead of jumping.
  if (global && ((previous!==undefined&&Math.abs(global.progress-previous)>window)||(activeSegment!==undefined&&global.segment!==activeSegment)) && (!nearest || nearest.distance > global.distance + 100)) return { ...global, requiresReanchor: true };
  // Once anchored, do not silently jump to another branch at a crossing.
  return nearest ?? global!;
}
export type GuidanceState = 'on-route' | 'pending' | 'off-route' | 'uncertain';
export class Guidance {
  state: GuidanceState = 'uncertain';
  progress: number | undefined;
  private outsideAt: number | undefined;
  private insideAt: number | undefined;
  private lastTimestamp = 0;
  private off = false;
  private segment:number|undefined;
  reset(progress?: number,segment?:number) { this.progress = progress; this.segment=segment; this.outsideAt = undefined; this.insideAt = undefined; this.lastTimestamp = 0; this.off = false; this.state = 'uncertain'; }
  update(track: Track, fix: LocationFix, now = Date.now()): { state: GuidanceState; match?: Match; alert: boolean; reason?: 'reanchor' } {
    if (fix.crs !== 'WGS84' || !Number.isFinite(fix.timestamp) || !Number.isFinite(now) || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 35 || now - fix.timestamp > 10000 || fix.timestamp > now + 1000 || fix.timestamp <= this.lastTimestamp || Math.abs(fix.lat) > 90 || Math.abs(fix.lon) > 180 || !Number.isFinite(fix.lat + fix.lon)) {
      this.outsideAt = undefined; this.insideAt = undefined; this.state = 'uncertain'; return { state: this.state, alert: false };
    }
    if (this.lastTimestamp && fix.timestamp - this.lastTimestamp > 5000) { this.outsideAt = undefined; this.insideAt = undefined; }
    this.lastTimestamp = fix.timestamp;
    const match = matchRoute(track, fix, this.progress,400,this.segment);
    if (match.requiresReanchor) { this.outsideAt = undefined; this.insideAt = undefined; this.state = 'uncertain'; return { state: this.state, match, alert: false, reason: 'reanchor' }; }
    // Keep a nearby projection moving during a lateral deviation; otherwise a
    // frozen continuity window eventually measures distance to an old section.
    if (match.distance < 200) this.progress = match.progress;
    const enterThreshold = Math.max(40, fix.accuracy * 2);
    let alert = false;
    if (match.distance > enterThreshold) {
      this.insideAt = undefined;
      this.outsideAt ??= fix.timestamp;
      if (!this.off && fix.timestamp - this.outsideAt >= 5000) { this.off = true; alert = true; }
      this.state = this.off ? 'off-route' : 'pending';
    } else if (match.distance < 20) {
      this.outsideAt = undefined; this.insideAt ??= fix.timestamp;
      if (this.off && fix.timestamp - this.insideAt >= 3000) this.off = false;
      this.state = this.off ? 'off-route' : 'on-route';
      if (!this.off) this.progress = match.progress;
    } else { this.outsideAt = undefined; this.insideAt = undefined; this.state = this.off ? 'off-route' : 'on-route'; }
    return { state: this.state, match, alert };
  }
}
