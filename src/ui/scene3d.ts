import * as C from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { thin, simplifyLine } from '../core/geo';
import { matchRoute } from '../core/navigation';
import { tiandituLayers, tiandituWmtsUrl, type MapSettings } from '../core/map-settings';
import type { GeoPoint, Track } from '../core/types';

export class Scene3D {
  private viewer:C.Viewer;
  private terrain=false;
  private selected?:C.Entity;
  private live?:C.Entity;
  private selectedPoint?:GeoPoint;
  private livePoint?:GeoPoint;
  private track?:Track;
  private dead=false;
  private terrainStatus:string;
  private imageryStatus='无底图';
  private buildingsStatus='';
  private timers=new Set<ReturnType<typeof setTimeout>>();
  private generation=0;
  constructor(container:HTMLElement,private status:(s:string)=>void,private fail:(s:string)=>void,private mode:'2d'|'3d'='3d',onSelect?:(meter:number,segment:number)=>void){
    C.Ion.defaultAccessToken='';
    this.terrainStatus=mode==='2d'?'二维平面':'椭球底面（无真实地形）';
    this.viewer=new C.Viewer(container,{animation:false,timeline:false,baseLayerPicker:false,baseLayer:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,terrainProvider:new C.EllipsoidTerrainProvider(),sceneMode:mode==='2d'?C.SceneMode.SCENE2D:C.SceneMode.SCENE3D});
    const globe=this.viewer.scene.globe;
    globe.baseColor=C.Color.fromCssColorString('#dde5d2');globe.showGroundAtmosphere=false;globe.maximumScreenSpaceError=3;
    this.viewer.resolutionScale=1;
    this.viewer.scene.backgroundColor=C.Color.fromCssColorString('#e9eee2');
    this.viewer.scene.renderError.addEventListener(()=>{if(!this.dead)this.fail('地图渲染中断，已退回本地二维路线。');});
    this.viewer.canvas.addEventListener('webglcontextlost',()=>{if(!this.dead)this.fail('显卡上下文丢失，已退回本地二维路线。');});
    if(onSelect)this.viewer.screenSpaceEventHandler.setInputAction((e:{position:C.Cartesian2})=>{
      if(!this.track||this.dead)return;
      const ray=this.viewer.camera.getPickRay(e.position);const cartesian=ray?globe.pick(ray,this.viewer.scene):undefined;
      if(!cartesian)return;const p=C.Cartographic.fromCartesian(cartesian);
      const match=matchRoute(this.track,{lat:C.Math.toDegrees(p.latitude),lon:C.Math.toDegrees(p.longitude),timestamp:Date.now(),accuracy:0,source:'simulation',crs:'WGS84'});
      if(match.distance<Math.max(100,this.viewer.camera.positionCartographic.height*.03))onSelect(match.progress,match.segment);
    },C.ScreenSpaceEventType.LEFT_CLICK);
    this.report();
  }
  private report(){if(!this.dead)this.status([this.terrainStatus,this.imageryStatus,this.buildingsStatus].filter(Boolean).join(' · '));}
  private async timeout<T>(promise:Promise<T>):Promise<T>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('加载超时')),20000);this.timers.add(timer);})]);}
    finally{if(timer){clearTimeout(timer);this.timers.delete(timer);}}
  }
  async connect(settings:MapSettings){
    const generation=++this.generation;
    const valid=()=>!this.dead&&generation===this.generation;
    C.Ion.defaultAccessToken=settings.token;
    const terrainJob=async()=>{
      if(this.mode==='2d'||!settings.token)return;
      this.terrainStatus='地形连接中';this.report();
      try{
        const provider=await this.timeout(C.createWorldTerrainAsync({requestVertexNormals:true}));
        if(!valid())return;this.viewer.terrainProvider=provider;this.terrain=true;
        this.viewer.scene.globe.enableLighting=true;
        this.viewer.scene.light=new C.DirectionalLight({direction:this.viewer.camera.directionWC.clone(),intensity:1.5});
        this.viewer.scene.preRender.addEventListener(()=>{if(!this.dead&&(this.viewer.scene.light instanceof C.DirectionalLight))C.Cartesian3.clone(this.viewer.camera.directionWC,this.viewer.scene.light.direction);});
        provider.errorEvent.addEventListener(()=>{if(valid()){this.terrainStatus='部分地形瓦片失败';this.report();}});
        this.terrainStatus='Cesium 在线地形';
        if(this.track)this.setTrack(this.track,false);
        this.viewer.scene.requestRender();
      }catch{if(valid())this.terrainStatus='地形未连接（椭球），请检查权限/网络';}
      if(valid())this.report();
    };
    const imageryJob=async()=>{
      if(settings.basemap==='none')return;
      this.imageryStatus='底图连接中';this.report();
      try{
        if(settings.basemap.startsWith('tianditu-')){
          if(!settings.tiandituKey)throw new Error('缺少天地图 Key');
          const name=settings.basemap==='tianditu-img'?'天地图影像':'天地图道路';
          for(const layer of tiandituLayers(settings.basemap,settings.labels)){
            const provider=new C.WebMapTileServiceImageryProvider({url:tiandituWmtsUrl(layer,settings.tiandituKey),layer,style:'default',format:'tiles',tileMatrixSetID:'w',tilingScheme:new C.WebMercatorTilingScheme(),tileMatrixLabels:Array.from({length:19},(_,i)=>String(i)),maximumLevel:18,subdomains:['0','1','2','3','4','5','6','7'],credit:new C.Credit('<a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener noreferrer">天地图 · 国家地理信息公共服务平台</a>',true)});
            this.addImagery(provider,name,valid);
          }
          this.imageryStatus=`${name}${settings.labels?' + 中文注记':''}`;
        }else{
          if(!settings.token)throw new Error('缺少 Cesium token');
          const provider=await this.timeout(settings.imageryAsset?C.IonImageryProvider.fromAssetId(settings.imageryAsset):C.createWorldImageryAsync({style:settings.labels?C.IonWorldImageryStyle.AERIAL_WITH_LABELS:C.IonWorldImageryStyle.AERIAL}));
          if(!valid())return;this.addImagery(provider,'Cesium 影像',valid);this.imageryStatus='Cesium 影像';
        }
        if(valid())this.viewer.scene.requestRender();
      }catch{if(valid())this.imageryStatus='底图未连接，请检查 Key/资产权限/网络';}
      if(valid())this.report();
    };
    const buildingsJob=async()=>{
      if(this.mode!=='3d'||settings.buildings===false)return;
      if(!settings.token){this.buildingsStatus='建筑需要 Cesium token';this.report();return;}
      this.buildingsStatus='建筑连接中';this.report();
      let expired=false;
      const pending=C.createOsmBuildingsAsync().then(tiles=>{
        // A scene may be replaced while the request is still in flight.
        if(expired||!valid()){tiles.destroy();return undefined;}
        return tiles;
      });
      try{
        const tiles=await this.timeout(pending);
        if(!tiles)return;
        if(!valid()){tiles.destroy();return;}
        tiles.maximumScreenSpaceError=24;
        this.viewer.scene.primitives.add(tiles);
        this.buildingsStatus='OSM 建筑已启用（覆盖随地区而异）';
        tiles.tileFailed.addEventListener(()=>{if(valid()){this.buildingsStatus='部分建筑加载失败，可重试地图连接';this.report();}});
        this.viewer.scene.requestRender();
      }catch{expired=true;if(valid())this.buildingsStatus='建筑未连接，请检查 token 的 OSM Buildings 权限/网络';}
      if(valid())this.report();
    };
    await Promise.allSettled([terrainJob(),imageryJob(),buildingsJob()]);
  }
  private addImagery(provider:C.ImageryProvider,name:string,valid:()=>boolean){
    const layer=this.viewer.imageryLayers.addImageryProvider(provider);
    let failures=0;
    provider.errorEvent.addEventListener((error:C.TileProviderError)=>{
      error.retry=false;
      if(valid()){
        this.imageryStatus=`${name}瓦片加载失败，请检查权限/网络`;this.report();
        if(++failures>=5){layer.show=false;this.viewer.scene.requestRender();}
      }
    });
  }
  setTrack(track:Track,fit=true){
    if(this.dead)return;
    const changed=this.track?.id!==track.id;
    this.track=track;this.viewer.entities.removeAll();this.selected=undefined;this.live=undefined;
    if(changed){this.selectedPoint=undefined;this.livePoint=undefined;}
    const clamp=this.terrain||this.mode==='2d';
    for(const segment of track.segments){
      const pts=simplifyLine(segment,Math.max(10,Math.floor(10000/track.segments.length)));
      if(pts.length>=2)this.viewer.entities.add({polyline:{positions:pts.map(p=>C.Cartesian3.fromDegrees(p.lon,p.lat,clamp?0:(p.ele??0)+5)),width:5,material:new C.PolylineOutlineMaterialProperty({color:C.Color.fromCssColorString('#ff9a45'),outlineWidth:1,outlineColor:C.Color.fromCssColorString('#613a20')}),clampToGround:clamp}});
      for(const [i,p] of [pts[0],pts.at(-1)!].entries())this.viewer.entities.add({position:C.Cartesian3.fromDegrees(p.lon,p.lat,p.ele??0),point:{pixelSize:11,color:C.Color.fromCssColorString(i?'#e17744':'#325940'),outlineColor:C.Color.WHITE,outlineWidth:2,heightReference:clamp?C.HeightReference.CLAMP_TO_GROUND:C.HeightReference.NONE,disableDepthTestDistance:Infinity}});
    }
    for(const waypoint of track.waypoints.slice(0,100))this.viewer.entities.add({position:C.Cartesian3.fromDegrees(waypoint.lon,waypoint.lat,waypoint.ele??0),point:{pixelSize:7,color:C.Color.WHITE,heightReference:clamp?C.HeightReference.CLAMP_TO_GROUND:C.HeightReference.NONE},label:{text:waypoint.name,font:'12px sans-serif',pixelOffset:new C.Cartesian2(10,-14),showBackground:true,backgroundColor:C.Color.fromCssColorString('#263e35dd'),heightReference:clamp?C.HeightReference.CLAMP_TO_GROUND:C.HeightReference.NONE,disableDepthTestDistance:Infinity}});
    if(this.selectedPoint)this.setSelected(this.selectedPoint);if(this.livePoint)this.setLive(this.livePoint);
    if(fit)this.fit();this.viewer.scene.requestRender();
  }
  fit(){
    if(!this.track||this.dead)return;
    const points=this.track.segments.flatMap(s=>thin(s,300)).map(p=>C.Cartesian3.fromDegrees(p.lon,p.lat,this.mode==='2d'?0:(p.ele??0)));
    const sphere=C.BoundingSphere.fromPoints(points);
    this.viewer.camera.flyToBoundingSphere(sphere,{duration:.7,offset:new C.HeadingPitchRange(0,this.mode==='2d'?-Math.PI/2:-.85,Math.max(800,sphere.radius*3.5))});
  }
  setSelected(p:GeoPoint){this.selectedPoint=p;this.selected=this.marker(this.selected,p,'#ff8c3e');}
  setLive(p?:GeoPoint){this.livePoint=p;if(!p){if(this.live&&!this.dead)this.viewer.entities.remove(this.live);this.live=undefined;return;}this.live=this.marker(this.live,p,'#488bc5');}
  private marker(entity:C.Entity|undefined,p:GeoPoint,color:string){
    if(this.dead)return entity;
    const position=C.Cartesian3.fromDegrees(p.lon,p.lat,(p.ele??0)+10);
    if(entity)entity.position=new C.ConstantPositionProperty(position);
    else entity=this.viewer.entities.add({position,point:{pixelSize:13,color:C.Color.fromCssColorString(color),outlineColor:C.Color.WHITE,outlineWidth:3,heightReference:(this.terrain||this.mode==='2d')?C.HeightReference.CLAMP_TO_GROUND:C.HeightReference.NONE,disableDepthTestDistance:Infinity}});
    this.viewer.scene.requestRender();return entity;
  }
  zoom(multiplier:number){if(this.dead)return;const height=this.viewer.camera.positionCartographic.height;if(multiplier>1)this.viewer.camera.zoomIn(height*.25);else this.viewer.camera.zoomOut(height*.3);this.viewer.scene.requestRender();}
  destroy(){if(this.dead)return;this.dead=true;this.generation++;for(const timer of this.timers)clearTimeout(timer);this.timers.clear();this.viewer.destroy();}
}
