import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed,platformJsonMarkers} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-poi-coordinate-presence-review.json',sha256:'97f653f7334e5ebde79faf40535d861909ac7cff8ae585e4d606447db0294215'};
const MARKER='TDATA POI COORDINATE RESULT:',FIELD='tdataPoiCoordinatePresenceResults';
const INPUTS=['lib/src/models/poi_item.dart','example/lib/map_home_screen.dart','example/integration_test/tdata_poi_coordinate_presence_contracts.dart'];
const IDS=['missing-invalid','valid-and-fallback','constructor'];
const CHECKS=[['nullAccess','unavailableSource','legacyFallback'],['zeroValid','completeFallback'],['providedRetained']];
const fail=x=>{throw Error(x);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(p);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;
}
/** Validate source pins independently of runtime or marker registration. */
export function verifyTDataPoiCoordinatePresenceSources({root=ROOT,manifest,current}){
 if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||!review.files||Array.isArray(review.files))fail('review binding');
 const files=['lib/src/models/poi_item.dart','example/lib/map_home_screen.dart','test/tdata_poi_coordinate_presence_test.dart','test/tdata_poi_coordinate_presence_helper_test.dart','example/integration_test/tdata_poi_coordinate_presence_contracts.dart'];
 if(!same(Object.keys(review.files).sort(),files.sort()))fail('review files');
 for(const file of files)load(root,file,review.files[file]);
 for(const f of INPUTS){const digest=review.files[f];if(f.startsWith('lib/')?current?.libFingerprint?.files?.[f]!==digest:!current?.inputs?.some(x=>x.file===f&&x.sha256===digest))fail('current input mismatch');}
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 const methods=[['U111-d67b8402e66d9551','Tmapv3.extension.TData#getPOIDataFromSearchJson',1001201,1001982,'64a07167c83d65c636253d9821d89fef9705a2d991740c134f3fd1fcf9427175'],['U111-1ea9bea018cbd23a','Tmapv3.extension.TData#getPOIDataFromLonLatJson',1004284,1005104,'05db04e2bc9732181e60dea0dca3cdd58d148d976c1bd452114a261a4abfa81d']];
 if(!Array.isArray(review.relatedContracts)||review.relatedContracts.length!==methods.length)fail('SDK methods');
 for(let i=0;i<methods.length;i++){const [id,api,start,end,digest]=methods[i],m=review.relatedContracts[i],code=sdk.slice(start,end);if(!same(m,{id,api,start,end})||!code.startsWith('A.prototype.')||sha(code)!==digest)fail('SDK method span');}
 return true;
}
/** Validate rows independently of logs. Synthetic test rows are not evidence. */
export function validateTDataPoiCoordinatePresenceRows(rows){
 if(!Array.isArray(rows)||rows.length!==IDS.length)fail('row count');
 for(let i=0;i<IDS.length;i++){const r=rows[i];if(!keys(r,['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==IDS[i]||r.status!=='observed'||r.scope!=='synthetic-poi-model-no-network'||!keys(r.checks,CHECKS[i])||Object.values(r.checks).some(x=>x!==true))fail('invalid observation');}
 return true;
}
/** Synthetic model observations only; no SDK contract status promotion. */
export function collectTDataPoiCoordinatePresenceObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');verifyTDataPoiCoordinatePresenceSources({root,manifest,current});
  if(platformJsonMarkers[FIELD]!==MARKER)fail('production marker registration pending');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'synthetic-poi-model-no-network',review:REVIEW,platforms:{}};
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n');const run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,MARKER);if(!same(rows.map(x=>x.data),rec[FIELD]))fail('record/log mismatch');validateTDataPoiCoordinatePresenceRows(rows.map(x=>x.data));
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-poi-coordinate-presence-observations-rejected',reason:String(error.message)}]};}
}
