import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';

const BASELINE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const HELPER={file:'example/integration_test/tdata_segmented_geocoding_contracts.dart',sha256:'ecbe4fb5dd47bd70049e81bfe75211394dfcec2317b02e7b05d76d4b3bb2ec7e'};
const REVIEW={file:'docs/sdk-audit/reviews/tdata-segmented-traffic-source-review.json',sha256:'772af70ac85f53c7ed8b2d0b7989fb99044d3954e338aac536b64c7195bf7270'};
const METHODS=[
 {name:'getGeoFromAddressJson',start:992188,end:993000,offsetUnit:'UTF-16 code units; end exclusive',excerptSha256:'7781b09068695917b1ea637f6dd81e7e7feab1c2e4dbe3660cf58a9760f316f8'},
 {name:'getRealTimeTrafficJson',start:998801,end:999624,offsetUnit:'UTF-16 code units; end exclusive',excerptSha256:'d88009f9c9eb72c6567a7925b6bb70a462f48e01975e4d22ab79e95ba2e74fb9'},
];
const REFERENCES=[['U004','da578babe9677cd775a3ad321cd8a4e12fe621b0cfdab3d77ffb4cae0cbfef0b'],['U036','30c1f56a84e2adc9d2f3e77371cd51da483fc2b96868659154eee50a57539330']];
const LIVE=['segmented-default-flag','segmented-explicit-flag'];
const MOCK=['traffic-features-absent','traffic-features-null','traffic-features-empty','traffic-features-invalid','traffic-error'];
const fail=message=>{throw Error(message);};
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const target=path.resolve(root,file);if(!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;
}
function verifySources(root,manifest,current){
 load(root,HELPER.file,HELPER.sha256);
 if(!current.inputs.some(x=>x.file===HELPER.file&&x.sha256===HELPER.sha256))fail('helper absent from input capture');
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 const sdkFile=`tool/sdk_audit/.cache/sources/${SDK}`;
 if(review.baselineId!==BASELINE||review.status!=='SOURCE_REVIEW_ONLY_U111_OPEN'||review.sdk?.file!==sdkFile||review.sdk.sha256!==SDK||!same(review.sdk.methods,METHODS))fail('source review binding');
 const sdk=load(root,sdkFile,SDK).toString('utf8');
 for(const m of METHODS){const text=sdk.slice(m.start,m.end);if(!text.startsWith(`A.prototype.${m.name}=function`)||sha(text)!==m.excerptSha256)fail('SDK source span mismatch');}
 const expected=REFERENCES.map(([id,sha256])=>({id,file:`tool/sdk_audit/.cache/sources/${sha256}`,sha256}));
 if(!same(review.references,expected))fail('reference metadata mismatch');
 for(const ref of expected){if(!manifest.sources.some(s=>s.kind==='reference'&&s.sha256===ref.sha256))fail('reference missing from manifest');load(root,ref.file,ref.sha256);}
}
function uniqueCases(rows,names){
 if(!Array.isArray(rows)||rows.length!==names.length)fail('case count');
 const result=new Map();for(const [i,row] of rows.entries()){
  if(!row||typeof row!=='object'||Array.isArray(row)||row.case!==names[i]||result.has(row.case)||row.status!=='observed'||row.reason!==undefined)fail('missing, duplicate, reordered or failed case');
  result.set(row.case,row);
 }
 return result;
}
const sortedUniqueStrings=items=>Array.isArray(items)&&items.every(x=>typeof x==='string')&&
 new Set(items).size===items.length&&same(items,[...items].sort());
function validateLive(rows){
 const found=uniqueCases(rows,LIVE);
 for(const name of LIVE){const r=found.get(name);
  if(r.transport!=='authenticated-http'||r.jsonKind!=='object'||!sortedUniqueStrings(r.responseKeys)||!r.responseKeys.includes('coordinateInfo')||
     !sortedUniqueStrings(r.coordinateInfoKeys)||!r.coordinateInfoKeys.includes('lat')||!r.coordinateInfoKeys.includes('lon')||
     r.validWgs84Coordinate!==true||r.requestedCoordType!=='WGS84GEO'||r.requestedAddressFlag!==(name===LIVE[0]?'omitted':'F01'))fail('segmented result mismatch');
 }
}
function validateMock(rows){
 const found=uniqueCases(rows,MOCK);
 for(let i=0;i<MOCK.length;i++){const r=found.get(MOCK[i]),accepted=i<3;
  if(r.transport!=='synthetic-mock-http'||r.resultKind!==(accepted?'object':'null'))fail('traffic mock result mismatch');
  if(accepted){if(r.featuresPresent!==(i!==0))fail('traffic features presence');
   if(i===0?r.featuresKind!==undefined:r.featuresKind!==(i===1?'null':'array'))fail('traffic features kind');
  }else if(r.featuresPresent!==undefined||r.featuresKind!==undefined)fail('rejected traffic result shape');
 }
}
/** Observations only: does not promote either U111 contract. */
export function collectTDataSegmentedObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;
  if(manifest?.id!==BASELINE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or SDK mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform evidence or library fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current source inputs mismatch');
  verifySources(root,manifest,current);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('missing or duplicate integration records');
  const common={status:'observed-not-verified',baselineId:BASELINE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',
   libFingerprintSha256:libFingerprint.sha256,helper:HELPER,sourceReview:REVIEW};
  const out={
   'Tmapv3.extension.TData#getGeoFromAddressJson':{...common,platforms:{},scope:'Two authenticated requests for one address; default and explicit F01.',limitations:['Requested query fields are helper intent, not wire captures.','Same-address samples do not establish all address options, errors, SDK equality or callback behavior.']},
   'Tmapv3.extension.TData#getRealTimeTrafficJson':{...common,platforms:{},scope:'Five synthetic HTTP traffic response cases; no real traffic response is asserted.',limitations:['Mocked responses do not establish backend behavior or all traffic JSON shapes.','Null features preservation is a typed adaptation, not a documented server guarantee.']},
  };
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration or run record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n');
   const run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run binding');
   const {sanitizedLogSha256,...rawRun}=run;
   // Raw logs are private; their hash is bound by the recording process.
   validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(log.split('\n'),rec.platform))fail('integration completion marker');
   const parse=marker=>parsePlatformMarkerRows(lines,marker);
   const live=parse('TDATA SEGMENTED RESULT:'),mock=parse('TDATA TRAFFIC OPTIONAL RESULT:');
   if(!same(live.map(x=>x.data),rec.tdataSegmentedResults)||!same(mock.map(x=>x.data),rec.trafficOptionalResults))fail('log/record observations mismatch');
   validateLive(live.map(x=>x.data));validateMock(mock.map(x=>x.data));
   if(live.at(-1).line>=mock[0].line)fail('live/mock observation order mismatch');
   const refs=rows=>rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}));
   for(const [id,rows] of [['Tmapv3.extension.TData#getGeoFromAddressJson',live],['Tmapv3.extension.TData#getRealTimeTrafficJson',mock]])
    out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:refs(rows)};
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'tdata-segmented-observations-rejected',reason:String(error.message)}]};}
}
