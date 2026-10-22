import { describe, it, expect } from 'vitest';
import { TrackRecorder } from '../src/core/track-recorder';
import { exportGpx } from '../src/core/gpx-export';
import type { LocationFix } from '../src/core/types';

const fix = (lat: number, lon: number, opts?: Partial<LocationFix>): LocationFix => ({
  lat, lon, timestamp: Date.now(), accuracy: 5, crs: 'WGS84', source: 'browser',
  ...opts,
  ...(opts?.time !== undefined ? { timestamp: opts.time } : {}),
});

describe('TrackRecorder', () => {
  it('starts recording and adds valid points', () => {
    const r = new TrackRecorder();
    r.start();
    expect(r.isRecording).toBe(true);
    const p = r.addFix(fix(40.0, 116.0));
    expect(p).toBeDefined();
    expect(r.pointCount).toBe(1);
  });

  it('rejects points when not recording', () => {
    const r = new TrackRecorder();
    expect(r.addFix(fix(40.0, 116.0))).toBeUndefined();
    expect(r.pointCount).toBe(0);
  });

  it('rejects invalid coordinates', () => {
    const r = new TrackRecorder();
    r.start();
    expect(r.addFix(fix(91, 0))).toBeUndefined();
    expect(r.addFix(fix(0, 181))).toBeUndefined();
    expect(r.addFix(fix(NaN, 0))).toBeUndefined();
    expect(r.pointCount).toBe(0);
  });

  it('tracks distance across multiple points', () => {
    const r = new TrackRecorder();
    r.start();
    r.addFix(fix(40.0, 116.0, { time: 1000 }));
    r.addFix(fix(40.001, 116.001, { time: 2000 }));
    r.addFix(fix(40.002, 116.002, { time: 3000 }));
    const stats = r.getStats();
    expect(stats.distance).toBeGreaterThan(100);
    expect(stats.count).toBe(3);
  });

  it('tracks duration from first to last fix', () => {
    const r = new TrackRecorder();
    r.start();
    r.addFix(fix(40.0, 116.0, { time: 1000 }));
    r.addFix(fix(40.001, 116.001, { time: 61000 }));
    const stats = r.getStats();
    expect(stats.duration).toBe(60000);
  });

  it('computes elevation stats with 3m hysteresis', () => {
    const r = new TrackRecorder();
    r.start();
    r.addFix(fix(40.0, 116.0, { ele: 100, time: 1000 }));
    r.addFix(fix(40.001, 116.001, { ele: 105, time: 2000 }));
    r.addFix(fix(40.002, 116.002, { ele: 95, time: 3000 }));
    const stats = r.getStats();
    expect(stats.min).toBe(95);
    expect(stats.max).toBe(105);
    expect(stats.elevationCount).toBe(3);
    expect(stats.ascent).toBe(5);
    expect(stats.descent).toBe(10);
  });

  it('returns null ascent/descent when elevation is incomplete', () => {
    const r = new TrackRecorder();
    r.start();
    r.addFix(fix(40.0, 116.0, { ele: 100, time: 1000 }));
    r.addFix(fix(40.001, 116.001, { time: 2000 })); // missing ele
    const stats = r.getStats();
    expect(stats.ascent).toBeNull();
    expect(stats.descent).toBeNull();
    expect(stats.elevationCount).toBe(1);
  });

  it('stops recording and preserves points', () => {
    const r = new TrackRecorder();
    r.start();
    r.addFix(fix(40.0, 116.0));
    r.addFix(fix(40.001, 116.001));
    const points = r.stop();
    expect(r.isRecording).toBe(false);
    expect(points).toHaveLength(2);
    // Cannot add after stop
    expect(r.addFix(fix(40.002, 116.002))).toBeUndefined();
  });

  it('reset clears all state', () => {
    const r = new TrackRecorder();
    r.start();
    r.addFix(fix(40.0, 116.0, { ele: 100 }));
    r.reset();
    expect(r.pointCount).toBe(0);
    expect(r.isRecording).toBe(false);
    const stats = r.getStats();
    expect(stats.distance).toBe(0);
    expect(stats.count).toBe(0);
    expect(stats.min).toBeNull();
    expect(stats.max).toBeNull();
  });

  it('handles zero-duration single point gracefully', () => {
    const r = new TrackRecorder();
    r.start();
    r.addFix(fix(40.0, 116.0, { time: 1000 }));
    const stats = r.getStats();
    expect(stats.distance).toBe(0);
    expect(stats.duration).toBe(0);
    expect(stats.count).toBe(1);
  });
});

describe('exportGpx', () => {
  it('exports a valid GPX file for recorded points', () => {
    const points = [
      { lat: 40.0, lon: 116.0, ele: 50, time: 1700000000000, accuracy: 5 },
      { lat: 40.001, lon: 116.001, ele: 55, time: 1700000060000, accuracy: 5 },
    ];
    const xml = exportGpx(points, 'Test Track');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<gpx version="1.1"');
    expect(xml).toContain('<trk>');
    expect(xml).toContain('<trkseg>');
    expect(xml).toContain('lat="40.0000000" lon="116.0000000"');
    expect(xml).toContain('lat="40.0010000" lon="116.0010000"');
    expect(xml).toContain('<ele>50.0</ele>');
    expect(xml).toContain('<ele>55.0</ele>');
    expect(xml).toContain('<name>Test Track</name>');
  });

  it('handles missing elevation', () => {
    const xml = exportGpx([{ lat: 40.0, lon: 116.0, time: 1000 }], 'NoElev');
    expect(xml).not.toContain('<ele>');
    expect(xml).toContain('<time>');
  });

  it('returns empty string for empty array', () => {
    expect(exportGpx([], 'Empty')).toBe('');
  });

  it('escapes XML special characters in name', () => {
    const xml = exportGpx(
      [{ lat: 40.0, lon: 116.0, time: 1000 }],
      'A & B <Test> "Track"',
    );
    expect(xml).toContain('A &amp; B &lt;Test&gt; &quot;Track&quot;');
    expect(xml).not.toContain('A & B');
  });

  it('formats coordinates to 7 decimal places', () => {
    const xml = exportGpx(
      [{ lat: 40.12345678, lon: 116.12345678, time: 1000 }],
      'Precise',
    );
    expect(xml).toContain('40.1234568');
    expect(xml).toContain('116.1234568');
  });

  it('includes ISO 8601 timestamps', () => {
    const xml = exportGpx(
      [{ lat: 40.0, lon: 116.0, time: Date.UTC(2026, 0, 1, 12, 0, 0) }],
      'Time',
    );
    expect(xml).toContain('2026-01-01T12:00:00.000Z');
  });
});
