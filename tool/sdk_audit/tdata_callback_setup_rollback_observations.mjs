import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed,platformJsonMarkers} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-callback-setup-rollback-observation-review.json',sha256:'d2cb1ffb0f22ee6f0c2879895fa2de2691f17bf87ad22ed26f982444d6e80c23'};
const MARKER='TDATA CALLBACK SETUP ROLLBACK RESULT:',FIELD='tdataCallbackSetupRollbackResults';
const INPUTS=['lib/src/models/sdk_tdata_native.dart','example/integration_test/tdata_callback_setup_rollback_contracts.dart'];
const IDS=['ordinary','snapshot'];
const CHECKS=[['allLocalCallbacksClosed','cleanupRetry','setupErrorIdentity','cleanupErrorIdentity'],['allLocalCallbacksClosed','cleanupRetry','setupErrorIdentity','cleanupErrorIdentity']];
const fail=x=>{throw Error(x);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(p);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;
}
/** Validate source pins independently of runtime or marker registration. */
export function verifyTDataCallbackSetupRollbackSources({root=ROOT,manifest,current}){
 if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||!review.files||Array.isArray(review.files))fail('review binding');
 const files=['lib/src/models/sdk_tdata_native.dart','test/tdata_callback_setup_rollback_test.dart','test/tdata_callback_setup_rollback_helper_test.dart','example/integration_test/tdata_callback_setup_rollback_contracts.dart'];
 if(!same(Object.keys(review.files).sort(),files.sort()))fail('review files');
 for(const file of files)load(root,file,review.files[file]);
 for(const f of INPUTS){const digest=review.files[f];if(f.startsWith('lib/')?current?.libFingerprint?.files?.[f]!==digest:!current?.inputs?.some(x=>x.file===f&&x.sha256===digest))fail('current input mismatch');}
 const sourceReview=JSON.parse(load(root,review.sourceReview?.file,review.sourceReview?.sha256));
 if(review.sourceReview.file!=='docs/sdk-audit/reviews/tdata-callback-setup-rollback-review.json'||sourceReview.sdk?.sha256!==SDK||!same(sourceReview.files,review.files))fail('source review mismatch');
 if(sourceReview.helper?.marker!==MARKER||sourceReview.helper?.scope!=='synthetic-bridge-no-network'||!same(sourceReview.helper?.cases,IDS))fail('helper review mismatch');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 const spans=[['xmlCallbackDispatcher',987296,988116,'42d3cebfaad4ebbbc26cfabea2ef96061c6c630d9251b321da7df81c0917d148'],['jsonCallbackDispatcher',988128,988441,'1b1119aac762273ac8b2fc96255531430435567006f1fd357f9d9ee1ab35e772'],['geocodingXml',991405,992187,'b8615ec20e442b6c86870b574a9441935065055d4b57bc7063fd5e2a25c1eb72'],['geocodingJson',992188,992999,'f1e03a433f39b2db4c9a22a54425f312b98cc6a53ad4d68889419bb9c60b1b45']];
 if(!same(sourceReview.sdk.spans,spans.map(([name,start,end,excerptSha256])=>({name,start,end,excerptSha256}))))fail('SDK span list');
 for(const [,start,end,digest] of spans)if(sha(sdk.slice(start,end))!==digest)fail('SDK span mismatch');
 return true;
}
/** Validate rows independently of logs. Synthetic test rows are not evidence. */
export function validateTDataCallbackSetupRollbackRows(rows){
 if(!Array.isArray(rows)||rows.length!==IDS.length)fail('row count');
 for(let i=0;i<IDS.length;i++){const r=rows[i];if(!keys(r,['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==IDS[i]||r.status!=='observed'||r.scope!=='synthetic-bridge-no-network'||!keys(r.checks,CHECKS[i])||Object.values(r.checks).some(x=>x!==true))fail('invalid observation');}
 return true;
}
/** Synthetic bridge observations only; no SDK contract status promotion. */
export function collectTDataCallbackSetupRollbackObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');verifyTDataCallbackSetupRollbackSources({root,manifest,current});
  if(platformJsonMarkers[FIELD]!==MARKER)fail('production marker registration pending');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'synthetic-bridge-no-network',review:REVIEW,platforms:{}};
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n');const run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,MARKER);if(!same(rows.map(x=>x.data),rec[FIELD]))fail('record/log mismatch');validateTDataCallbackSetupRollbackRows(rows.map(x=>x.data));
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-callback-setup-rollback-observations-rejected',reason:String(error.message)}]};}
}
