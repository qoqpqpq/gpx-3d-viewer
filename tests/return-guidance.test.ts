import { describe, it, expect } from 'vitest';
import { returnGuidance } from '../src/core/navigation';
import type { LocationFix, TrackPoint } from '../src/core/types';

const fix = (lat: number, lon: number): LocationFix => ({ lat, lon, timestamp: 1000, accuracy: 5, crs: 'WGS84', source: 'simulation' });
const rtp = (lat: number, lon: number): TrackPoint => ({ lat, lon, distance: 0, index: 0, segment: 0 });

describe('returnGuidance', () => {
  it('定位点在路网点正南 → 方位正北、距离=纬差', () => {
    // 每纬度 ≈ 111.32km，取 0.01° ≈ 1113m
    const g = returnGuidance(fix(39.9, 116.4), rtp(39.91, 116.4));
    expect(g.cardinal).toBe('正北');
    expect(g.bearing).toBeCloseTo(0, 0);
    expect(g.distance).toBeGreaterThan(1000);
    expect(g.lateral).toBe('ahead');
  });

  it('定位点在路网点正东 → 方位正西', () => {
    // 在北纬 40°，0.01° 经度 ≈ 852m
    const g = returnGuidance(fix(40.0, 116.41), rtp(40.0, 116.4));
    expect(g.cardinal).toBe('正西');
    expect(g.bearing).toBeCloseTo(270, 0);
  });

  it('定位点在路网点东北 → 方位西南', () => {
    const g = returnGuidance(fix(40.005, 116.005), rtp(40.0, 116.0));
    expect(g.cardinal).toBe('西南');
    expect(g.bearing).toBeGreaterThan(180);
    expect(g.bearing).toBeLessThan(270);
  });

  it('距离随偏离增大而增大', () => {
    const near = returnGuidance(fix(39.9, 116.4), rtp(39.9005, 116.4));
    const far = returnGuidance(fix(39.9, 116.4), rtp(39.905, 116.4));
    expect(far.distance).toBeGreaterThan(near.distance);
  });

  it('重合点距离≈0，方位角收敛为 0（正北）', () => {
    const g = returnGuidance(fix(39.9, 116.4), rtp(39.9, 116.4));
    expect(g.distance).toBeCloseTo(0, 3);
    expect(g.bearing).toBeCloseTo(0, 0);
    expect(g.cardinal).toBe('正北');
  });
});