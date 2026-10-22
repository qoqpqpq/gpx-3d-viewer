/**
 * GPX XML 导出：将原始记录点转换为标准 GPX 1.1 字符串。
 */

export interface RawPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: number; // epoch ms
  accuracy?: number;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function ts(time?: number): string {
  if (time === undefined || !Number.isFinite(time)) return '';
  return `<time>${new Date(time).toISOString()}</time>`;
}

function ptElement(p: RawPoint): string {
  let attrs = `lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"`;
  let inner = '';
  if (p.ele !== undefined && Number.isFinite(p.ele)) {
    inner += `<ele>${p.ele.toFixed(1)}</ele>`;
  }
  const t = ts(p.time);
  if (t) inner += t;
  return `<trkpt ${attrs}>${inner}</trkpt>`;
}

export function exportGpx(points: readonly RawPoint[], name: string): string {
  if (points.length === 0) return '';
  const pts = points.map(ptElement).join('');
  const safeName = esc(name || '记录轨迹');
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="山径 Ridgeline" xmlns="http://www.topografix.com/GPX/1/1">\n<trk>\n<name>${safeName}</name>\n<trkseg>\n${pts}\n</trkseg>\n</trk>\n</gpx>\n`;
}
