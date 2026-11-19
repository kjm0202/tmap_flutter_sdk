import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/native_event_invocation_contracts.dart',HELPER_SHA='5b932edf37f4e57950fc032e22d6f52672808d6d58770b57abd45caeb4f5d3cb';
const REVIEW='docs/sdk-audit/reviews/native-event-invocation-source-review.json',REVIEW_SHA='9c061971dfe077423cb3c9a485930a03615ee43a2b544d64614395f16e0e1bd9';
const SDKFILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const ids=['engine-empty','engine-multiple','engine-standard','wrapper-bare-call','engine-once','engine-cancel'];
export function verifyNativeEventInvocationReferences(root=ROOT){
 const read=(file,digest)=>{const bytes=fs.readFileSync(path.join(root,file));if(sha(bytes)!==digest)throw Error(`reference digest: ${file}`);return bytes;};
 read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDKFILE,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(review.sources.map(x=>x.name),['emitter','emitterExport','engineOnEmit','wrapperOn','wrapperOff','wrapperSpecialDispatch']))throw Error('review metadata');
 for(const x of review.sources)if(x.file!==SDKFILE||x.sha256!==SDK||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error(`source span: ${x.name}`);
 const files=['lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart','test/native_event_invocation_bridge_test.mjs','test/sdk_native_event_invocation_test.dart',HELPER];
 if(!same(review.files.map(x=>x.file),files)||!same(review.priorReports.map(x=>x.file),['docs/sdk-audit/reviews/native-sdk-events-source-review.json','docs/sdk-audit/reviews/event-snapshot-source-review.json']))throw Error('review file set');
 for(const x of [...review.files,...review.priorReports])read(x.file,x.sha256);
}
export function compareNativeEventInvocationRows(rows){
 if(!Array.isArray(rows)||rows.length!==ids.length)return {status:'MISMATCH',issues:['case count']};
 const issues=[];for(let i=0;i<ids.length;i++)if(!same(rows[i],{id:ids[i],passed:true,scope:'synthetic-sdk-emitter'}))issues.push(`case: ${ids[i]}`);
 return {status:issues.length?'MISMATCH':'BOUNDED_MATCH',issues};
}
export function collectNativeEventInvocationObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK)||!ev||!same(ev.libFingerprint,libFingerprint))fail('baseline or fingerprint');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');verifyNativeEventInvocationReferences(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform record set');
  const contracts=['Vsm.Map#on','Tmapv3.Map#on'],out=Object.fromEntries(contracts.map(id=>[id,{status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['All emitted events are synthetic; mr is an internal SDK emitter, not a documented public API.','Receiver is that of the strict bridge callback; non-strict bare callbacks can coerce undefined to globalThis.','Dart callbacks are asynchronous; return values, exceptions and preventDefault do not synchronously propagate to native dispatch.','These cases do not establish all Map.on/off or physical gesture behavior.'],platforms:{}}]));
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('integration record');
   const load=(file,digest)=>{const bytes=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail('log or run digest');return bytes.toString('utf8');};
   const lines=load(rec.file,rec.sha256).split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const done=parsePlatformTextResults(lines);if(rec.platform==='web'?!done.webPassed:!done.mobilePassed)fail('completion marker');
   const rows=lines.flatMap((line,index)=>{const decoded=decodePlatformLogLine(line);return decoded?.kind==='json'&&decoded.field==='nativeEventInvocationResults'?[{data:JSON.parse(decoded.payload),line:index+1}]:[];});
   if(!same(rows.map(x=>x.data),rec.nativeEventInvocationResults))fail('log observation binding');
   const cmp=compareNativeEventInvocationRows(rows.map(x=>x.data));if(cmp.status!=='BOUNDED_MATCH')fail(`comparison: ${cmp.issues}`);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const id of contracts){const selected=rows.filter(x=>id==='Tmapv3.Map#on'?x.data.id==='wrapper-bare-call':x.data.id!=='wrapper-bare-call');out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:selected.map(x=>({observation:x.data,ref:ref(x)}))};}
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'native-event-invocation-observations-rejected',reason:String(error.message)}]};}
}
