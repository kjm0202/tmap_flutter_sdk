import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';import {parsePlatformMarkerRows,platformLogPassed,platformJsonMarkers} from './platform_log_markers.mjs';
import {TDATA_METHODS,observeTDataCallbackRelations} from './tdata_callback_relation_source_probe.mjs';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714',SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-callback-relation-source-review.json',sha256:"488f73f93d8d8711a502385041f106e2c882fd5c8f6fb9381f627944adb7f0bf"};
const MARKER='TDATA CALLBACK RELATION RESULT:',FIELD='tdataCallbackRelationResults',HELPER='example/integration_test/tdata_callback_relation_contracts.dart';
const fail=x=>{throw Error(x)};const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');const bytes=fs.readFileSync(p);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;}
/** Source structure and prior reviewed bridge composition, not full parity. */
export function verifyTDataCallbackRelationSources({root=ROOT,manifest,current}){
 if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));if(review.status!=='SOURCE_REVIEW_ONLY'||review.baselineId!==BASE||review.sdkSha256!==SDK)fail('review binding');
 const files=['lib/src/models/sdk_tdata_native.dart','lib/src/models/sdk_native_events.dart','lib/src/js/js_native_events.dart','lib/src/js/js_tdata_native_snapshot.dart','lib/src/models/sdk_xml_native.dart',HELPER,'test/tdata_callback_relation_helper_test.dart','test/tdata_callback_relation_fixture_test.mjs','tool/sdk_audit/tdata_callback_relation_source_probe.mjs','tool/sdk_audit/test/tdata_callback_relation_source_probe.test.mjs'];
 if(!review.files||!same(Object.keys(review.files).sort(),files.sort()))fail('review files');
 for(const file of files){load(root,file,review.files[file]);if(file.startsWith('lib/')&&current?.libFingerprint?.files?.[file]!==review.files[file])fail('library input mismatch');}
 if(!current?.inputs?.some(x=>x.file===HELPER&&x.sha256===review.files[HELPER]))fail('helper input mismatch');
 const spanNames=['facadeInvoke','handleCall','dartCall','codecEncode','jsCall'];if(!same(Object.keys(review.bridgeSpans||{}),spanNames))fail('bridge spans');for(const item of Object.values(review.bridgeSpans)){if(!review.files[item.file]||!Number.isInteger(item.start)||!Number.isInteger(item.end)||item.start<0||item.end<=item.start)fail('invalid bridge span');const body=fs.readFileSync(path.join(root,item.file),'utf8');if(sha(body.slice(item.start,item.end))!==item.sha256)fail('bridge span digest');}
 if(!Array.isArray(review.priorReviews)||review.priorReviews.length!==5)fail('prior reviews');for(const r of review.priorReviews)load(root,r.file,r.sha256);
 const source=observeTDataCallbackRelations(root);if(!same(source.namespace,review.namespace)||review.methods.length!==28)fail('source namespace');
 const ids=new Set();for(let i=0;i<source.methods.length;i++){const {contractId,contractStatusAtReview,...method}=review.methods[i];if(!same(method,source.methods[i])||!/^U111-[a-f0-9]{16}$/.test(contractId)||contractStatusAtReview!=='OPEN'||ids.has(contractId))fail('source method relation');ids.add(contractId);}
 return true;
}
/** Exact rows show function identity and arity only, not invocation behavior. */
export function validateTDataCallbackRelationRows(rows){
 if(!Array.isArray(rows)||rows.length!==TDATA_METHODS.length)fail('row count');
 for(let i=0;i<TDATA_METHODS.length;i++){const [id,arity]=TDATA_METHODS[i],r=rows[i];if(!keys(r,['schemaVersion','id','status','scope','arity','callbackIndex','sameFunction','directPrototype','noOwnOverride'])||r.schemaVersion!==1||r.id!==id||r.status!=='observed'||r.scope!=='sdk-instance-prototype-no-network'||r.arity!==arity||r.callbackIndex!==arity-1||r.sameFunction!==true||r.directPrototype!==true||r.noOwnOverride!==true)fail('invalid method observation');}
 return true;
}
/** Candidate bounded evidence only; never promotes contract statuses. */
export function collectTDataCallbackRelationObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');verifyTDataCallbackRelationSources({root,manifest,current});
  if(platformJsonMarkers[FIELD]!==MARKER)fail('production marker registration pending');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'sdk-instance-prototype-no-network',review:REVIEW,platforms:{}};
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,MARKER);if(!same(rows.map(x=>x.data),rec[FIELD]))fail('record/log mismatch');validateTDataCallbackRelationRows(rows.map(x=>x.data));
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-callback-relation-observations-rejected',reason:String(error.message)}]};}
}
