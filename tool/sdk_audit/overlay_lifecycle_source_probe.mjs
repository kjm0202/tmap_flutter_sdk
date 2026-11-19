import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {parseExpressionAt} from 'acorn';
import {ROOT,sha} from './common.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
/** Selected exact SDK functions in a fake map/DOM; no SDK network or browser. */
export function observeOverlayLifecycleSource(root=ROOT){
 const bytes=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',SDK));if(sha(bytes)!==SDK)throw Error('SDK digest mismatch');
 const source=bytes.toString('utf8'),spans={};
 function expr(name,at,prefix){const start=source.indexOf(prefix,at);if(start<0)throw Error('source not found: '+name);const fn=source.indexOf('function',start),ast=parseExpressionAt(source,fn,{ecmaVersion:'latest'}),end=ast.type==='SequenceExpression'?ast.expressions[0].end:ast.end,text=source.slice(fn,end);spans[name]={start:fn,end,sha256:sha(text)};return text;}
 const emitterText=expr('emitter',41000,'function Di()'),objectSetMap=expr('objectSetMap',870063,'t.prototype.setMap=function'),clusterSetMap=expr('clusterSetMap',938682,'t.prototype.setMap=function'),mapOn=expr('mapOn',1261000,'t.prototype.on=function'),mapOff=expr('mapOff',1261000,'t.prototype.off=function'),getAnchor=expr('getAnchor',894575,'t.prototype.getAnchor=function'),setBorder=expr('setBorder',894575,'t.prototype.setBorder=function'),publicInfoSetOptions=expr('publicInfoSetOptions',894575,'t.prototype.setOptions=function'),infoSetOptions=expr('infoSetOptions',896930,'setOptions:function');
 const ctx={wi:{exports:{}},Ai:0,Tmapv3:{mapobject:{MapObject:function(){},InfoWindowOptions:{TYPE_FLAT:2}}}};vm.createContext(ctx);
 const run=x=>vm.runInContext('('+x+')',ctx);ctx.Tmapv3.mapobject.MapObject.prototype.setMap=run(objectSetMap);
 const E=run(emitterText)(),events=new E();let updates=0;
 const engine={on:(...a)=>events.on(...a),off:(...a)=>events.off(...a)};
 const map={_data:{vsmMap:engine},on:run(mapOn),off:run(mapOff)};
 const cluster={_map:map,_cluster_data:{map,markers:[{id:'one'},{id:'two'}]},getMap(){return this._map;},updateClusters(){updates++;}};
 const nativeSetMap=run(clusterSetMap),originalMarkers=cluster._cluster_data.markers,other=()=>{},sentinel=()=>{};
 cluster._boundUpdateClusters=cluster.updateClusters.bind(cluster);map.on('Zoom',cluster._boundUpdateClusters);map.on('Zoom',other);map.on('Zoom',sentinel);
 const before=events.listenerCount('Zoom');const detachedReturn=nativeSetMap.call(cluster,null);
 const detached={listenerCount:events.listenerCount('Zoom'),mapIsNull:cluster.getMap()===null,arrayIdentity:cluster._cluster_data.markers===originalMarkers,markerCount:cluster._cluster_data.markers.length,returnIsUndefined:detachedReturn===undefined};
 nativeSetMap.call(cluster,map);const reattached={listenerCount:events.listenerCount('Zoom'),sameMap:cluster.getMap()===map,arrayIdentity:cluster._cluster_data.markers===originalMarkers,markerCount:cluster._cluster_data.markers.length,updates};
 const element={style:{border:'1px solid black'}},info={_iw_data:{anchorMode:'bottom',options:{type:2,border:'1px solid black'},vsmMarkerOption:{},vsmMarker:null}};
 const getter=run(getAnchor),border=run(setBorder),options=run(infoSetOptions);
 const initialAnchor=getter.call(info);options.call(info,{anchor:'auto-top'});const updatedAnchor=getter.call(info);
 options.call(info,{border:'3px solid red'});const afterOptions={stored:info._iw_data.options.border,element:element.style.border};
 let nativeFlatError=null;try{border.call(info,'3px solid red');}catch(e){nativeFlatError=e.name;}
 const afterNativeError={stored:info._iw_data.options.border,element:element.style.border};
 info._iw_data.options.type=1;border.call(info,'9px solid blue');const balloonBorder=element.style.border;
 info._iw_data.options.type=2;info.getElement=()=>element;border.call(info,'3px solid red');const injectedGetterResult=element.style.border;
 return {sdkSha256:SDK,spans,cluster:{before,detached,reattached},info:{initialAnchor,updatedAnchor,afterOptions,nativeFlatError,afterNativeError,balloonBorder,injectedGetterResult}};
}
