import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-coordinate-response-source-review.json',sha256:"ec2e3377df668fb789953d18c6ce7f3b7d357cb4468aaeedda1dfb1ec978597c"};
const INPUTS=['lib/src/models/address_info.dart','lib/src/models/route_info.dart','lib/src/services/tdata_protocol.dart','lib/src/services/tdata_service.dart','example/integration_test/tdata_coordinate_response_contracts.dart'];
const IDS=['reverse-coordinate','geocode-coordinate-system','route-coordinate'];
const CHECKS=[['fallback','invalidIsNull','boundary'],['conflictingRejected','zeroRetained'],['vehicleRejects','pedestrianRejects','zeroRetained']];
const fail=x=>{throw Error(x);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(p);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;
}
function sources(root,manifest,current){
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||!Array.isArray(review.files)||!Array.isArray(review.references))fail('review binding');
 for(const file of review.files)load(root,file.file,file.sha256);
 for(const f of INPUTS){const entries=review.files.filter(x=>x.file===f);if(entries.length!==1)fail('review input missing');const digest=entries[0].sha256;if(f.startsWith('lib/')?current.libFingerprint.files[f]!==digest:!current.inputs.some(x=>x.file===f&&x.sha256===digest))fail('current input mismatch');}
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');const span=review.sdkResponse;
 if(span.start!==988203||span.end!==988249||span.excerptSha256!=='09b132b00aee035c83f5afe9e5a25350118c5aaf507e1ad58fd031b76d6e6197'||sha(sdk.slice(span.start,span.end))!==span.excerptSha256)fail('SDK source span');
 for(const r of review.references){if(!manifest.sources.some(x=>x.kind==='reference'&&x.sha256===r.sha256))fail('reference missing');const text=load(root,`tool/sdk_audit/.cache/sources/${r.sha256}`,r.sha256).toString('utf8');for(const row of r.rows){const snippet=text.slice(row.start,row.end);if(!snippet.includes('>'+row.field+'<')||sha(snippet)!==row.excerptSha256)fail('reference source span');}}
}
function validate(rows){
 if(rows.length!==IDS.length)fail('row count');
 for(let i=0;i<IDS.length;i++){const r=rows[i].data;if(!keys(r,['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==IDS[i]||r.status!=='observed'||r.scope!=='synthetic-http-client-no-network'||!keys(r.checks,CHECKS[i])||Object.values(r.checks).some(x=>x!==true))fail('invalid observation');}
}
/** Synthetic HTTP adaptation evidence only: no SDK contract promotion. */
export function collectTDataCoordinateResponseObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');sources(root,manifest,current);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'synthetic-http-client-no-network',review:REVIEW,platforms:{}};
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n');const run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,'TDATA COORDINATE RESPONSE RESULT:');if(!same(rows.map(x=>x.data),rec.tdataCoordinateResponseResults))fail('record/log mismatch');validate(rows);
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-coordinate-response-observations-rejected',reason:String(error.message)}]};}
}
