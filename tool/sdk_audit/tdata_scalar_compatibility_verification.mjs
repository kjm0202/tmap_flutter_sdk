import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {observeTDataScalarCompatibility} from './tdata_scalar_compatibility_probe.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const REVIEW=['docs/sdk-audit/reviews/tdata-scalar-compatibility-source-review.json',"f021f11745106a5afb383fabfe11ae968d96bd25eac215f34c0d4e4c6c6c6272"];
const HELPER=['example/integration_test/tdata_scalar_compatibility_contracts.dart','368d8155195ab04bc6d9c92c73718f663e0b118885b1bbb429d0e257853a4165'];
const CASES={
 'scalar-options':['immediateMutation','exactCase','falseyOmitted','snapshotAndEncoding','success','redirectDisabled','credentialExcludedFromQuery'],
 'typed-coordinates':['allEightDefaults','allEightRejectConflict'],
 'latest-callbacks':['latestOwnsProgressAndCompletion','taskResultsIndependent'],
};
const fail=s=>{throw Error(s);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function read(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');
 const full=path.resolve(root,file);if(!fs.realpathSync(full).startsWith(fs.realpathSync(root)+path.sep))fail('path escapes root');
 const b=fs.readFileSync(full);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('digest mismatch: '+file);return b.toString('utf8');
}
/** Validate bounded mock rows; this alone is not platform evidence. */
export function compareTDataScalarCompatibilityRows(rows){
 if(!Array.isArray(rows)||rows.length!==3)fail('missing or duplicate compatibility rows');
 Object.entries(CASES).forEach(([id,checks],index)=>{
  const row=rows[index];if(!keys(row,['schemaVersion','id','status','scope','checks'])||row.schemaVersion!==1||row.id!==id||row.status!=='observed'||row.scope!=='in-memory mock transport; no HTTP or SDK runtime'||!keys(row.checks,checks)||!Object.values(row.checks).every(x=>x===true))fail('invalid compatibility row: '+id);
 });return true;
}
export function collectTDataScalarCompatibilityObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('fingerprint mismatch');const current=capturePlatformInputs(root);
  if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current input mismatch');
  const review=JSON.parse(read(root,...REVIEW)),sdk=read(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK);read(root,...HELPER);
  if(review.status!=='SOURCE_AND_MOCK_TESTED_LIVE_PENDING_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16')fail('review mismatch');
  if(!same(observeTDataScalarCompatibility(root),review.originalExecutableProbe))fail('original source probe mismatch');
  for(const span of Object.values(review.sdkFunctions))if(sha(sdk.slice(span.start,span.end))!==span.sha256)fail('SDK source span mismatch');
  for(const entry of review.files){read(root,entry.file,entry.sha256);if(entry.file.startsWith('lib/')&&current.libFingerprint.files[entry.file]!==entry.sha256)fail('library source drift');}
  if(!review.files.some(x=>same(x,{file:HELPER[0],sha256:HELPER[1]}))||!current.inputs.some(x=>same(x,{file:HELPER[0],sha256:HELPER[1]})))fail('helper not bound');
  const records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate runs');
  const names=['getGeoFromAddressJson','getPOIDataFromSearchJson','getGeofencingFromSearch','getGeofencingFromSearchJson','getPOIDataFromLonLat','getPOIDataFromLonLatJson','getRoutePlan','getRoutePlanJson','getRoutePlanForPeople','getRoutePlanForPeopleJson'];
  const out=Object.fromEntries(names.map(name=>['Tmapv3.extension.TData#'+name,{status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},scope:'In-memory mock transport only; no live HTTP or SDK runtime parity.',limitations:['Pinned source functions were run separately in fake XHR and timers.','No native SDK lifecycle equivalence, live endpoint acceptance, or API status promotion is established.'],platforms:{}}]));
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid run record');
   const log=read(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(read(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run log binding mismatch');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const statuses=parsePlatformTextResults(lines);if(rec.platform==='web'?!statuses.webPassed:!statuses.mobilePassed)fail('run completion missing');
   const found=[];lines.forEach((line,i)=>{const row=decodePlatformLogLine(line);if(row?.kind==='json'&&row.field==='tdataScalarCompatibilityResults')found.push({data:JSON.parse(row.payload),line:i+1});});
   if(!same(found.map(x=>x.data),rec.tdataScalarCompatibilityResults))fail('record/log mismatch');compareTDataScalarCompatibilityRows(rec.tdataScalarCompatibilityResults);
   for(const name of names){const index=name==='getGeoFromAddressJson'?0:name==='getPOIDataFromSearchJson'?2:1,x=found[index];out['Tmapv3.extension.TData#'+name].platforms[rec.platform]={observation:x.data,log:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))},run:rec.run};}
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'tdata-scalar-compatibility-observations-rejected',reason:String(error.message)}]};}
}
