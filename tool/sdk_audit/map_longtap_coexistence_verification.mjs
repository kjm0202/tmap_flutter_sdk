import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/map_longtap_coexistence_contracts.dart';
const REVIEW=['docs/sdk-audit/reviews/map-longtap-coexistence-observation-review.json',"607e4edd9566130832eab695b72b75fb996c3d149d6a06c5f04ff1209fa3f1d9"];
const SPANS={longTapRecognizer:[520558,521354,'916090b60c8d147a72ab8183c274410a8b21574e68eeeeb0d967855d92cbe27c'],touchEvent:[497584,497860,'aaf2869e65ebaba3fdc72510c596a5115a88c907a4cee2ba87d4eeded6074213'],mapOn:[1261195,1261703,'c2e06fa64ec3dc4d91d83a8eb36d9987705bf54ce63c3c373d8335a2a1b4741e'],engineEmit:[708964,709007,'c89f37428d40f1709d427301a15ae425cf86c28523e73bede151b77ac70c5b2c'],contextMenuMouseup:[528850,529180,'78ba265d7047b15b8ae8e67c19206b5e6a8ae7e9421f5093f394d7574db30882']};
const fail=message=>{throw Error(message);};
const keys=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&same(Object.keys(x).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const target=path.resolve(root,file);if(!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(target);if(!/^[0-9a-f]{64}$/.test(digest||'')||sha(bytes)!==digest)fail('source or evidence hash mismatch: '+file);return bytes.toString('utf8');
}
function checkSources(root,current){
 const review=JSON.parse(load(root,...REVIEW));
 if(review.status!=='SOURCE_AND_HOST_TESTED_LIVE_PENDING_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(review.spans,SPANS))fail('source review mismatch');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK);
 for(const [name,[start,end,digest]] of Object.entries(SPANS))if(sha(sdk.slice(start,end))!==digest)fail('SDK span mismatch: '+name);
 if(!Array.isArray(review.files)||new Set(review.files.map(x=>x.file)).size!==review.files.length)fail('review files mismatch');
 for(const x of review.files){load(root,x.file,x.sha256);if(x.file.startsWith('lib/')&&current.libFingerprint.files[x.file]!==x.sha256)fail('library source not bound');}
 const helper=review.files.find(x=>x.file===HELPER);
 if(!helper||!current.inputs.some(x=>x.file===HELPER&&x.sha256===helper.sha256))fail('helper not bound to current inputs');
 return helper;
}
function checkResult(result){
 const names=['LongTap','ContextMenu'],checks=['typedFirst','nativeCapturesAndTarget','typedAfterCancel','nativeSuppressedAfterCancel','foreignPreserved'];
 if(!keys(result,['scope','names','checks','passed'])||result.scope!=='synthetic-sdk-engine-emission'||!same(result.names,names)||result.passed!==true||!keys(result.checks,checks)||checks.some(k=>result.checks[k]!==true))fail('invalid long-tap coexistence result');
}
/** Selected synthetic engine events; this never changes contract status. */
export function collectMapLongTapCoexistenceObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or SDK mismatch');
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current input mismatch');
  const fixture=checkSources(root,current),records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate platform runs');
  const common={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,fixture,sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations:['Both inputs are synthetic SDK engine emissions, not real or physical long-press/context-menu events.','The target is explicitly set to the engine in this fixture; other target values and lifetime are not established.','The foreign listener is checked by count, not by its full payload.','Selected callbacks do not prove all Map.on/off, Vsm.Event or evt.target behavior.','Loaded SDK bytes and native callback timing are not measured.']};
  const out={'Tmapv3.Map#on':{...common,scope:'Two synthetic events reach the typed callback before and after cancellation of engine subscriptions.',platforms:{}},'Vsm.Map#on':{...common,scope:'Two synthetic events reach engine invocation subscriptions, with selected captures and explicitly supplied engine target; cancellation suppresses later delivery while a foreign listener count increases.',platforms:{}}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=load(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const status=parsePlatformTextResults(lines);if(!(rec.platform==='web'?status.webPassed:status.mobilePassed))fail('integration completion marker');
   const rows=lines.flatMap((line,i)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.marker==='MAP LONG TAP COEXISTENCE RESULT:'?[{data:JSON.parse(row.payload),line:i+1}]:[];});
   if(rows.length!==1||!same(rows.map(x=>x.data),rec.mapLongTapCoexistenceResults))fail('missing, duplicated or altered observation');
   const row=rows[0];checkResult(row.data);
   const resultRef={file:rec.file,sha256:rec.sha256,line:row.line,logLineSha256:sha(lines[row.line-1]),observationSha256:sha(JSON.stringify(row.data))};
   for(const value of Object.values(out))value.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,resultRef,observation:row.data};
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'map-longtap-coexistence-observations-rejected',reason:String(error.message)}]};}
}
