/**
 * R-112: 打开外部地图前往路线起点
 * 为各地图服务生成从路线起点出发的步行导航 URL。
 */

export type ExternalMapService = 'amap' | 'baidu' | 'apple' | 'google';

export interface NavDestination {
  lat: number;
  lon: number;
  name: string;
}

export function externalNavUrl(service: ExternalMapService, dest: NavDestination): string {
  const l = dest.lat.toFixed(6);
  const g = dest.lon.toFixed(6);
  const n = encodeURIComponent(dest.name);
  switch (service) {
    case 'amap':
      return `https://uri.amap.com/navigation?to=${g},${l},${n}&mode=walking`;
    case 'baidu':
      return `https://api.map.baidu.com/direction?destination=${l},${g}&mode=walking&output=html`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${l},${g}&dirflg=w`;
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${l},${g}&travelmode=walking`;
    default:
      return '';
  }
}

export const EXTERNAL_MAP_SERVICES: { id: ExternalMapService; label: string; note: string }[] = [
  { id: 'amap', label: '高德地图', note: 'uri.amap.com · 支持 App 跳转' },
  { id: 'baidu', label: '百度地图', note: 'api.map.baidu.com · 支持 App 跳转' },
  { id: 'apple', label: 'Apple 地图', note: 'maps.apple.com · 仅 macOS/iOS' },
  { id: 'google', label: 'Google 地图', note: 'google.com/maps · 仅支持网络版' },
];
