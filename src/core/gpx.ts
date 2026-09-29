import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { distance } from './geo';
import type { GeoPoint, Track, TrackPoint, Waypoint } from './types';

export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_POINTS = 200000;
type Node = Record<string, any>;
const arr = (value: any): Node[] => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const str = (v: any): string => typeof v === 'string' || typeof v === 'number' ? String(v).trim() : typeof v?.['#text'] === 'string' ? v['#text'].trim() : '';
const num = (v: any): number | undefined => str(v) !== '' && Number.isFinite(Number(str(v))) ? Number(str(v)) : undefined;

export function parseGpx(xml: string, filename = '路线.gpx'): Track[] {
  if (new TextEncoder().encode(xml).length > MAX_BYTES) throw new Error('文件超过 20 MB，请先分轨导出。');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('不支持包含 DTD 或自定义实体的 XML。');
  let depth = 0;
  for (const match of xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, '').matchAll(/<\/?[a-zA-Z_][^>]*>/g)) {
    if (match[0].startsWith('</')) depth--; else if (!match[0].endsWith('/>')) depth++;
    if (depth > 64) throw new Error('XML 层级过深，请检查文件。');
  }
  if (XMLValidator.validate(xml) !== true) throw new Error('GPX 文件不完整或 XML 格式有误。');
  const root = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, processEntities: true }).parse(xml).gpx;
  if (!root || typeof root !== 'object') throw new Error('没有找到 GPX 根节点，请选择 .gpx 文件。');
  let count = 0;
  const readPoint = (n: Node): GeoPoint | null => {
    if (++count > MAX_POINTS) throw new Error('轨迹超过 200,000 点，请先分轨导出。');
    const lat = num(n?.['@_lat']), lon = num(n?.['@_lon']);
    if (lat === undefined || lon === undefined || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    const timeText = str(n.time), parsedTime = timeText ? Date.parse(timeText) : NaN;
    return { lat, lon, ele: num(n.ele), time: Number.isFinite(parsedTime) ? parsedTime : undefined };
  };
  const waypoints: Waypoint[] = [];
  for (const n of arr(root.wpt)) { const p = readPoint(n); if (p) waypoints.push({ ...p, name: str(n.name).slice(0, 200) || '未命名航点' }); }
  const candidates = [
    ...arr(root.trk).map(n => ({ name: str(n.name), kind: 'track' as const, pieces: arr(n.trkseg).map(s => arr(s.trkpt)) })),
    ...arr(root.rte).map(n => ({ name: str(n.name), kind: 'route' as const, pieces: [arr(n.rtept)] })),
  ];
  const tracks: Track[] = [];
  if (candidates.length > 128) throw new Error('单个文件最多支持 128 条轨道，请拆分后导入。');
  for (const [ti, candidate] of candidates.entries()) {
    const rawSegments: GeoPoint[][] = [];
    let invalid = 0, duplicates = 0;
    for (const nodes of candidate.pieces) {
      let part: GeoPoint[] = [];
      for (const n of nodes) {
        const p = readPoint(n);
        if (!p) { invalid++; if (part.length) rawSegments.push(part); part = []; continue; }
        const previous = part.at(-1);
        if (previous && previous.lat === p.lat && previous.lon === p.lon) duplicates++;
        part.push(p);
      }
      if (part.length) rawSegments.push(part);
    }
    if (rawSegments.flat().length < 2) continue;
    if (rawSegments.length > 1000) throw new Error('轨迹分段超过 1,000 个，请先整理或拆分文件。');
    let meters = 0, index = 0, ascent = 0, descent = 0, elevationCount = 0, duration = 0, validTime = true;
    let min = Infinity, max = -Infinity, jumpCount = 0;
    const segments = rawSegments.map((seg, si): TrackPoint[] => {
      let elevationAnchor: number | undefined;
      return seg.map((p, i) => {
        if (i) {
          const gap = distance(seg[i - 1], p);
          meters += gap;
          if (gap > 2000) jumpCount++;
          if (p.time === undefined || seg[i - 1].time === undefined || p.time < seg[i - 1].time!) validTime = false;
          else duration += p.time - seg[i - 1].time!;
        }
        if (p.time === undefined) validTime = false;
        if (p.ele !== undefined) {
          elevationCount++; min = Math.min(min, p.ele); max = Math.max(max, p.ele);
          if (elevationAnchor === undefined) elevationAnchor = p.ele;
          const delta = p.ele - elevationAnchor;
          if (Math.abs(delta) >= 3) { if (delta > 0) ascent += delta; else descent -= delta; elevationAnchor = p.ele; }
        } else elevationAnchor = undefined;
        return { ...p, distance: meters, index: index++, segment: si };
      });
    });
    const warnings: string[] = [];
    if (segments.length > 1) warnings.push(`${segments.length} 个独立分段，断口不连线、不计距离`);
    if (elevationCount < index) warnings.push(`${index - elevationCount} 个点缺少高程；累计升降不完整`);
    if (!validTime) warnings.push('时间缺失或逆序，不计算实际历时');
    if (invalid) warnings.push(`${invalid} 个无效坐标已排除，并在该处断段`);
    if (duplicates) warnings.push(`${duplicates} 个重复坐标保留原始时间与高程`);
    if (jumpCount) warnings.push(`${jumpCount} 处相邻点间隔超过 2 km，请核对轨迹`);
    if (candidate.kind === 'route') warnings.push('这是路线控制点，连接线不代表真实可通行路径');
    tracks.push({ schemaVersion: 1, id: `pending-${ti}`, name: candidate.name.slice(0, 200) || `${filename.replace(/\.gpx$/i, '')}${candidates.length > 1 ? ` · ${ti + 1}` : ''}`, filename, importedAt: Date.now(), kind: candidate.kind, segments, waypoints,
      stats: { distance: meters, ascent: elevationCount === index ? ascent : null, descent: elevationCount === index ? descent : null, min: elevationCount ? min : null, max: elevationCount ? max : null, duration: validTime ? duration : null, count: index, elevationCount }, warnings });
  }
  if (!tracks.length) throw new Error('未找到至少含两个有效点的轨迹或路线；仅有航点的 GPX 暂不支持。');
  return tracks;
}
