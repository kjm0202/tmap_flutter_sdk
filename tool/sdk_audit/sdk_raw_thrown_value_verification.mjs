import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT, sha} from './common.mjs';
import {capturePlatformInputs, validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine, parsePlatformTextResults, platformJsonMarkers} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const HELPER='example/integration_test/sdk_raw_thrown_value_contracts.dart';
const HELPER_SHA='60d17dbb0de8b6efd132afcc515cc7bd8dc20ab114c567833214c13b9d7392ec';
const REVIEW='docs/sdk-audit/reviews/sdk-raw-thrown-value-source-review.json';
const REVIEW_SHA="3eba9f31cc33aba9338eabcfc897d58c386017272a6b1c9a065240d5dc2bfbe7";
const FIELD='sdkRawThrownValueResults', MARKER='SDK RAW THROWN VALUE RESULT:';
const keys=['getter-identity','setter-identity','constructor-identity','operations-called-once','object-identity','no-diagnostics','legacy-diagnostics','primitive-undefined','primitive-null','primitive-negativeZero','primitive-nan','primitive-infinity','primitive-bigint','primitive-symbol'];
const fail=message=>{throw Error(message);};
const ownKeys=(x,names)=>x && typeof x==='object' && !Array.isArray(x) && same(Object.keys(x).sort(),[...names].sort());
const counts=(name,primitive,stack)=>({name,primitive,stack});

/** A fixture comparison only: accepting a row is not platform evidence. */
export function compareSdkRawThrownValueRows(rows){
 const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
 const valid=ownKeys(row,['scope','checks','calls','afterPreserved','afterLegacy','passed']) && row.scope==='synthetic-name-real-sdk-map-on' && row.passed===true && ownKeys(row.checks,keys) && keys.every(k=>row.checks[k]===true) && same(row.calls,{getter:1,setter:1,constructor:1}) && same(row.afterPreserved,counts(0,0,0)) && same(row.afterLegacy,counts(1,1,1));
 return valid?{status:'BOUNDED_MATCH',issues:[]}:{status:'MISMATCH',issues:['raw thrown value row']};
}
function read(root,file,digest){
 if(!/^[a-f0-9]{64}$/.test(digest||'')||path.isAbsolute(file))fail('invalid reference');
 const full=path.resolve(root,file),base=fs.realpathSync(root)+path.sep;
 if(!full.startsWith(path.resolve(root)+path.sep)||!fs.realpathSync(full).startsWith(base))fail('reference path escapes root');
 const data=fs.readFileSync(full);if(sha(data)!==digest)fail('reference digest: '+file);return data;
}
export function verifySdkRawThrownValueReferences(root=ROOT){
 read(root,HELPER,HELPER_SHA);
 const review=JSON.parse(read(root,REVIEW,REVIEW_SHA));
 const sdkFile=`tool/sdk_audit/.cache/sources/${SDK}`,sdk=read(root,sdkFile,SDK).toString('utf8');
 if(review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||review.status!=='SOURCE_AND_FOCUSED_TESTED_LIVE_PENDING_OPEN')fail('review metadata');
 const spans=[['wrapperOn',1261195,1261703],['wrapperOff',1261704,1261994],['eventBase',496893,497022],['eventSubclass',497022,497271]];
 if(!Array.isArray(review.source)||review.source.length!==spans.length)fail('source spans');
 for(const [i,[name,start,end]] of spans.entries()){const x=review.source[i];if(x.name!==name||x.file!==sdkFile||x.start!==start||x.end!==end||sha(sdk.slice(start,end))!==x.sourceTextSha256)fail('source span: '+name);}
 const files=['lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart',HELPER,'test/sdk_raw_thrown_value_bridge_test.mjs','test/sdk_raw_thrown_value_test.dart'];
 if(!same(review.files.map(x=>x.file),files)||!review.files.some(x=>x.file===HELPER&&x.sha256===HELPER_SHA))fail('review files');
 for(const x of review.files)read(root,x.file,x.sha256);
 return true;
}
/** Requires real production registry, three successful independent runs, and current source binding. */
export function collectSdkRawThrownValueObservations({runtime,manifest,libFingerprint,root=ROOT}={}){
 try{
  if(platformJsonMarkers[FIELD]!==MARKER)fail('production raw-thrown marker not registered');
  const ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK)||!ev||!same(ev.libFingerprint,libFingerprint))fail('baseline or fingerprint');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');
  verifySdkRawThrownValueReferences(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform records');
  const item={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['Synthetic throwing values are passed to the real SDK Map.on; this is not physical input.','Opt-in error values are asynchronous, owner-scoped and are not raw JavaScript throw/catch.','No full Map.on or Vsm.Event parity is established.'],platforms:{}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('integration record');
   const log=read(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(read(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const done=parsePlatformTextResults(lines);if(rec.platform==='web'?!done.webPassed:!done.mobilePassed)fail('completion marker');
   const rows=lines.flatMap((line,index)=>{const value=decodePlatformLogLine(line);return value?.kind==='json'&&value.field===FIELD?[{data:JSON.parse(value.payload),line:index+1}]:[];});
   if(!same(rows.map(x=>x.data),rec[FIELD])||compareSdkRawThrownValueRows(rows.map(x=>x.data)).status!=='BOUNDED_MATCH')fail('log row binding');
   const x=rows[0];item.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}};
  }
  return {byContract:{'Tmapv3.Map#on':item},issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-raw-thrown-value-observations-rejected',reason:String(error.message)}]};}
}
