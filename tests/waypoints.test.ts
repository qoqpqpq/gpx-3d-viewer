import { describe, it, expect } from 'vitest';
import { anchorWaypoints } from '../src/core/waypoints';
import type { Track, TrackPoint, Waypoint } from '../src/core/types';

const tp = (lat: number, lon: number, distance: number, segment = 0, index = 0): TrackPoint => ({ lat, lon, distance, segment, index });
const wp = (lat: number, lon: number, name: string): Waypoint => ({ lat, lon, name });

function makeTrack(segments: TrackPoint[][], waypoints: Waypoint[]): Track {
  return {
    schemaVersion: 1, id: 't', name: 't', filename: 't.gpx', importedAt: 0, kind: 'track',
    segments, waypoints, stats: { distance: 0, ascent: null, descent: null, min: null, max: null, duration: null, count: 0, elevationCount: 0 }, warnings: []
  };
}

describe('anchorWaypoints', () => {
  it('航点锚定到最近轨迹点的里程', () => {
    // 航点取最近轨迹点的累计里程；放在起点附近 → routeDistance 接近 0
    const track = makeTrack([[tp(0, 0, 0), tp(0.01, 0, 1113)]], [wp(0.001, 0, '近起点')]);
    const anchored = anchorWaypoints(track);
    expect(anchored).toHaveLength(1);
    expect(anchored[0].name).toBe('近起点');
    expect(anchored[0].routeDistance).toBeLessThan(200);
    expect(anchored[0].segment).toBe(0);
  });
  it('航点靠近轨迹末端 → 锚定到较大里程', () => {
    const track = makeTrack([[tp(0, 0, 0), tp(0.01, 0, 1113)]], [wp(0.009, 0, '近终点')]);
    const anchored = anchorWaypoints(track);
    expect(anchored[0].routeDistance).toBeGreaterThan(900);
  });

  it('多个航点按路线里程升序排列', () => {
    const track = makeTrack([[tp(0, 0, 0), tp(0, 0.02, 2226)]], [wp(0, 0.015, '后'), wp(0, 0.005, '前')]);
    const anchored = anchorWaypoints(track);
    expect(anchored[0].name).toBe('前');
    expect(anchored[1].name).toBe('后');
    expect(anchored[0].routeDistance).toBeLessThan(anchored[1].routeDistance);
  });

  it('跨分段航点记录正确分段索引', () => {
    const track = makeTrack([
      [tp(0, 0, 0, 0, 0), tp(0, 0.01, 1113, 0, 1)],
      [tp(0.01, 0.01, 1113, 1, 0), tp(0.02, 0.01, 2226, 1, 1)]
    ], [wp(0.015, 0.01, '第二段点')]);
    const anchored = anchorWaypoints(track);
    expect(anchored[0].segment).toBe(1);
  });

  it('无航点返回空数组', () => {
    expect(anchorWaypoints(makeTrack([[tp(0, 0, 0)]], []))).toEqual([]);
  });

  it('空轨迹不崩溃，航点里程为 0', () => {
    const anchored = anchorWaypoints(makeTrack([[]], [wp(0, 0, '孤立点')]));
    expect(anchored).toHaveLength(1);
    expect(anchored[0].routeDistance).toBe(0);
  });
});