import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/sdk_wrapper_detach_contracts.dart',HELPER_SHA='071405bdd3c58d2a2ebbd4a60bf7ed0cff49403d6b7db457ee5342a9ac9e3453',REVIEW='docs/sdk-audit/reviews/sdk-wrapper-detach-source-review.json',REVIEW_SHA="c9bc4fffcacca8d4cb89c2a9799d2832749d46aa1f4ceca30bed1c51cea5ed98",SDKFILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const expected=[
 {id:'special-cancel',passed:true,scope:'synthetic-sdk-wrapper',capture:'captured',added:true,othersPreserved:true},
 {id:'normal-receiver',passed:true,scope:'synthetic-sdk-wrapper',capture:'captured',receiverUndefined:true,argumentIdentity:true,targetIdentity:true,shimCreated:true,otherOrder:['a','b']},
 {id:'normal-cancel',passed:true,scope:'synthetic-sdk-wrapper',othersPreserved:true,delivered:1,otherOrder:['a','b','a','b']},
 {id:'reentrant-once',passed:true,scope:'synthetic-sdk-wrapper',capture:'captured',delivered:1,otherOrder:['a','once','a','b','b'],remaining:2,othersPreserved:true},
 {id:'once-cleanup',passed:true,scope:'synthetic-sdk-wrapper',capture:'captured',delivered:1,remaining:0}
];
export function verifySdkWrapperDetachReferences(root=ROOT){
 const read=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(sha(b)!==digest)throw Error(`reference digest: ${file}`);return b;};
 read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDKFILE,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(review.sources.map(x=>x.name),['wrapperOn','wrapperOff','specialDispatch','engineMethods','emitterListeners','emitterEmit','emitterRemove']))throw Error('review metadata');
 for(const x of review.sources)if(x.file!==SDKFILE||x.sha256!==SDK||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error(`source span: ${x.name}`);
 const files=['lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart','test/sdk_wrapper_detach_bridge_test.mjs','test/sdk_wrapper_detach_test.dart',HELPER];
 if(!same(review.files.map(x=>x.file),files)||!same(review.priorReports.map(x=>x.file),['docs/sdk-audit/reviews/native-sdk-events-source-review.json','docs/sdk-audit/reviews/native-event-invocation-source-review.json','docs/sdk-audit/reviews/event-snapshot-source-review.json']))throw Error('review file set');
 for(const x of [...review.files,...review.priorReports])read(x.file,x.sha256);
}
export function compareSdkWrapperDetachRows(rows){return same(rows,expected)?{status:'BOUNDED_MATCH',issues:[]}:{status:'MISMATCH',issues:['invalid cases or evidence']};}
export function collectSdkWrapperDetachObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK)||!ev||!same(ev.libFingerprint,libFingerprint))fail('baseline or fingerprint');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');verifySdkWrapperDetachReferences(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform record set');
  const observation={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['Only explicit opt-in wrapper cleanup is observed; default inert cancellation and raw Map.off semantics remain separate.','Capture status confirms initial callable/identity checks; physical cleanup remains best effort after later structural or scheduler changes.','Synthetic SDK events do not establish physical gesture or complete Map.on/off parity.'],platforms:{}};
  for(const rec of records){const expectedFile=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expectedFile||rec.run?.file!==rec.file+'.run.json')fail('integration record');
   const load=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('log or run digest');return b.toString('utf8');};
   const lines=load(rec.file,rec.sha256).split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});const done=parsePlatformTextResults(lines);if(rec.platform==='web'?!done.webPassed:!done.mobilePassed)fail('completion marker');
   const rows=lines.flatMap((line,index)=>{const v=decodePlatformLogLine(line);return v?.kind==='json'&&v.field==='sdkWrapperDetachResults'?[{data:JSON.parse(v.payload),line:index+1}]:[];});
   if(!same(rows.map(x=>x.data),rec.sdkWrapperDetachResults))fail('log observation binding');if(compareSdkWrapperDetachRows(rows.map(x=>x.data)).status!=='BOUNDED_MATCH')fail('invalid cases');
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});observation.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:ref(x)}))};
  }return {byContract:{'Tmapv3.Map#on':observation},issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-wrapper-detach-observations-rejected',reason:String(error.message)}]};}
}
