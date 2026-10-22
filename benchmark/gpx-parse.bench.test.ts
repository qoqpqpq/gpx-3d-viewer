import { describe, expect, it } from 'vitest';
import { parseGpx } from '../src/core/gpx';

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

describe('T-09 desktop GPX parse benchmark', () => {
  it('records parsing performance for 10k/50k/200k points in the current environment', () => {
    const rows: string[] = [];
    rows.push('');
    rows.push('| 点数 | XML 大小 | 解析耗时 | 内存增长 | 输出点数 | 距离 | 结论 |');
    rows.push('|---:|---:|---:|---:|---:|---:|---|');
    for (const points of [10_000, 50_000, 200_000]) {
      const xml = buildGpx(points);
      const bytes = new TextEncoder().encode(xml).length;
      const t0 = performance.now();
      const tracks = parseGpx(xml, 'desktop-benchmark.gpx');
      const elapsed = performance.now() - t0;
      const track = tracks[0];
      expect(track).toBeDefined();
      expect(track.stats.count).toBe(points);
      expect(track.stats.distance).toBeGreaterThan(0);
      rows.push(`| ${points.toLocaleString()} | ${(bytes / 1024 / 1024).toFixed(2)} MB | ${elapsed.toFixed(1)} ms | 未启用 \`--expose-gc\` | ${track.stats.count.toLocaleString()} | ${(track.stats.distance / 1000).toFixed(1)} km | 通过 |`);
    }
    console.log(rows.join('\n'));
  }, 60_000);
});
