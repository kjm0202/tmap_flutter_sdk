import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
import {ROOT,sha} from './common.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const SPAN={start:948714,end:958986,sha256:'130c1ac32e5e8e4fd9e10c0c138aa33e19cdab8dc52e2bff1a0495dce8743170'};
/** Executes the exact SDK Drawing namespace against a mock map and shapes. */
export function observeDrawingLifecycleSource({root=ROOT}={}){
 const sdk=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',SDK),'utf8');if(sha(sdk)!==SDK)throw Error('SDK digest mismatch');const source=sdk.slice(SPAN.start,SPAN.end);if(sha(source)!==SPAN.sha256)throw Error('Drawing source mismatch');
 const callbacks=[],map={on(name,fn){callbacks.push([name,fn])}},context={};
 vm.runInNewContext(`var Tmapv3={base:{Object:function(){},Point:function(){}},shape:{Circle:class{},Rectangle:class{},Polyline:class{},Polygon:class{}},extension:{},inherit:function(c,b){c.prototype=Object.create(b.prototype);c.prototype.constructor=c},createNamespace:function(n,v){this.extension.Drawing=v}}`,context);
 vm.runInNewContext(source,context);const T=context.Tmapv3,drawing=new T.extension.Drawing({map});
 const polygon=new T.shape.Polygon(),circle=new T.shape.Circle();polygon.setMap=v=>polygon.map=v;circle.setMap=v=>circle.map=v;polygon.map=map;circle.map=map;
 const old=drawing.getShapes();old.push(polygon,circle);const sameStored=old===drawing.getShapes(),filteredA=drawing.getPolygons(),filteredB=drawing.getPolygons();
 if(!sameStored||filteredA===filteredB||filteredA[0]!==polygon||filteredB[0]!==polygon)throw Error('array identity mismatch');
 drawing.clear();const after=drawing.getShapes();if(old===after||old.length!==2||after.length!==0||polygon.map!==null||circle.map!==null)throw Error('clear mismatch');
 const first=new T.shape.Polygon(),second=new T.shape.Circle();first.setMap=v=>first.map=v;second.setMap=()=>{throw Error('detach failure')};first.map=map;after.push(first,second);
 let error;try{drawing.clear()}catch(e){error=e.message}if(error!=='detach failure'||drawing.getShapes()!==after||after.length!==2||first.map!==null)throw Error('partial clear mismatch');
 return {schemaVersion:1,sdkSha256:SDK,source:SPAN,mechanism:'exact SDK Drawing source with mock map and shapes',listeners:callbacks.map(x=>x[0]),storedIdentity:true,filteredArraysDistinct:true,filteredMemberIdentity:true,clearReplacesArray:true,oldArrayRetained:true,clearedShapesDetached:true,failedClear:{error:'detach failure',priorShapeDetached:true,arrayUnchanged:true},limitations:['No browser rendering, real touch input, complete SDK implementation or device bundle measurement.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(observeDrawingLifecycleSource()));
