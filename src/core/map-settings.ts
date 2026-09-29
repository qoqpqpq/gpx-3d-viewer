import { backendConfig } from '../adapters/backend';
export type Basemap = 'amap-terrain' | 'amap' | 'none' | 'ion' | 'tianditu-img' | 'tianditu-vec';
export interface MapSettings { token: string; basemap: Basemap; tiandituKey: string; labels: boolean; buildings?: boolean; amapKey?: string; amapSecurity?: string; imageryAsset?: number }
export interface SettingsStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function loadMapSettings(store: SettingsStore): MapSettings {
  const token=store.getItem('ion-token')??'', saved=store.getItem('map-basemap');
  const basemap:Basemap=['amap-terrain','amap','none','ion','tianditu-img','tianditu-vec'].includes(saved??'')?saved as Basemap:token?'ion':'none';
  const asset=Number(store.getItem('ion-imagery'));
  return {token,basemap,amapKey:store.getItem('amap-key')??'',amapSecurity:store.getItem('amap-security')??'',tiandituKey:store.getItem('tianditu-key')??'',labels:store.getItem('map-labels')!=='false',buildings:store.getItem('map-buildings')!=='false',imageryAsset:Number.isSafeInteger(asset)&&asset>0?asset:undefined};
}
export function validateMapSettings(settings: MapSettings): string | undefined {
  if(settings.basemap.startsWith('amap')&&!backendConfig().amap.enabled&&!import.meta.env.DEV)return '请先在服务器配置高德凭据，正式版本不接受浏览器安全密钥。';
  if(settings.basemap.startsWith('amap')&&!backendConfig().amap.enabled&&(!settings.amapKey?.trim()||!settings.amapSecurity?.trim()))return '高德地图需要 Web 端 Key 和配套安全密钥 securityJsCode。';
  if(settings.basemap.startsWith('tianditu-')&&!settings.tiandituKey.trim())return '天地图底图需要天地图 Key，不能使用 Cesium token。';
  if(settings.basemap==='ion'&&!settings.token.trim())return 'Cesium 影像需要 Cesium ion token。';
  if(settings.imageryAsset!==undefined&&(!Number.isSafeInteger(settings.imageryAsset)||settings.imageryAsset<=0))return '影像 Asset ID 必须是正整数，或留空。';
}
export function saveMapSettings(store:SettingsStore,settings:MapSettings){
  const error=validateMapSettings(settings);if(error)throw new Error(error);
  store.setItem('ion-token',settings.token.trim());store.setItem('ion-imagery',settings.imageryAsset?.toString()??'');
  store.setItem('map-basemap',settings.basemap);store.setItem('tianditu-key',settings.tiandituKey.trim());store.setItem('map-labels',String(settings.labels));
  store.setItem('amap-key',settings.amapKey?.trim()??'');store.setItem('amap-security',!backendConfig().amap.enabled&&import.meta.env.DEV?settings.amapSecurity?.trim()??'':'');
  store.setItem('map-buildings',String(settings.buildings??true));
}
export function tiandituLayers(kind:Basemap,labels:boolean):string[]{
  if(kind==='tianditu-img')return labels?['img','cia']:['img'];
  if(kind==='tianditu-vec')return labels?['vec','cva']:['vec'];
  return [];
}
export function tiandituWmtsUrl(layer:string,key:string):string{
  if(!['img','cia','vec','cva'].includes(layer))throw new Error('不支持的天地图图层');
  return `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${encodeURIComponent(key.trim())}`;
}



