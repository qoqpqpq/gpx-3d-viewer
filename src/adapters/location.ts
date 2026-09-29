import type { LocationAdapter, LocationFix } from '../core/types';
export class BrowserLocation implements LocationAdapter {
  private watch: number | undefined;
  start(onFix: (fix: LocationFix) => void, onError: (message: string) => void) {
    this.stop();
    if (!navigator.geolocation) { onError('当前浏览器不支持定位。'); return; }
    this.watch = navigator.geolocation.watchPosition(p => onFix({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp, source: 'browser', crs: 'WGS84' }), e => {
      onError(e.code === 1 ? '定位权限被拒绝。可在浏览器设置中允许后重试。' : e.code === 3 ? '定位超时，请移至信号更好的位置重试。' : '暂时无法获取位置，请重试。');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }
  stop() { if (this.watch !== undefined) navigator.geolocation.clearWatch(this.watch); this.watch = undefined; }
}
