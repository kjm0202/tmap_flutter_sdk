import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const REVIEW='docs/sdk-audit/reviews/sdk-vsm-error-observations-review.json';
const REVIEW_SHA='5e7c8257dad52dc5ee3d45cf7e0d105a2dc4b081914dad016cb81113187ce3b5';
const expectedSources=[
 {id:'Vsm.Map#getInteractive',start:713837,end:713886,sha256:'3d6efb062b82f1b0be70ac8072f909972edad6eca6653eedd51354858a876889'},
 {id:'Vsm.Map#setPoiScale',start:715305,end:715637,sha256:'8d1488776f833a0de0f1ae157d16801042a68babdec7ab6c7623e0e8a704640e'},
 {id:'Vsm.Map#setEnlargeScaleFactor',start:715695,end:715872,sha256:'b3fef4dff8cb4f30a22492557ad6e62d98db0c65677cda0dd6f8a19dcfe0cf70'}
];
const files=['lib/src/models/sdk_vsm_map_native.dart','example/integration_test/sdk_vsm_error_boundary_contracts.dart','test/sdk_vsm_error_boundary_test.dart','test/sdk_vsm_error_source_test.dart','test/support/sdk_vsm_error_source_vm.mjs'];
const fail=x=>{throw Error(x);};
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');
 const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('digest '+file);return b;
}
function refs(root){
 const r=JSON.parse(load(root,REVIEW,REVIEW_SHA));
 if(r.status!=='OPEN'||r.baselineId!==BASE||r.sdkSha256!==SDK||r.offsetUnit!=='UTF-16'||!same(r.sources?.map(({id,start,end,sha256})=>({id,start,end,sha256})),expectedSources)||!same(r.files?.map(x=>x.file),files)||r.sourceReview?.file!=='docs/sdk-audit/reviews/sdk-vsm-error-boundary-review.json')fail('review metadata');
 const prior=JSON.parse(load(root,r.sourceReview.file,r.sourceReview.sha256));
 if(prior.status!=='OPEN'||prior.baselineId!==BASE||prior.sdkSha256!==SDK||!same(prior.sources,r.sources)||!same(prior.files,r.files))fail('source review');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 for(const x of r.sources)if(sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sha256)fail('SDK source '+x.id);
 for(const x of r.files)load(root,x.file,x.sha256);
 return r;
}
const scope='synthetic-engine-generated-snapshot-adapter';
const standard={error:true,phase:true,nameFallback:true,messageFallback:true};
const expected=[...['read-invoke','setter-invoke','promise-reject','result-encode','setup'].map(id=>({id,scope,checks:{...standard},passed:true})),{id:'pending-cleanup',scope,checks:{unchanged:true},passed:true}];
export function compareSdkVsmErrorBoundary(rows,{root=ROOT}={}){
 try{refs(root);if(!same(rows,expected))fail('six ordered synthetic cases');return {status:'BOUNDED_MATCH',issues:[]};}
 catch(e){return {status:'MISMATCH',issues:[String(e.message)]};}
}
/** Bounded execution observations only; never produces contract promotion. */
export function collectSdkVsmErrorBoundaryObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline');refs(root);
  const current=capturePlatformInputs(root),ev=runtime?.platformEvidence;
  if(!ev||!same(ev.libFingerprint,libFingerprint)||!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform set');
  const item={status:'observed-not-verified',scope:'Synthetic engine invokes generated Vsm snapshot adapter; not an actual SDK engine failure.',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:[
   'The helper emits booleans from explicit phase/name/message checks, not the raw thrown value or its identity.',
   'All six cases inject synthetic errors. They do not observe a real map, engine, native Promise failure or complete error domain.',
   'Pending cleanup is a count comparison under an exclusive-runtime assumption; the adapter may retain an empty registry.',
   'Current log and manifest hashes bind source and execution records but do not attest device SDK bytes or constitute digital signatures.',
   'No API contract status is promoted.'
  ],platforms:{}};
  for(const rec of records){
   const file=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==file||rec.run?.file!==file+'.run.json')fail('record');
   const lines=load(root,file,rec.sha256).toString('utf8').split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.exitCode!==0||run.signal!==null||run.sanitizedLogSha256!==rec.sha256)fail('run');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const done=parsePlatformTextResults(lines);if(!(rec.platform==='web'?done.webPassed:done.mobilePassed))fail('completion');
   const found=lines.flatMap((line,i)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&x.field==='sdkVsmErrorBoundaryResults'?[{data:JSON.parse(x.payload),line:i+1}]:[];});
   if(!same(found.map(x=>x.data),rec.sdkVsmErrorBoundaryResults))fail('recorded log rows');
   const cmp=compareSdkVsmErrorBoundary(found.map(x=>x.data),{root});if(cmp.status!=='BOUNDED_MATCH')fail('comparison '+cmp.issues.join(','));
   item.platforms[rec.platform]={log:{file,sha256:rec.sha256},run:rec.run,cases:found.map(x=>({observation:x.data,ref:{file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {byContract:{},observations:[item],issues:[]};
 }catch(e){return {byContract:{},observations:[],issues:[{code:'sdk-vsm-error-boundary-observations-rejected',reason:String(e.message)}]};}
}
