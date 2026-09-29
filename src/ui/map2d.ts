import { localXY, simplifyLine } from '../core/geo';
import type { GeoPoint, Track, TrackPoint } from '../core/types';

export class RouteMap {
  private ctx: CanvasRenderingContext2D;
  private track?: Track;
  private lines: TrackPoint[][] = [];
  private width = 800; private height = 460;
  private scale = 1; private zoom = 1; private pan = { x: 0, y: 0 };
  private center = { x: 0, y: 0 }; private origin: GeoPoint = { lat: 0, lon: 0 };
  private selected?: GeoPoint; private live?: GeoPoint;
  private drag?: { x: number; y: number; px: number; py: number; moved: boolean };
  constructor(private canvas: HTMLCanvasElement, private onSelect: (meter: number) => void) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoomBy(e.deltaY > 0 ? 0.88 : 1.14); }, { passive: false });
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); this.drag = { x: e.offsetX, y: e.offsetY, px: this.pan.x, py: this.pan.y, moved: false }; });
    canvas.addEventListener('pointermove', e => { if (!this.drag) return; if (Math.hypot(e.offsetX - this.drag.x, e.offsetY - this.drag.y) > 4) this.drag.moved = true; this.pan = { x: this.drag.px + e.offsetX - this.drag.x, y: this.drag.py + e.offsetY - this.drag.y }; this.draw(); });
    canvas.addEventListener('pointerup', e => { if (this.drag && !this.drag.moved) this.pick(e.offsetX, e.offsetY); this.drag = undefined; });
    canvas.addEventListener('pointercancel', () => { this.drag = undefined; });
  }
  setTrack(track: Track) {
    this.track = track; this.lines = track.segments.map(s => simplifyLine(s, Math.max(10, Math.floor(10000/track.segments.length))));
    this.origin = track.segments[0][0];
    const xy = this.lines.flat().map(p => localXY(p, this.origin));
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const [x, y] of xy) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    this.center = { x: (minx + maxx) / 2, y: (miny + maxy) / 2 };
    this.bounds = { w: Math.max(maxx - minx, 100), h: Math.max(maxy - miny, 100) };
    this.selected = undefined; this.live = undefined; this.fit();
  }
  private bounds = { w: 1000, h: 1000 };
  fit() { this.zoom = 1; this.pan = { x: 0, y: 0 }; this.resize(); }
  zoomBy(multiplier: number) { this.zoom = Math.min(12, Math.max(0.4, this.zoom * multiplier)); this.draw(); }
  setSelected(point: GeoPoint) { this.selected = point; this.draw(); }
  setLive(point?: GeoPoint) { this.live = point; this.draw(); }
  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.width = rect.width; this.height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr); this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = Math.min((this.width - 160) / this.bounds.w, (this.height - 120) / this.bounds.h);
    this.draw();
  }
  private screen(p: GeoPoint): [number, number] { const [x,y] = localXY(p, this.origin); return [this.width/2 + (x-this.center.x)*this.scale*this.zoom + this.pan.x, this.height/2 - (y-this.center.y)*this.scale*this.zoom + this.pan.y]; }
  private pick(x: number, y: number) {
    let best = Infinity, meter = 0;
    for (const seg of this.lines) for (let i = 1; i < seg.length; i++) {
      const a = seg[i-1], b = seg[i], [ax,ay] = this.screen(a), [bx,by] = this.screen(b), dx = bx-ax, dy = by-ay;
      const t = dx*dx+dy*dy ? Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy))) : 0;
      const d = Math.hypot(x-ax-t*dx,y-ay-t*dy);
      if (d < best) { best = d; meter = a.distance+(b.distance-a.distance)*t; }
    }
    if (best < 45) this.onSelect(meter);
  }
  draw() {
    const c = this.ctx, w = this.width, h = this.height;
    c.clearRect(0,0,w,h); c.fillStyle = '#e8eddf'; c.fillRect(0,0,w,h);
    // A coordinate grid, deliberately not a fabricated topographic map.
    const stepMeters = 10 ** Math.floor(Math.log10(Math.max(1, 90 / (this.scale*this.zoom))));
    const step = stepMeters * this.scale * this.zoom;
    const gridStep = step < 40 ? step * 5 : step;
    c.strokeStyle = '#d9e1d1'; c.lineWidth = 1;
    for (let x = (w/2+this.pan.x)%gridStep; x < w; x+=gridStep) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
    for (let y = (h/2+this.pan.y)%gridStep; y < h; y+=gridStep) { c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }
    if (!this.track) return;
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const seg of this.lines) {
      if (!seg.length) continue;
      const path = new Path2D(); seg.forEach((p,i) => { const [x,y] = this.screen(p); if(i) path.lineTo(x,y); else path.moveTo(x,y); });
      c.strokeStyle = '#fffdf3'; c.lineWidth = 9; c.stroke(path);
      c.strokeStyle = '#cf603a'; c.lineWidth = 4; c.stroke(path);
      const start = seg[0], end = seg.at(-1)!;
      this.dot(start, '#284c3b', 6); if (Math.hypot(...localXY(end,start)) > 15) this.dot(end, '#ce623f', 6);
    }
    for (const p of this.track.waypoints.slice(0,8)) {
      const [x,y] = this.screen(p); this.dot(p, '#677959', 4);
      c.font = '11px system-ui'; const text = p.name.replace('（演示）',''); const tw = c.measureText(text).width;
      c.fillStyle = '#fffffff0'; c.beginPath(); c.roundRect(x+10,y-12,tw+16,25,5); c.fill(); c.fillStyle = '#47513f'; c.fillText(text,x+18,y+4);
    }
    if (this.selected) { this.dot(this.selected,'#ffffff',9); this.dot(this.selected,'#c96036',5); }
    if (this.live) {
      const [x,y] = this.screen(this.live); c.fillStyle = '#3673ad26'; c.beginPath(); c.arc(x,y,22,0,Math.PI*2); c.fill(); this.dot(this.live,'#3477b3',8);
    }
    const raw = 100/(this.scale*this.zoom), pow = 10**Math.floor(Math.log10(raw)); const nice = (raw/pow >= 5 ? 5 : raw/pow >= 2 ? 2 : 1)*pow;
    const length = nice*this.scale*this.zoom;
    c.strokeStyle = '#607053'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(25,h-39); c.lineTo(25,h-34); c.lineTo(25+length,h-34); c.lineTo(25+length,h-39); c.stroke();
    c.font = '10px system-ui'; c.fillStyle = '#64725a'; c.fillText(nice >= 1000 ? `${nice/1000} km` : `${nice} m`,25,h-44);
  }
  private dot(p: GeoPoint, color: string, size: number) { const [x,y] = this.screen(p); const c=this.ctx; c.beginPath(); c.arc(x,y,size,0,Math.PI*2); c.fillStyle=color; c.fill(); c.strokeStyle='#fff'; c.lineWidth=2; c.stroke(); }
}
