import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults,platformJsonMarkers} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const SDK_FILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const HELPER=['example/integration_test/sdk_native_startup_invocation_contracts.dart','40301829439a04d780fa93ae14a0d947dac62b3d5e8bbc19502c50499df801fc'];
const REVIEW=['docs/sdk-audit/reviews/sdk-native-startup-invocation-source-review.json',"045edeb9984863eaec114c9957b95649c2d8fcbc2c4e557e98cfd38a7bc9f49b"];
const FIELD='sdkStartupInvocationResults', MARKER='SDK STARTUP INVOCATION RESULT:';
const sourceIds=['Tmapv3.Map#on','Vsm.Map#on','Vsm.StyleManager#Ho','Vsm.StyleManager#loadStyle'];
const reviewFiles=['lib/src/models/sdk_native_events.dart','lib/src/models/sdk_native_startup_events.dart','lib/src/js/js_map_init.dart','lib/src/web/bridge_scripts/lifecycle.dart','lib/src/js/js_native_events.dart','test/sdk_native_startup_invocation_test.dart','test/sdk_native_startup_invocation_bridge_test.mjs',HELPER[0]];
const expectedOrder=['StyleLoad-a','StyleLoad-b','ConfigLoad-a','ConfigLoad-b'];
const expectedChecks=['order',...Array.from({length:4},(_,i)=>['receiver','event','name','target','data','data-identity'].map(x=>`${i}-${x}`)).flat(),'style-event-identity','config-event-identity'];
const fail=message=>{throw Error(message)};
function checked(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid reference path');
 const target=path.resolve(root,file);if(!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('reference escapes root');
 const bytes=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`reference digest: ${file}`);return bytes;
}

/** Check the fixed SDK spans and exact implementation/fixture source pins. */
export function validateSdkStartupInvocationReferences({root=ROOT,current}={}){
 const sdk=checked(root,SDK_FILE,SDK).toString('utf8');checked(root,...HELPER);
 const review=JSON.parse(checked(root,...REVIEW));
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||review.marker!==MARKER)fail('review metadata');
 if(!Array.isArray(review.files)||review.files.length!==reviewFiles.length||reviewFiles.some(f=>review.files.filter(x=>x.file===f).length!==1))fail('review file set');
 for(const entry of review.files){checked(root,entry.file,entry.sha256);if(entry.file.startsWith('lib/')&&current&&current.libFingerprint.files[entry.file]!==entry.sha256)fail('current library source binding');}
 if(!review.files.some(x=>same(x,{file:HELPER[0],sha256:HELPER[1]})))fail('helper review binding');
 if(current&&!current.inputs.some(x=>same(x,{file:HELPER[0],sha256:HELPER[1]})))fail('helper absent from platform inputs');
 if(!Array.isArray(review.sources)||!same(review.sources.map(x=>x.id).sort(),[...sourceIds].sort()))fail('review source set');
 for(const item of review.sources){
  if(item.file!==SDK_FILE||item.sha256!==SDK||!Number.isSafeInteger(item.start)||!Number.isSafeInteger(item.end)||item.start<0||item.end<=item.start||sdk.slice(item.start,item.end)!==item.excerpt||sha(item.excerpt)!==item.sourceTextSha256)fail(`SDK source span: ${item.id}`);
 }
 return true;
}

/** Validate one helper row; this does not assert unobserved SDK behavior. */
export function validateSdkStartupInvocationRow(row){
 if(!row||typeof row!=='object'||Array.isArray(row)||!same(Object.keys(row).sort(),['checks','order','passed','scope']))fail('observation shape');
 if(row.scope!=='real-sdk-initial-events'||row.passed!==true||!same(row.order,expectedOrder))fail('startup event scope or ordering');
 if(!row.checks||typeof row.checks!=='object'||Array.isArray(row.checks)||!same(Object.keys(row.checks).sort(),[...expectedChecks].sort()))fail('startup check set');
 if(expectedChecks.some(key=>row.checks[key]!==true))fail('startup invocation mismatch');
 return true;
}

/** Observations remain bounded; no contract status is promoted. */
export function collectSdkNativeStartupInvocationObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(platformJsonMarkers[FIELD]!==MARKER)fail('startup invocation marker registry unavailable');
  const evidence=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or SDK mismatch');
  if(!evidence||!same(evidence.libFingerprint,libFingerprint))fail('platform fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:evidence.inputs}))fail('current platform inputs mismatch');
  validateSdkStartupInvocationReferences({root,current});
  const records=Array.isArray(evidence.records)?evidence.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration record set');
  const item={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},scope:'Two initial SDK engine event names, two once invocation listeners each; selected receiver, argument, capture and handle identities.',limitations:['Constructor-synchronous events before bridge installation cannot be observed or replayed.','Captured native objects remain live handles, not deep snapshots.','Asynchronous Dart callback results cannot control an earlier synchronous SDK default decision.','The helper reports selected checks and does not measure the loaded SDK bytes, complete Map.on/off, Vsm.Event or all startup events.'],platforms:{}};
  for(const rec of records){
   const file=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==file||rec.run?.file!==file+'.run.json')fail('invalid integration record');
   const log=checked(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(checked(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const status=parsePlatformTextResults(lines);if(rec.platform==='web'?!status.webPassed:!status.mobilePassed)fail('missing successful completion');
   const rows=lines.flatMap((line,index)=>{const decoded=decodePlatformLogLine(line);return decoded?.kind==='json'&&decoded.field===FIELD?[{data:JSON.parse(decoded.payload),line:index+1}]:[];});
   if(rows.length!==1||!same(rows.map(x=>x.data),rec[FIELD]))fail('missing, duplicate or altered startup invocation row');
   validateSdkStartupInvocationRow(rows[0].data);
   const row=rows[0];item.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,observation:row.data,ref:{file:rec.file,sha256:rec.sha256,line:row.line,logLineSha256:sha(lines[row.line-1]),observationSha256:sha(JSON.stringify(row.data))}};
  }
  return {byContract:{'Vsm.Map#on':item},issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-native-startup-invocation-observations-rejected',reason:String(error.message)}]};}
}
