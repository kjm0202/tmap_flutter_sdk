import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {observeTDataScalarNumbers} from './tdata_scalar_number_source_probe.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed,platformJsonMarkers} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-scalar-number-source-review.json',sha256:"f6010dce8b5c58164b2ba2ead5044551c9921b9f6ba7388f2a0b1650d29616c7"};
const MARKER='TDATA SCALAR NUMBER RESULT:',FIELD='tdataScalarNumberResults';
const INPUTS=['lib/src/services/tdata_request_session.dart','example/integration_test/tdata_scalar_number_contracts.dart'];
const IDS=['sdk-number-snapshot','delayed-options','delayed-credential-guard'];
const CHECKS=[['success','matchesSdkSnapshot','falseyOmitted'],['success','dispatchSnapshot'],['invalidRequest','noSend']];
const VALUES={one:'1',negative:'-3',small:'1e-7',threshold:'0.000001',large:'100000000000000000000',largeExponent:'1e+21',safeBoundary:'9007199254740991',roundBoundary:'9007199254740992',largeRounded:'1000000000000000100',inf:'Infinity'};
const fail=x=>{throw Error(x);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(p);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;
}
/** Validate source pins independently of runtime or marker registration. */
export function verifyTDataScalarNumberSources({root=ROOT,manifest,current}){
 if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||!review.files||Array.isArray(review.files))fail('review binding');
 const files=['lib/src/services/tdata_request_session.dart','example/integration_test/tdata_scalar_number_contracts.dart','test/tdata_scalar_number_string_test.dart','test/tdata_scalar_number_helper_test.dart','tool/sdk_audit/tdata_scalar_number_source_probe.mjs','tool/sdk_audit/test/tdata_scalar_number_source_probe.test.mjs'];
 if(!same(Object.keys(review.files).sort(),files.sort()))fail('review files');
 for(const file of files)load(root,file,review.files[file]);
 for(const f of INPUTS){const digest=review.files[f];if(f.startsWith('lib/')?current?.libFingerprint?.files?.[f]!==digest:!current?.inputs?.some(x=>x.file===f&&x.sha256===digest))fail('current input mismatch');}
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 const expected=['setKeyValueFromObject','setKeyValueFromObjectJson'];
 if(!same(Object.keys(review.sourceSpans),expected))fail('SDK methods mismatch');
 for(const name of expected){const m=review.sourceSpans[name],code=sdk.slice(m.start,m.end);if(!code.startsWith('function(')||sha(code)!==m.sha256)fail('SDK method span');}
 const probe=observeTDataScalarNumbers(root);if(!same(probe,review.sourceFixture)||!same(probe.result.setKeyValueFromObject,VALUES)||!same(probe.result.setKeyValueFromObjectJson,VALUES))fail('SDK numeric snapshot');
 return true;
}
/** Validate rows independently of logs. Synthetic test rows are not evidence. */
export function validateTDataScalarNumberRows(rows){
 if(!Array.isArray(rows)||rows.length!==IDS.length)fail('row count');
 for(let i=0;i<IDS.length;i++){const r=rows[i];if(!keys(r,i===0?['schemaVersion','id','status','scope','checks','values']:['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==IDS[i]||r.status!=='observed'||r.scope!=='synthetic-http-client-no-network'||!keys(r.checks,CHECKS[i])||Object.values(r.checks).some(x=>x!==true)||(i===0&&!same(r.values,VALUES)))fail('invalid observation');}
 return true;
}
/** Synthetic HTTP observations only; no SDK contract status promotion. */
export function collectTDataScalarNumberObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');verifyTDataScalarNumberSources({root,manifest,current});
  if(platformJsonMarkers[FIELD]!==MARKER)fail('production marker registration pending');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'synthetic-http-client-no-network',review:REVIEW,platforms:{}};
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n');const run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,MARKER);if(!same(rows.map(x=>x.data),rec[FIELD]))fail('record/log mismatch');validateTDataScalarNumberRows(rows.map(x=>x.data));
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-scalar-number-observations-rejected',reason:String(error.message)}]};}
}
