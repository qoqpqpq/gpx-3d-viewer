export interface BackendConfig {amap:{enabled:boolean;key?:string;serviceHost:string}}
let config:BackendConfig={amap:{enabled:false,serviceHost:'/_AMapService'}};
export function backendConfig(){return config;}
export async function refreshBackendConfig(){
 try{const response=await fetch('/api/map-config',{signal:AbortSignal.timeout(3000),cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();
 config={amap:{enabled:data.amap?.enabled===true&&typeof data.amap?.key==='string',key:typeof data.amap?.key==='string'?data.amap.key:undefined,serviceHost:'/_AMapService'}};
 }catch{config={amap:{enabled:false,serviceHost:'/_AMapService'}};}
 if(config.amap.enabled)sessionStorage.removeItem('amap-security');
 return config;
}
