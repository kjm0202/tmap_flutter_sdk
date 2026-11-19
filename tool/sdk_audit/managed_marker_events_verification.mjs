import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {collectTrustedMarkerTapObservations} from './trusted_marker_tap_verification.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/managed_marker_events_contracts.dart',HELPER_SHA='6ab085523875a600cb69489f05bcce8ce11348f705fc70221c4e93a25fbdedd1';
const REVIEW='docs/sdk-audit/reviews/managed-marker-events-source-review.json',REVIEW_SHA="ea1791c37b4ec1b42dcdef7c5af328435c5c6ceab9f41244e4784a30253fbfb4",SDKFILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const ids=['fanout-identity','snapshot-cancel','individual-cancel','reattach','replacement','clear'];
export function verifyManagedMarkerEventsReferences(root=ROOT){
 const read=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(sha(b)!==digest)throw Error(`reference digest: ${file}`);return b;};
 read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDKFILE,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(review.sources.map(x=>x.name),['markerSetMap','markerOn','markerOff','markerHandlers','eventAdd','eventRemove']))throw Error('review metadata');
 for(const x of review.sources)if(x.file!==SDKFILE||x.sha256!==SDK||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error(`source span: ${x.name}`);
 const files=['lib/src/js/js_marker_events.dart','lib/src/js/js_marker_drag.dart','lib/src/js/js_marker.dart','lib/src/web/bridge_scripts/markers.dart','lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart','test/managed_marker_events_bridge_test.mjs','test/sdk_managed_marker_events_test.dart','test/web_shape_padding_bridge_test.mjs',HELPER];
 if(!same(review.files.map(x=>x.file),files)||!same(review.priorReports.map(x=>x.file),['docs/sdk-audit/reviews/native-event-invocation-source-review.json','docs/sdk-audit/reviews/map_overlays-review.json','docs/sdk-audit/reviews/map-drag-progress-source-review.json']))throw Error('review file set');
 for(const x of [...review.files,...review.priorReports])read(x.file,x.sha256);
}
/** Validates row schema and order only. A trusted DOM flag is not driver attestation. */
export function compareManagedMarkerEventsRows(rows){
 if(!Array.isArray(rows)||rows.length!==ids.length)return {status:'MISMATCH',issues:['case count']};
 const markerId=rows[0]?.markerId;if(typeof markerId!=='string'||!/^managed-marker-\d+$/.test(markerId))return {status:'MISMATCH',issues:['marker identity']};
 const counts=[{tap:1,snapshot:1,a:1,b:1},{tap:2,snapshot:1,a:2,b:2},{tap:3,snapshot:1,a:2,b:3},{tap:4,snapshot:1,a:2,b:4},{tap:5,snapshot:1,a:2,b:4},{tap:5,snapshot:1,a:2,b:4}];
 const issues=[];for(let i=0;i<ids.length;i++){
  const row=rows[i],allowed=i===0?['synthetic-dom-sdk-marker','trusted-dom-sdk-marker']:['synthetic-dom-sdk-marker'];
  if(!row||!allowed.some(scope=>same(row,{id:ids[i],markerId,passed:true,scope,counts:counts[i],...(i===0?{receiverMatches:true,argumentMatches:true,domTrusted:scope==='trusted-dom-sdk-marker'}:i===3?{outerSame:true,innerChanged:true,elementChanged:true}:i===4?{outerReplaced:true}:i===5?{registryCleared:true}:{})})))issues.push(`case: ${ids[i]}`);
 }return {status:issues.length?'MISMATCH':'BOUNDED_MATCH',issues};
}
export function collectManagedMarkerEventsObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK)||!ev||!same(ev.libFingerprint,libFingerprint))fail('baseline or fingerprint');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');verifyManagedMarkerEventsReferences(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform record set');
  const needsTrusted=records.some(record=>record.managedMarkerEventsResults?.[0]?.scope==='trusted-dom-sdk-marker');
  const trusted=needsTrusted?collectTrustedMarkerTapObservations({runtime,manifest,libFingerprint,root}):null;
  if(trusted?.issues.length)fail('trusted marker driver binding: '+trusted.issues.map(x=>x.reason).join('; '));
  const contracts=['Tmapv3.mapobject.Marker#on','Tmapv3.mapobject.Marker#setMap'];
  const out=Object.fromEntries(contracts.map(id=>[id,{status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['Flutter-managed subscription semantics intentionally differ from raw SDK Marker.on/off and setMap.','Trusted first click requires the independent eleven-action driver, DOM and matching marker identity binding; it is automated input, not a human physical gesture.','Other click, reattach, cancellation and clear observations use synthetic DOM input.','Raw callback takeover and private SDK listener registry limitations are source-reviewed; full Marker contract remains OPEN.'],platforms:{}}]));
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('integration record');
   const load=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('log or run digest');return b.toString('utf8');};
   const lines=load(rec.file,rec.sha256).split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const done=parsePlatformTextResults(lines);if(rec.platform==='web'?!done.webPassed:!done.mobilePassed)fail('completion marker');
   const rows=lines.flatMap((line,index)=>{const v=decodePlatformLogLine(line);return v?.kind==='json'&&v.field==='managedMarkerEventsResults'?[{data:JSON.parse(v.payload),line:index+1}]:[];});
   if(!same(rows.map(x=>x.data),rec.managedMarkerEventsResults))fail('log observation binding');const cmp=compareManagedMarkerEventsRows(rows.map(x=>x.data));if(cmp.status!=='BOUNDED_MATCH')fail(`comparison: ${cmp.issues}`);
   const trustedTap=rows[0].data.scope==='trusted-dom-sdk-marker'?trusted?.byContract['Tmapv3.mapobject.Marker#on']?.platforms[rec.platform]:null;
   if(rows[0].data.scope==='trusted-dom-sdk-marker'&&trustedTap?.result.observation.markerId!==rows[0].data.markerId)fail('trusted tap marker identity mismatch');
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const id of contracts){const selected=rows.filter(x=>id.endsWith('#setMap')?x.data.id==='reattach':true);out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:selected.map(x=>({observation:x.data,ref:ref(x)})),...(trustedTap&&!id.endsWith('#setMap')?{trustedTap}:{})};}
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'managed-marker-events-observations-rejected',reason:String(error.message)}]};}
}
