import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {observeTDataXhrFactoryThrow} from './tdata_xhr_factory_throw_probe.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed,platformJsonMarkers} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-client-factory-classification-review.json',sha256:"75e32897adee7d95585a172e4350db257d3c7c532ddcb3e487b9dc11035c087a"};
const MARKER='TDATA FACTORY CLASSIFICATION RESULT:',FIELD='tdataFactoryClassificationResults';
const INPUTS=['lib/src/services/tdata_request_session.dart','example/integration_test/tdata_client_factory_classification_contracts.dart'];
const IDS=['factory-errors','preflight','cancel-precedence'];
const CHECKS=[['transportErrorAndIdentity','twoErrorCallbacks'],['invalidRequest','factoryNotEntered'],['bothCancelled','cancelCallbacksOnly']];
const fail=x=>{throw Error(x);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(p);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;
}
/** Validate source pins independently of runtime or marker registration. */
export function verifyTDataClientFactoryClassificationSources({root=ROOT,manifest,current}){
 if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||!review.files||Array.isArray(review.files))fail('review binding');
 const files=['lib/src/services/tdata_request_session.dart','test/tdata_client_factory_classification_test.dart','test/tdata_client_factory_classification_helper_test.dart','example/integration_test/tdata_client_factory_classification_contracts.dart','tool/sdk_audit/tdata_xhr_factory_throw_probe.mjs','tool/sdk_audit/test/tdata_xhr_factory_throw_probe.test.mjs'];
 if(!same(Object.keys(review.files).sort(),files.sort()))fail('review files');
 for(const file of files)load(root,file,review.files[file]);
 for(const f of INPUTS){const digest=review.files[f];if(f.startsWith('lib/')?current?.libFingerprint?.files?.[f]!==digest:!current?.inputs?.some(x=>x.file===f&&x.sha256===digest))fail('current input mismatch');}
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 const spans=[['getXMLHttpRequest',986884,987288,'f3c108c75979e1f9691d6e3e2c216e985da04beddd5286216b35e13fa4d79be0'],['getPOICategoryJson',1002754,1003491,'ea3d45630769b3d7f526f389c7a621b5d1d8f582ffbac73ffc22376a51ff57a4']];
 for(const [name,start,end,digest] of spans){const code=sdk.slice(start,end),span=review.sourceFixture?.spans?.[name];if(!same(span,{start,end,sha256:digest})||!code.startsWith('function(')||sha(code)!==digest)fail('SDK method span');}
 if(!same(observeTDataXhrFactoryThrow(root),review.sourceFixture))fail('SDK constructor probe mismatch');
 return true;
}
/** Validate rows independently of logs. Synthetic test rows are not evidence. */
export function validateTDataClientFactoryClassificationRows(rows){
 if(!Array.isArray(rows)||rows.length!==IDS.length)fail('row count');
 for(let i=0;i<IDS.length;i++){const r=rows[i];if(!keys(r,['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==IDS[i]||r.status!=='observed'||r.scope!=='synthetic-custom-client-no-network'||!keys(r.checks,CHECKS[i])||Object.values(r.checks).some(x=>x!==true))fail('invalid observation');}
 return true;
}
/** Synthetic HTTP observations only; no SDK contract status promotion. */
export function collectTDataClientFactoryClassificationObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');verifyTDataClientFactoryClassificationSources({root,manifest,current});
  if(platformJsonMarkers[FIELD]!==MARKER)fail('production marker registration pending');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'synthetic-custom-client-no-network',review:REVIEW,platforms:{}};
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n');const run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,MARKER);if(!same(rows.map(x=>x.data),rec[FIELD]))fail('record/log mismatch');validateTDataClientFactoryClassificationRows(rows.map(x=>x.data));
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-client-factory-classification-observations-rejected',reason:String(error.message)}]};}
}
