import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
import {ROOT, sha} from './common.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {capturePlatformInputs, validatePlatformRunManifest} from './platform_run_binding.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASELINE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER=['example/integration_test/map_control_lifecycle_contracts.dart','b94ff1b8751719f7e4c742e5001658533413889dd931d3e510d4c8c461170d2a'];
const REVIEW=['docs/sdk-audit/reviews/map-control-lifecycle-source-review.json','7dea9467f6775c91a8dc11f515adb286ca5e3853b6db437af88164af80624a43'];
const SOURCES={
 mapZoomIn:[1263875,1264109,'72e8db1507b7eebfb29339c7c201448f7598c02cd786dea230793763aee8561a'],
 mapZoomOut:[1264110,1264345,'69ad5328ce743cb7dfce3898acc9d80c77c4978dffd9a4ff050bfb380b97cddf'],
 mapSetZoom:[1263723,1263874,'3ce8ad8fb9c0038a71cf650c7b1282bf9ebe5b2768469970c5e6a47e57a482e3'],
 cameraEaseTo:[499850,501009,'50a789d1868ccd3c568ec0eb16b15c4c6411324ce4d160cf49ba07458ec60d2e'],
 engineGetCamera:[710957,710984,'4d95b156deb5068aa72d43dff4717eade20fc7df8942cc12685e4be2a70c227d'],
 engineCameraConstruction:[705955,705975,'b105f97d7d85cfd6809fd8372847439de6ef4cd10eed60550524e29440ee8a8f'],
 mapOn:[1261195,1261703,'c2e06fa64ec3dc4d91d83a8eb36d9987705bf54ce63c3c373d8335a2a1b4741e'],
 mapOff:[1261704,1261994,'7036d92e65a9e4b304a094959c37b47a5123a2294dbf8d2785898e4b940da919'],
 engineOnOff:[708798,708912,'32364a0c759a8ca522d880f05d95a55f17f274cbeccf6aec2eac7395a4acd054'],
 emitterRemoveListener:[43199,43556,'83943ec9c9b8fcfb1e855b3d73800bf85bf5855b8131656569016ff670dcfb35'],
};
const fail=message=>{throw Error(message);};
const keys=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&equal(Object.keys(x).sort(),[...k].sort());
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const TOUCH=['TouchStart','TouchEnd'];
const LIMITATIONS=['No physical touch gesture or event object identity is tested.',
 'Command futures represent dispatch; ZoomEnd is observed separately.',
 'Selected fixtures do not establish full Map.on/off or event parity.'];
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const target=path.resolve(root,file);if(!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail('source or evidence hash mismatch: '+file);return bytes.toString('utf8');
}
function sourceBindings(root,current){
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK);
 const review=JSON.parse(load(root,...REVIEW));load(root,...HELPER);
 if(review.baselineId!==BASELINE||review.sdkSha256!==SDK||review.status!=='IMPLEMENTED_MOCK_TESTED_LIVE_PENDING_OPEN'||review.offsetUnit!=='UTF-16')fail('review metadata mismatch');
 if(!current.inputs.some(x=>x.file===HELPER[0]&&x.sha256===HELPER[1]))fail('helper absent from run inputs');
 for(const [file,digest] of [[HELPER[0],HELPER[1]],['lib/src/web/bridge_scripts/map_control.dart','cbdb4c671925b20f9fd39fc9b0d913e956fbeb5c49f6133271e1b810ee413cfe'],['lib/src/js/js_map_touch.dart','787aad6337dccdeec7818128ab3b713e9e4c2621cd23a8e05bae655834b8051a']]){
  if(!Array.isArray(review.files)||review.files.filter(x=>x.file===file&&x.sha256===digest).length!==1)fail('review file binding mismatch');
  if(file.startsWith('lib/')&&current.libFingerprint.files[file]!==digest)fail('bridge source binding mismatch');
 }
 const spans={};for(const [name,[start,end,digest]] of Object.entries(SOURCES)){
  const text=sdk.slice(start,end),r=review.source?.[name];
  if(sha(text)!==digest||r?.start!==start||r?.end!==end||r?.bodySha256!==digest)fail('SDK source span mismatch: '+name);
  spans[name]=text;
 }
 const functionPart=name=>{const x=spans[name],i=x.indexOf('function');if(i<0)fail('SDK wrapper function missing');return x.slice(i);};
 return {zoomIn:functionPart('mapZoomIn'),zoomOut:functionPart('mapZoomOut'),cameraEaseTo:spans.cameraEaseTo};
}
function validateZoom(data,phase,expected){
 if(!keys(data,['trace','events','zoom'])||data.zoom!==expected||!finite(expected)||!Array.isArray(data.trace)||data.trace.length!==2)fail('zoom result shape');
 const [method,ease]=data.trace,methodName=phase==='in'?'zoomIn':'zoomOut';
 if(!equal(method,{phase,call:methodName})||!equal(ease,{phase,call:'easeTo',zoom:expected,animate:true,moveByProgram:true}))fail('zoom dispatch or animation mismatch');
 const events=data.events;if(!Array.isArray(events)||events.length<3)fail('missing zoom lifecycle');
 for(let i=0;i<events.length;i++){
  const e=events[i],name=i===0?'ZoomStart':i===events.length-1?'ZoomEnd':'Zoom';
  if(!keys(e,['phase','name','zoom'])||e.phase!==phase||e.name!==name||!finite(e.zoom))fail('invalid zoom lifecycle');
 }
 if(events.at(-1).zoom!==expected)fail('zoom end state mismatch');
}
function validateTouch(phases){
 if(!Array.isArray(phases)||phases.length!==3)fail('missing or duplicate touch phases');
 for(let i=0;i<3;i++){
  const p=phases[i],name=['attached','disposed','reattached'][i],count=i+1,localCount=[2,2,4][i],longitude=-2-i,screenY=3+i;
  if(!keys(p,['phase','state','snapshotNames','widgetCallbackCounts','widgetPayload'])||p.phase!==name||
     !equal(p.snapshotNames,Array.from({length:count},()=>TOUCH).flat())||!equal(p.widgetCallbackCounts,{starts:count,ends:count})||
     !equal(p.widgetPayload,{latitude:0,longitude,touchCount:1,screenPoint:{x:0,y:screenY},screenPointCount:1}))fail('touch phase, widget callbacks or payload mismatch');
  if(!keys(p.state,['local','external'])||!Array.isArray(p.state.local)||p.state.local.length!==localCount||
     !equal(p.state.external,Array.from({length:count},()=>TOUCH).flat()))fail('touch local or independent listener mismatch');
  for(let j=0;j<localCount;j++){
   const latLng={latitude:0,longitude:j<2?-2:-4},point={x:0,y:j<2?3:5};
   const expected={name:TOUCH[j%2],value:{position:latLng,touches:[latLng],screenPoint:point,screenPoints:[point]}};
   if(!equal(p.state.local[j],expected))fail('helper-owned touch payload mismatch');
  }
 }
}
function validateObservation(source,result,expectedSources){
 if(!keys(source,['expectedSdkSha256','sdkDigestMeasurement','callableMeasurement','callableSources'])||source.expectedSdkSha256!==SDK||
    source.sdkDigestMeasurement!=='not measured by this helper'||source.callableMeasurement!=='Function.prototype.toString; SDK bytes not measured'||!equal(source.callableSources,expectedSources))fail('runtime callable source mismatch');
 if(!keys(result,['expectedSdkSha256','sdkDigestMeasurement','zoomMechanism','touchMechanism','zoomIn','zoomOut','touchPhases','callableSources','limitations'])||
    result.expectedSdkSha256!==SDK||result.sdkDigestMeasurement!=='not measured by this helper'||
    result.zoomMechanism!=='controller commands and real SDK camera animation'||result.touchMechanism!=='synthetic SDK engine emitter'||
    !equal(result.callableSources,expectedSources)||!equal(result.limitations,LIMITATIONS))fail('observation binding or mechanism mismatch');
 const start=result.zoomOut?.zoom;if(!finite(start))fail('invalid starting zoom');
 validateZoom(result.zoomIn,'in',start+1);validateZoom(result.zoomOut,'out',start);
 if(result.zoomIn.events[0].zoom!==start||result.zoomOut.events[0].zoom!==start+1)fail('zoom phase continuity mismatch');
 validateTouch(result.touchPhases);
}

