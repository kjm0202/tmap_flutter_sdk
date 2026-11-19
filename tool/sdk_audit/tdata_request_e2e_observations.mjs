import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {platformJsonMarkers,parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
import {TDATA_METHODS,observeTDataCallbackRelations} from './tdata_callback_relation_source_probe.mjs';
import {probeTDataRequestBehavior} from './tdata_request_behavior_source_probe.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-request-e2e-observation-review.json',sha256:'4bf34ae50762b8a2ec436be1b7b9cffac530d945e760ecb1e3ece8375a580d1c'};
const HELPER='example/integration_test/tdata_request_e2e_contracts.dart';
const FIELD='tdataRequestE2eResults',MARKER='TDATA REQUEST E2E RESULT:';
const IDS=[...TDATA_METHODS.map(x=>x[0]),'xml-error-native','dart-callbacks','debounce-cache'];
const METHOD_CHECKS=['originalMethod','requestAndOptions','nativeSyncCallbacks','restored','responseShape'];
const EXTRA_CHECKS={
 'xml-error-native':['originalMethod','nativeErrorIdentity','restored'],
 'dart-callbacks':['progressAndComplete','receiverAndArgument','restored'],
 'debounce-cache':['sharedTimers','delayedOptions','sourceCacheError','restored'],
};
const fail=x=>{throw Error(x);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(p);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;
}
/** Original source relationship plus bounded VM fixture; no parity promotion. */
export function verifyTDataRequestE2eSources({root=ROOT,manifest,current}){
 if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK)fail('review binding');
 const expected=['lib/src/models/sdk_tdata_native.dart','lib/src/models/sdk_native_events.dart','lib/src/js/js_native_events.dart',HELPER,'tool/sdk_audit/test/tdata_request_e2e_fixture.test.mjs','tool/sdk_audit/tdata_request_behavior_source_probe.mjs','tool/sdk_audit/tdata_callback_relation_source_probe.mjs','test/tdata_request_relation_transport_test.dart','test/tdata_request_e2e_xml_error_test.dart','test/fixtures/tdata_request_e2e_xml_error.json'];
 if(!review.files||!same(Object.keys(review.files).sort(),expected.sort()))fail('source list');
 for(const file of expected){load(root,file,review.files[file]);if(file.startsWith('lib/')&&current?.libFingerprint?.files?.[file]!==review.files[file])fail('library input mismatch');}
 if(!current?.inputs?.some(x=>x.file===HELPER&&x.sha256===review.files[HELPER]))fail('helper input mismatch');
 if(review.priorReview?.file!=='docs/sdk-audit/reviews/tdata-request-behavior-relation-review.json')fail('prior review path');
 const prior=JSON.parse(load(root,review.priorReview.file,review.priorReview.sha256));
 load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK);
 const relation=observeTDataCallbackRelations(root),behavior=probeTDataRequestBehavior(root);
 if(!same(prior.sdk?.namespace,relation.namespace)||!same(prior.sdk?.methods,relation.methods)||!same(prior.sourceSyntax,behavior.syntax)||!same(prior.sourceVmFixture?.methodCases,behavior.methods)||!same(prior.sourceVmFixture?.additionalBranches,behavior.branches))fail('source relationship mismatch');
 if(!same(review.methods,prior.candidateMethods)||review.methods.length!==28||new Set(review.methods.map(x=>x.id)).size!==28||!review.methods.every((x,i)=>/^U111-[a-f0-9]{16}$/.test(x.id)&&x.api===`Tmapv3.extension.TData#${TDATA_METHODS[i][0]}`))fail('contract set mismatch');
 if(review.helper?.file!==HELPER||review.helper?.field!==FIELD||review.helper?.marker!==MARKER||!same(review.helper?.cases,IDS))fail('helper review mismatch');
 return true;
}
/** Exact bounded rows. Fixture records are synthetic, never status proof. */
export function validateTDataRequestE2eRows(rows){
 if(!Array.isArray(rows)||rows.length!==IDS.length)fail('row count');
 for(let i=0;i<IDS.length;i++){
  const r=rows[i],id=IDS[i],checks=EXTRA_CHECKS[id]||METHOD_CHECKS,scope=id==='debounce-cache'?'sdk-instance-synthetic-timers-xhr-no-network':'actual-sdk-facade-synthetic-xhr-no-network';
  if(!keys(r,['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==id||r.status!=='observed'||r.scope!==scope||!keys(r.checks,checks)||Object.values(r.checks).some(x=>x!==true))fail('invalid observation');
 }
 return true;
}
/** Requires one current, successful integration run per platform. */
export function collectTDataRequestE2eObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');verifyTDataRequestE2eSources({root,manifest,current});
  if(platformJsonMarkers[FIELD]!==MARKER)fail('production marker registration pending');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'bounded-sdk-instance-facade-synthetic-xhr-no-network',review:REVIEW,platforms:{}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;
   validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,MARKER);if(!same(rows.map(x=>x.data),rec[FIELD]))fail('record/log mismatch');validateTDataRequestE2eRows(rows.map(x=>x.data));
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-request-e2e-observations-rejected',reason:String(error.message)}]};}
}
