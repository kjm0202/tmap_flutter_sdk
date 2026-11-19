import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER=['example/integration_test/map_drag_progress_contracts.dart','38fe555c94871d69061f483dcea78122c8bb90dafd00ee0210a092e207e2a15c'];
const REVIEW=['docs/sdk-audit/reviews/map-drag-progress-source-review.json','5a971d0ce9496346f416d71455069cc19eb4e36e68403783d25e0a742a0ca6d8'];
const SPANS={mapOn:[1261195,1261703,'c2e06fa64ec3dc4d91d83a8eb36d9987705bf54ce63c3c373d8335a2a1b4741e'],
 getCenter:[1263259,1263383,'e8e665ad2ab3405af6481e327922eec0400849fa69c6bc6141c98b3d4cfcffbe'],
 getZoom:[1263632,1263722,'372a109432dfe24a3fc3405250fb4aeaff2138d9ff51a1b28106b9d2d3c74baf'],
 engineEmit:[708964,709007,'c89f37428d40f1709d427301a15ae425cf86c28523e73bede151b77ac70c5b2c'],
 gestureDrag:[514550,514900,'76b454b1ef7b6ca309581c6a6b7ae31eb997b66e0f18e6033fcd1ed201f30d82']};
const fail=x=>{throw Error(x);};
const keys=(x,list)=>x&&typeof x==='object'&&!Array.isArray(x)&&same(Object.keys(x).sort(),[...list].sort());
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const position=p=>keys(p,['latitude','longitude'])&&finite(p.latitude)&&finite(p.longitude);
const PHASES=['start','move','move','end'];
const LIMITATIONS=['Neither mechanism is a physical gesture.','Marker dragging is the Flutter custom pointer adapter, not SDK-native marker drag parity.','Callable text does not establish SDK bytes or closure identity on device.'];
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const target=path.resolve(root,file);if(!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const b=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('source or evidence hash mismatch: '+file);return b.toString('utf8');
}
function sources(root,current){
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK),review=JSON.parse(load(root,...REVIEW));load(root,...HELPER);
 if(review.status!=='SOURCE_AND_MOCK_TESTED_LIVE_PENDING_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16')fail('source review mismatch');
 if(!current.inputs.some(x=>x.file===HELPER[0]&&x.sha256===HELPER[1]))fail('helper not bound to run inputs');
 if(!Array.isArray(review.files)||review.files.filter(x=>x.file===HELPER[0]&&x.sha256===HELPER[1]).length!==1)fail('reviewed helper mismatch');
 for(const entry of review.files.filter(x=>x.file.startsWith('lib/')))if(current.libFingerprint.files[entry.file]!==entry.sha256)fail('reviewed library source mismatch');
 const result={};for(const [name,[start,end,digest]] of Object.entries(SPANS)){
  const text=sdk.slice(start,end),item=review.source?.[name];
  if(sha(text)!==digest||item?.start!==start||item?.end!==end||item?.sha256!==digest)fail('SDK source span mismatch: '+name);
  if(name!=='gestureDrag')result[name]=name==='engineEmit'?text:text.slice(text.indexOf('function'));
 }
 return result;
}
function validate(source,result,callables){
 if(!keys(source,['expectedSdkSha256','sdkDigestMeasurement','callableMeasurement','callableSources'])||source.expectedSdkSha256!==SDK||
    source.sdkDigestMeasurement!=='not measured by this helper'||source.callableMeasurement!=='Function.prototype.toString; SDK bytes not measured'||!same(source.callableSources,callables))fail('runtime callable sources mismatch');
 if(!keys(result,['expectedSdkSha256','sdkDigestMeasurement','mapMechanism','markerMechanism','map','marker','disposal','limitations'])||
    result.expectedSdkSha256!==SDK||result.sdkDigestMeasurement!=='not measured by this helper'||
    result.mapMechanism!=='synthetic SDK engine events'||result.markerMechanism!=='synthetic DOM PointerEvents on Flutter custom pointer adapter'||!same(result.limitations,LIMITATIONS))fail('result mechanism or binding mismatch');
 const map=result.map;
 if(!keys(map,['native','dart'])||!Array.isArray(map.native)||map.native.length!==4||!same(map.native,map.dart))fail('map native/Dart snapshots mismatch');
 for(let i=0;i<4;i++){const e=map.native[i];if(!keys(e,['phase','latitude','longitude','zoom'])||e.phase!==PHASES[i]||!finite(e.latitude)||!finite(e.longitude)||!Number.isInteger(e.zoom))fail('invalid map phase');}
 const pos=m=>({latitude:m.latitude,longitude:m.longitude});
 if(same(pos(map.native[0]),pos(map.native[1]))||same(pos(map.native[1]),pos(map.native[2]))||!same(pos(map.native[2]),pos(map.native[3]))||
    !map.native.every(x=>x.zoom===map.native[0].zoom))fail('map progress did not update or end consistently');
 const marker=result.marker;
 if(!keys(marker,['threshold','native','dart','id'])||marker.id!=='drag'||!keys(marker.threshold,['initial','after'])||!position(marker.threshold.initial)||!same(marker.threshold.initial,marker.threshold.after)||
    !Array.isArray(marker.native)||marker.native.length!==4||!Array.isArray(marker.dart)||marker.dart.length!==4)fail('marker threshold or result shape');
 for(let i=0;i<4;i++){const n=marker.native[i],d=marker.dart[i];
  if(!keys(n,['phase','position'])||n.phase!==PHASES[i]||!position(n.position)||!keys(d,['id','phase','position'])||d.id!==marker.id||d.phase!==n.phase||!same(d.position,n.position))fail('marker native/Dart phase mismatch');
 }
 if(!same(marker.threshold.initial,marker.native[0].position)||same(marker.native[0].position,marker.native[1].position)||
    same(marker.native[1].position,marker.native[2].position)||!same(marker.native[2].position,marker.native[3].position))fail('marker progress did not update or end consistently');
 const disposal=result.disposal;
 if(!keys(disposal,['events','positionAfterDispose','positionAfterMoreInput'])||!position(disposal.positionAfterDispose)||
    !same(disposal.positionAfterDispose,disposal.positionAfterMoreInput)||!Array.isArray(disposal.events)||disposal.events.length!==3)fail('disposal result mismatch');
 for(let i=0;i<3;i++){const e=disposal.events[i];if(!keys(e,['phase','latitude','longitude'])||e.phase!==['start','move','end'][i]||!finite(e.latitude)||!finite(e.longitude))fail('disposal event mismatch');}
 if(same(pos(disposal.events[0]),pos(disposal.events[1]))||!same(pos(disposal.events[1]),pos(disposal.events[2]))||!same(pos(disposal.events[2]),disposal.positionAfterDispose))fail('disposal position mismatch');
}
/** Bounded observations only; never promotes a contract status. */
export function collectMapDragProgressObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline or SDK mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform evidence or fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current platform inputs mismatch');
  const callables=sources(root,current),records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate platform runs');
  const common={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,
   fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations:[
    'Map events are emitted synthetically; no physical drag gesture is observed.',
    'Marker uses Flutter custom pointer handling with synthetic DOM PointerEvents, not native SDK marker drag parity.',
    'Callable text does not measure SDK bundle bytes or private closures; selected events do not prove all Map.on/off behavior.',
    'Successful overall run indicates helper cleanup did not report failure; cleanup details are not separately emitted.' ]};
  const out={'Tmapv3.Map#on':{...common,scope:'Selected synthetic map DragStart/Drag/DragEnd events and Dart callback snapshots.',platforms:{}},
   'Tmapv3.mapobject.Marker!drag':{...common,scope:'Flutter custom pointer callback progress and helper-owned disposal; no native SDK Marker event equality.',platforms:{}}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=load(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   if(!(rec.platform==='web'?parsePlatformTextResults(lines).webPassed:parsePlatformTextResults(lines).mobilePassed))fail('integration completion marker');
   const parse=marker=>lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.marker===marker?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   const src=parse('MAP DRAG PROGRESS SOURCE:'),res=parse('MAP DRAG PROGRESS RESULT:');
   if(src.length!==1||res.length!==1||src[0].line>=res[0].line||!same(src.map(x=>x.data),rec.mapDragProgressSources)||!same(res.map(x=>x.data),rec.mapDragProgressResults))fail('missing, duplicate, reordered or altered observations');
   validate(src[0].data,res[0].data,callables);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   const commonRecord={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:src[0].data,ref:ref(src[0])},resultRef:ref(res[0])};
   out['Tmapv3.Map#on'].platforms[rec.platform]={...commonRecord,observation:res[0].data.map};
   out['Tmapv3.mapobject.Marker!drag'].platforms[rec.platform]={...commonRecord,observation:{marker:res[0].data.marker,disposal:res[0].data.disposal}};
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'map-drag-progress-observations-rejected',reason:String(error.message)}]};}
}