/** Collect bounded observations only. This never promotes contract status. */
export function collectMapControlLifecycleObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;
  if(manifest?.id!==BASELINE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or SDK mismatch');
  if(!ev||!equal(ev.libFingerprint,libFingerprint))fail('platform evidence or fingerprint mismatch');
  const current=capturePlatformInputs(root);
  if(!equal(current,{libFingerprint,inputs:ev.inputs}))fail('current platform inputs mismatch');
  const expectedSources=sourceBindings(root,current);
  const records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate integration records');
  const limitations=['Only callable source text is checked; platform SDK bytes and private closures are not measured.',
   'Touch events are synthetic emitter dispatches, not physical gestures.',
   'Touch callback suppression and preservation of other listeners do not establish native listener membership or successful removal: off may throw or do nothing while the callback becomes inert.',
   'Command Future completion represents dispatch; a later ZoomEnd is separately observed.',
   'An animate:true request and selected zoom events do not establish that intermediate animation frames were rendered.',
   'Selected zoom and listener-isolation samples do not establish complete API, object identity, or event parity.',
   'Successful overall run completion implies the helper did not report cleanup failure; cleanup details are not separately emitted.'];
  const common={status:'observed-not-verified',baselineId:BASELINE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,
   fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations};
  const out={
   'Tmapv3.Map#zoomIn':{...common,scope:'One real SDK zoom-in animation request and its selected event sequence per platform; rendered intermediate frames are not observed.',platforms:{}},
   'Tmapv3.Map#zoomOut':{...common,scope:'One real SDK zoom-out animation request and its selected event sequence per platform; rendered intermediate frames are not observed.',platforms:{}},
   'Vsm.Map#off':{...common,scope:'One synthetic touch sequence per platform observes helper-owned callback suppression and preservation of other listeners; native listener membership and successful removal are not measured.',platforms:{}}
  };
  for(const rec of records){
   const expectedFile=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expectedFile||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=load(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run binding');
   const {sanitizedLogSha256,...rawRun}=run;
   validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!(rec.platform==='web'?parsePlatformTextResults(lines).webPassed:parsePlatformTextResults(lines).mobilePassed))fail('integration completion marker missing');
   const parse=marker=>lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.marker===marker?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   const sources=parse('MAP CONTROL LIFECYCLE SOURCE:'),results=parse('MAP CONTROL LIFECYCLE RESULT:');
   if(sources.length!==1||results.length!==1||!equal(sources.map(x=>x.data),rec.mapControlLifecycleSources)||!equal(results.map(x=>x.data),rec.mapControlLifecycleResults)||sources[0].line>=results[0].line)fail('missing, duplicate, reordered or altered observations');
   validateObservation(sources[0].data,results[0].data,expectedSources);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   const details={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:sources[0].data,ref:ref(sources[0])},resultRef:ref(results[0])};
   out['Tmapv3.Map#zoomIn'].platforms[rec.platform]={...details,observation:results[0].data.zoomIn};
   out['Tmapv3.Map#zoomOut'].platforms[rec.platform]={...details,observation:results[0].data.zoomOut};
   out['Vsm.Map#off'].platforms[rec.platform]={...details,observation:results[0].data.touchPhases};
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'map-control-lifecycle-observations-rejected',reason:String(error.message)}]};}
}
