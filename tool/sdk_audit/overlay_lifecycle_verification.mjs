import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {observeOverlayLifecycleSource} from './overlay_lifecycle_source_probe.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER=['example/integration_test/overlay_lifecycle_contracts.dart','8f3477c8eb2e2c7e6ec5e88b270aef0cf0d15f2a2211ba14f65358d5a8d64e45'];
const REVIEW=['docs/sdk-audit/reviews/overlay-lifecycle-source-review.json','a0517a9ee07d85b120e782730cfbf05c785c14a30f90d64c7b6c04e47a44b7a1'];
const fail=x=>{throw Error(x);};
const keys=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&same(Object.keys(x).sort(),[...k].sort());
function read(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const f=path.resolve(root,file);if(!fs.realpathSync(f).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const b=fs.readFileSync(f);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('evidence digest: '+file);return b.toString('utf8');
}
/** Recompute row comparisons; these rows alone do not establish platform evidence. */
export function compareOverlayLifecycleRows(source,rows,callables){
 if(!keys(source,['schemaVersion','sdkDigestMeasurement','callableMeasurement','callables'])||source.schemaVersion!==1||source.sdkDigestMeasurement!=='not measured by helper'||source.callableMeasurement!=='Function.prototype.toString; SDK bytes not measured'||!same(source.callables,callables))fail('callable source mismatch');
 if(!Array.isArray(rows)||rows.length!==2)fail('missing or duplicate cases');
 const c=rows[0];if(!keys(c,['schemaVersion','id','status','scope','native','adapterBefore','adapter','reattached'])||c.schemaVersion!==1||c.id!=='cluster-attachment'||c.status!=='observed'||c.scope!=='native cluster setMap; Zoom listener loss is observed SDK behavior')fail('cluster case shape');
 const native=c.native,adapter=c.adapter,reattached=c.reattached,truth=['sameCluster','mapNull','sameArray','sameMembers','otherStillMapped'];
 if(!keys(native,['before','after','returnUndefined',...truth])||!keys(adapter,['after',...truth])||!Number.isSafeInteger(native.before)||native.before<3||!Number.isSafeInteger(c.adapterBefore)||c.adapterBefore<3||native.after!==0||adapter.after!==0||native.returnUndefined!==true||!truth.every(k=>native[k]===true&&adapter[k]===true)||
  !keys(reattached,['sameCluster','mapRestored','sameArray','sameMembers','zoomListeners'])||!['sameCluster','mapRestored','sameArray','sameMembers'].every(k=>reattached[k]===true)||!Number.isSafeInteger(reattached.zoomListeners)||reattached.zoomListeners<1)fail('cluster instance, marker, or Zoom listener comparison');
 const i=rows[1];if(!keys(i,['schemaVersion','id','status','scope','anchor','border'])||i.schemaVersion!==1||i.id!=='info-anchor-border'||i.status!=='observed'||i.scope!=='native border error and explicitly adapted rendered border')fail('InfoWindow case shape');
 const a=i.anchor,b=i.border;if(!keys(a,['initialNative','initialAdapter','updatedNative','updatedAdapter'])||a.initialNative!=='bottom'||a.initialAdapter!==a.initialNative||a.updatedNative!=='auto-top'||a.updatedAdapter!==a.updatedNative)fail('anchor comparison');
 if(!keys(b,['before','afterOptions','native','adapter','afterNative','rendered','stored','balloonBefore','balloonNative','balloonAfter','missingElementRejected','recreated','expectedStored'])||
  ![b.before,b.afterOptions,b.afterNative,b.rendered,b.stored,b.balloonBefore,b.balloonAfter,b.recreated,b.expectedStored].every(x=>typeof x==='string')||
  b.afterOptions!==b.before||!same(b.native,{status:'threw',name:'TypeError'})||!same(b.adapter,b.native)||b.afterNative!==b.before||b.rendered===b.before||b.stored!=='2px solid rgb(11, 22, 33)'||
  !same(b.balloonNative,{status:'returned',value:b.balloonBefore})||b.balloonAfter!==b.balloonBefore||b.missingElementRejected!==true||b.recreated!==b.expectedStored||b.recreated===b.rendered)fail('border comparison');
 return true;
}
export function collectOverlayLifecycleObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform fingerprint mismatch');const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs mismatch');
  const review=JSON.parse(read(root,...REVIEW)),sdk=read(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK);read(root,...HELPER);
  if(review.status!=='SOURCE_AND_MOCK_TESTED_PLATFORM_PENDING_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(observeOverlayLifecycleSource(root),review.originalExecutableProbe))fail('source review or executable probe mismatch');
  for(const e of review.files){read(root,e.file,e.sha256);if(e.file.startsWith('lib/')&&current.libFingerprint.files[e.file]!==e.sha256)fail('reviewed library source mismatch');}
  if(!review.files.some(e=>same(e,{file:HELPER[0],sha256:HELPER[1]}))||!current.inputs.some(e=>same(e,{file:HELPER[0],sha256:HELPER[1]})))fail('helper not bound to platform inputs');
  const callables={};for(const name of ['clusterSetMap','mapOff','getAnchor','setBorder','publicInfoSetOptions']){const span=review.originalExecutableProbe.spans[name];if(!span||sha(sdk.slice(span.start,span.end))!==span.sha256)fail('source span mismatch: '+name);callables[name]=sdk.slice(span.start,span.end);}
  const records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate platform runs');
  const common={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations:['Map.off removes all Zoom listeners in the pinned SDK; helper cannot restore prior registrations and must run last.','Native flat setBorder throws TypeError for the pinned inspected SDK; the separate rendered-border adapter changes private DOM, not native behavior.','Function text is not a loaded SDK byte digest; selected cases do not establish full lifecycle, drawing, identity or error parity.']};
  const out={'Tmapv3.extension.MarkerCluster#setMap':{...common,scope:'Two-cluster native/controller detach, same instance and markers, and observed Zoom listener loss.',platforms:{}},'Tmapv3.mapobject.InfoWindow#getAnchor':{...common,scope:'Native/controller initial and auto-top anchor values.',platforms:{}},'Tmapv3.mapobject.InfoWindow#setBorder':{...common,scope:'Native flat error and balloon no-op; separate Flutter rendered-border adaptation.',platforms:{}}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=read(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(read(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run binding mismatch');const {sanitizedLogSha256,...raw}=run;
   validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});const completion=parsePlatformTextResults(lines);if(rec.platform==='web'?!completion.webPassed:!completion.mobilePassed)fail('completion marker');
   const parsed={overlayLifecycleSources:[],overlayLifecycleResults:[]};lines.forEach((line,i)=>{const row=decodePlatformLogLine(line);if(row?.kind==='json'&&Object.hasOwn(parsed,row.field))parsed[row.field].push({data:JSON.parse(row.payload),line:i+1});});
   const src=parsed.overlayLifecycleSources,rows=parsed.overlayLifecycleResults;if(src.length!==1||rows.length!==2||src[0].line>=rows[0].line||rows[0].line>=rows[1].line||!same(src.map(x=>x.data),rec.overlayLifecycleSources)||!same(rows.map(x=>x.data),rec.overlayLifecycleResults))fail('missing, duplicate, reordered, or altered markers');
   compareOverlayLifecycleRows(src[0].data,rows.map(x=>x.data),callables);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const [id,index] of [['Tmapv3.extension.MarkerCluster#setMap',0],['Tmapv3.mapobject.InfoWindow#getAnchor',1],['Tmapv3.mapobject.InfoWindow#setBorder',1]])out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:src[0].data,ref:ref(src[0])},observation:rows[index].data,resultRef:ref(rows[index])};
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'overlay-lifecycle-observations-rejected',reason:String(error.message)}]};}
}
