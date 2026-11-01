import { describe, expect, it } from 'vitest';
import { parseGpx } from '../src/core/gpx';
import { simplifyLine } from '../src/core/geo';
import type { Track, TrackPoint } from '../src/core/types';

function buildGpx(points: number): string {
  const chunks: string[] = [];
  for (let i = 0; i < points; i++) {
    const lat = 40 + Math.sin(i / 800) * 0.05;
    const lon = 116 + (i * 0.00012) % 0.35;
    const ele = 150 + Math.sin(i / 220) * 45;
    chunks.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><ele>${ele.toFixed(1)}</ele><time>2026-01-01T00:00:00.000Z</time></trkpt>`);
    if (i % 8192 === 0) {
      chunks.push('');
    }
  }
  return `<gpx version="1.1" creator="山径 Ridgeline benchmark"><trk><name>desktop-benchmark-${points}</name><trkseg>${chunks.join('')}</trkseg></trk></gpx>`;
}

function heapUsedMB(): number {
  // If the worker was started with --expose-gc, force a GC for a stable reading.
  const g = (globalThis as { gc?: () => void }).gc;
  if (g) { for (let i = 0; i < 3; i++) g(); }
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

function prepareGeometry(track: Track): TrackPoint[][] {
  // Mirror RouteMap.setTrack(): simplify each segment then map to local XY.
  return track.segments.map(s => simplifyLine(s, Math.max(10, Math.floor(10000 / track.segments.length))));
}

describe('T-09 desktop GPX benchmark', () => {
  it('records parse + 2D geometry-prep performance and memory for 10k/50k/200k points', () => {
    const rows: string[] = [];
    rows.push('');
    rows.push('| 点数 | XML 大小 | 解析耗时 | 解析后堆增长 | 几何精简耗时 | 精简后点数 | 距离 | 结论 |');
    rows.push('|---:|---:|---:|---:|---:|---:|---:|---|');
    for (const points of [10_000, 50_000, 200_000]) {
      const xml = buildGpx(points);
      const bytes = new TextEncoder().encode(xml).length;
      const before = heapUsedMB();
      const t0 = performance.now();
      const tracks = parseGpx(xml, 'desktop-benchmark.gpx');
      const parseMs = performance.now() - t0;
      const afterParse = heapUsedMB();
      const track = tracks[0];
      expect(track).toBeDefined();
      expect(track.stats.count).toBe(points);
      expect(track.stats.distance).toBeGreaterThan(0);

      const t1 = performance.now();
      const geom = prepareGeometry(track);
      const geomMs = performance.now() - t1;
      const geomCount = geom.reduce((s, g) => s + g.length, 0);

      rows.push(`| ${points.toLocaleString()} | ${(bytes / 1024 / 1024).toFixed(2)} MB | ${parseMs.toFixed(1)} ms | ${(afterParse - before).toFixed(1)} MB | ${geomMs.toFixed(1)} ms | ${geomCount.toLocaleString()} | ${(track.stats.distance / 1000).toFixed(1)} km | 通过 |`);
    }
    console.log(rows.join('\n'));
  }, 120_000);
});
