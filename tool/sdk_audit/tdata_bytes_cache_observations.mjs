import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';

const BASELINE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-bytes-cache-integration-review.json',sha256:"11db6c18ebcd2c092b874e94f8562b3d4901b0e49906f8f975837a04ca859c59"};
const FILES=[
 ['lib/src/services/tdata_raw_service.dart','09b3eaf30b4851aba352df7506f41b9c13e17846e27b5e096f97970dff4b024e'],
 ['lib/src/services/tdata_request_session.dart','d3f37029250281de5a7ec39014c0fe25d88d56b5dab31fc80200fd36d49f45ac'],
 ['example/integration_test/tdata_response_bytes_contracts.dart','970c9162e185d667bff6619c1afe67c3376984951c16842c935789f29d68f9f8'],
 ['example/integration_test/tdata_cache_invalidation_contracts.dart','5384c0799d23cc937807116025816a1b13d409f936d3c1c8d89a34ba57322293'],
];
const PRIOR=[
 ['docs/sdk-audit/reviews/tdata-response-bytes-review.json','4969f338d16fb07a113ba73dfb6f3d14764f46e03b2b77f4a57bd192355205f5'],
 ['docs/sdk-audit/reviews/tdata-response-bytes-helper-review.json','b3881815c037e5e900f5809bc1a9e39220fd0dfd922a499cae9bcf090205b02f'],
 ['docs/sdk-audit/reviews/tdata-cache-invalidation-review.json','603b5d6c3afc7f3c20be40b3bd29d11bffd2d4bbd511952eceb5d892fb334ecb'],
];
const SCHEMAS={
 'raw-invalid-text':['status','headers','bytes','complete','decodeError','immutable'],
 'decode-error':['state','status','headers','bytes','complete','immutable'],
 'network-error':['state','noResponse'],
 'partial-cancel':['state','status','headers','prefix','incomplete','immutable'],
 'cache-copy':['oneRequest','cacheHit','jsonIndependent','bytes','headers','complete','immutable'],
 'clear-in-flight':['interveningSucceeded','oldCompleted','oldCallbackOnce','oldNotCached','freshCached','sendCount'],
 'dispose-in-flight':['cancelled','lateCallbackSuppressed','rejectsNewRequest'],
};
const GROUPS=[
 {name:'responseBytes',field:'tdataResponseBytesResults',marker:'TDATA RESPONSE BYTES RESULT:',ids:['raw-invalid-text','decode-error','network-error','partial-cancel','cache-copy']},
 {name:'cacheInvalidation',field:'tdataCacheInvalidationResults',marker:'TDATA CACHE INVALIDATION RESULT:',ids:['clear-in-flight','dispose-in-flight']},
];
const fail=message=>{throw Error(message);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const target=path.resolve(root,file);
 if(!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const data=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(data)!==digest)fail(`hash mismatch: ${file}`);return data;
}
function validateReview(root,current){
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 if(review.status!=='OPEN'||review.baselineId!==BASELINE||review.sdkSha256!==SDK)fail('review baseline mismatch');
 for(const [file,digest] of FILES){
  if(!review.files.some(x=>x.file===file&&x.sha256===digest))fail('review file binding');
  load(root,file,digest);
  if(file.startsWith('lib/')?current.libFingerprint.files[file]!==digest:!current.inputs.some(x=>x.file===file&&x.sha256===digest))fail('input file binding');
 }
 for(const [file,digest] of PRIOR){
  if(!review.priorReviews.some(x=>x.file===file&&x.sha256===digest))fail('prior review binding');
  load(root,file,digest);
 }
 load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK);
}
function checkRows(rows,ids){
 if(rows.length!==ids.length)fail('row count mismatch');
 for(let i=0;i<ids.length;i++){
  const r=rows[i].data,id=ids[i];
  if(!keys(r,['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==id||r.status!=='observed'||r.scope!=='synthetic-http-client-no-network'||!keys(r.checks,SCHEMAS[id])||Object.values(r.checks).some(x=>x!==true))fail('invalid result row');
 }
}
/** Bounded adapter observations only; never emits SDK contract statuses. */
export function collectTDataBytesCacheObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASELINE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or SDK mismatch');
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs mismatch');
  validateReview(root,current);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration record count');
  const observations=Object.fromEntries(GROUPS.map(g=>[g.name,{scope:'synthetic-http-client-no-network',review:REVIEW,platforms:{}}]));
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid platform record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n');
   const run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid run status');
   const {sanitizedLogSha256,...rawRun}=run;
   validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('missing success marker');
   for(const group of GROUPS){
    const rows=parsePlatformMarkerRows(lines,group.marker);
    if(!same(rows.map(x=>x.data),rec[group.field]))fail('log/record mismatch');
    checkRows(rows,group.ids);
    observations[group.name].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
   }
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-bytes-cache-observations-rejected',reason:String(error.message)}]};}
}
