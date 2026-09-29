import { parseGpx } from './core/gpx';
self.onmessage = (event: MessageEvent<{ xml: string; filename: string }>) => {
  try { self.postMessage({ tracks: parseGpx(event.data.xml, event.data.filename) }); }
  catch (e) { self.postMessage({ error: e instanceof Error ? e.message : '无法解析 GPX 文件。' }); }
};
