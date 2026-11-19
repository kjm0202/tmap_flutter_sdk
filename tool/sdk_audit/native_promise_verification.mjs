import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/native_promise_contracts.dart', HELPER_SHA='cb44709dfb0b8a9079ddb2e216bc68078860c84bbcd8766206ed560aaa9d7a37';
const REVIEW='docs/sdk-audit/reviews/native-promise-source-review.json', REVIEW_SHA="9c0783a914c6a757baaf69d326ef0b2fd755cc8fdf36d03923db2c8b4d127e6d";
const SDKFILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const names=['loadStyle','addStyle','removeStyle','addLayer','removeLayer','setCustomStyleProperties'];
const cases=[['resolved-identity-repeat','synthetic-js'],['sync-primitive','synthetic-js'],['rejected-primitive','synthetic-js'],['polling-timeout-does-not-cancel','synthetic-js'],['sdk-custom-style-no-change','sdk-engine']];
export function verifyNativePromiseReferences(root=ROOT){
 const read=(f,d)=>{const b=fs.readFileSync(path.join(root,f));if(sha(b)!==d)throw Error(`reference digest: ${f}`);return b;};
 read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDKFILE,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(review.sources.map(x=>x.id),names.map(n=>`Vsm.Map#${n}`)))throw Error('review metadata');
 for(const x of review.sources)if(x.file!==SDKFILE||x.sha256!==SDK||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error(`source span: ${x.id}`);
 const expected=['lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart','lib/src/models/sdk_vsm_style_native.dart','test/native_promise_bridge_test.mjs','test/sdk_native_promise_test.dart',HELPER];
 if(!same(review.files.map(x=>x.file),expected))throw Error('review file set');for(const x of review.files)read(x.file,x.sha256);
}
export function compareNativePromiseRows(source,rows){
 const expectedSource={installed:true,methods:Object.fromEntries(names.map(n=>[n,true]))};
 if(!same(source,expectedSource))return {status:'MISMATCH',issues:['source callable set']};
 if(!Array.isArray(rows)||rows.length!==cases.length)return {status:'MISMATCH',issues:['case count']};
 const issues=[];for(let i=0;i<cases.length;i++){const [id,scope]=cases[i];if(!same(rows[i],{id,passed:true,scope}))issues.push(`case: ${id}`);}
 return {status:issues.length?'MISMATCH':'BOUNDED_MATCH',issues};
}
export function collectNativePromiseObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or SDK');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library fingerprint');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');verifyNativePromiseReferences(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform record set');
  const observation={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['Only one no-change custom-style call executes the SDK; four other rows use synthetic JS.','Callable presence does not measure the loaded SDK bytes; no full API or callback parity is established.','pollingTimeout prevents additional polls at its boundary; in-flight transport and SDK work are not canceled, and late replies can still settle.'],platforms:{}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('integration record');
   const load=(f,d)=>{const b=fs.readFileSync(path.join(root,f));if(!/^[a-f0-9]{64}$/.test(d||'')||sha(b)!==d)fail('log or run digest');return b.toString('utf8');};
   const lines=load(rec.file,rec.sha256).split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const done=parsePlatformTextResults(lines);if(rec.platform==='web'?!done.webPassed:!done.mobilePassed)fail('completion marker');
   const parse=field=>lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.field===field?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   const source=parse('nativePromiseSources'),rows=parse('nativePromiseResults');
   if(source.length!==1||rows.length!==cases.length||source[0].line>=rows[0].line||!same(source.map(x=>x.data),rec.nativePromiseSources)||!same(rows.map(x=>x.data),rec.nativePromiseResults))fail('log observations');
   const comparison=compareNativePromiseRows(source[0].data,rows.map(x=>x.data));if(comparison.status!=='BOUNDED_MATCH')fail(`comparison: ${comparison.issues}`);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   observation.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:source[0].data,ref:ref(source[0])},cases:rows.map(x=>({observation:x.data,ref:ref(x)}))};
  }
  return {byContract:{'Vsm.Map#setCustomStyleProperties':observation},issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'native-promise-observations-rejected',reason:String(error.message)}]};}
}
