/**
 * R-106: 行进轨迹记录器
 * 记录浏览器定位点，生成 GPX 格式轨迹数据。
 */

import type { LocationFix } from './types';
import { distance } from './geo';

export interface RecordedPoint {
  lat: number;
  lon: number;
  ele?: number;
  time: number; // epoch ms
  accuracy: number;
  source: LocationFix['source'];
}

export interface RecordingStats {
  distance: number;
  duration: number;
  count: number;
  ascent: number | null;
  descent: number | null;
  min: number | null;
  max: number | null;
  elevationCount: number;
}

export class TrackRecorder {
  private points: RecordedPoint[] = [];
  private startTime: number | undefined;
  private lastTime: number | undefined;
  private minEle: number | undefined;
  private maxEle: number | undefined;
  private eleAnchor: number | undefined;
  private totalAscent = 0;
  private totalDescent = 0;
  private elevationCount = 0;
  private recording = false;

  get isRecording(): boolean {
    return this.recording;
  }

  get pointCount(): number {
    return this.points.length;
  }

  get recordedPoints(): readonly RecordedPoint[] {
    return this.points;
  }

  start(): void {
    this.reset();
    this.recording = true;
  }

  stop(): RecordedPoint[] {
    this.recording = false;
    return [...this.points];
  }

  reset(): void {
    this.points = [];
    this.startTime = undefined;
    this.lastTime = undefined;
    this.minEle = undefined;
    this.maxEle = undefined;
    this.eleAnchor = undefined;
    this.totalAscent = 0;
    this.totalDescent = 0;
    this.elevationCount = 0;
    this.recording = false;
  }

  addFix(fix: LocationFix): RecordedPoint | undefined {
    if (!this.isRecording) return undefined;
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return undefined;
    if (Math.abs(fix.lat) > 90 || Math.abs(fix.lon) > 180) return undefined;

    const p: RecordedPoint = {
      lat: fix.lat,
      lon: fix.lon,
      time: fix.timestamp,
      accuracy: fix.accuracy,
      source: fix.source,
    };
    this.startTime ??= fix.timestamp;

    // Elevation from the fix (if any)
    if (Number.isFinite(fix.ele ?? NaN)) {
      p.ele = fix.ele!;
      this.elevationCount++;
      this.minEle = this.minEle === undefined ? p.ele : Math.min(this.minEle, p.ele);
      this.maxEle = this.maxEle === undefined ? p.ele : Math.max(this.maxEle, p.ele);
      if (this.eleAnchor === undefined) this.eleAnchor = p.ele;
      const delta = p.ele - this.eleAnchor;
      if (Math.abs(delta) >= 3) {
        if (delta > 0) this.totalAscent += delta;
        else this.totalDescent -= delta;
        this.eleAnchor = p.ele;
      }
    }

    this.points.push(p);
    this.lastTime = fix.timestamp;
    return p;
  }

  getStats(): RecordingStats {
    let dist = 0;
    for (let i = 1; i < this.points.length; i++) {
      dist += distance(this.points[i - 1], this.points[i]);
    }
    const hasElev = this.elevationCount === this.points.length && this.points.length > 0;
    return {
      distance: dist,
      duration: this.lastTime !== undefined && this.startTime !== undefined ? Math.max(0, this.lastTime - this.startTime) : 0,
      count: this.points.length,
      ascent: hasElev ? this.totalAscent : null,
      descent: hasElev ? this.totalDescent : null,
      min: this.minEle ?? null,
      max: this.maxEle ?? null,
      elevationCount: this.elevationCount,
    };
  }
}
