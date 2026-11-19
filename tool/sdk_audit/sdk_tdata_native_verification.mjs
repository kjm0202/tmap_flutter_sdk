import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const DEPENDENCY_REVIEW='docs/sdk-audit/reviews/tdata-json-dependency-source-review.json',DEPENDENCY_REVIEW_SHA="0a6a85855364b142e05cdb157ec8c8f209278c1eee4db05ce1c67fcf629c89dd";
const REVIEW='docs/sdk-audit/reviews/sdk-tdata-native-source-review.json',REVIEW_SHA='a8884ccc8d97561027e01d94d9374796c831e6da1c7c821c5404e9fd5b8d88fa';
const FILES=['lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart','lib/src/models/sdk_tdata_native.dart','example/integration_test/sdk_tdata_native_contracts.dart','example/integration_test/sdk_native_html_dda_contracts.dart','test/sdk_native_callable_bridge_test.mjs','test/sdk_tdata_native_test.dart','tool/sdk_audit/sdk_tdata_native_source_probe.mjs','tool/sdk_audit/test/sdk_tdata_native_source_probe.test.mjs'];
const tdata=[{id:'json-progress-complete',passed:true,scope:'sdk-instance-synthetic-xhr-no-network'},{id:'xml-dom-complete',passed:true,scope:'sdk-instance-synthetic-xhr-no-network'}];
const html=[{id:'document-all-call',passed:true,scope:'actual-browser-dom',typeofUndefined:true,directCallable:true,sameElement:true,settledSameElement:true,missingTypeError:true}];
export function compareSdkTDataNativeRows(a,b,dependency){return same(a,tdata)&&same(b,html)&&Array.isArray(dependency)&&dependency.length===1&&['installed','already-installed','existing-compatible'].some(parser=>same(dependency[0],{parser,scope:'production-json-compatibility'}))?{status:'BOUNDED_MATCH',issues:[]}:{status:'MISMATCH',issues:['invalid rows']};}
export function verifySdkTDataNativeReferences(root=ROOT){
 const read=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(sha(b)!==digest)throw Error(`reference digest: ${file}`);return b;};
 const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(review.sources.map(x=>x.name),['callbacksXml','callbacksJson','geocodingXml','geocodingJson','autocompleteStandardJson'])||!same(review.files.map(x=>x.file),FILES))throw Error('review metadata');
 for(const x of review.sources)if(x.sha256!==SDK||x.file!==`tool/sdk_audit/.cache/sources/${SDK}`||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error('source excerpt');
 for(const x of review.files)read(x.file,x.sha256);
 const dependency=JSON.parse(read(DEPENDENCY_REVIEW,DEPENDENCY_REVIEW_SHA));
 if(dependency.status!=='OPEN'||dependency.baselineId!==BASE||dependency.sdkSha256!==SDK||dependency.offsetUnit!=='UTF-16')throw Error('dependency review metadata');
 for(const x of dependency.sources)if(sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error('dependency SDK source span');
 for(const x of [...dependency.files,...dependency.officialExamples])read(x.file,x.sha256);
}
export function collectSdkTDataNativeObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK)||!ev||!same(ev.libFingerprint,libFingerprint))fail('baseline or fingerprint');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');verifySdkTDataNativeReferences(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform record set');
  const observation={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['SDK calls run with synthetic XHR and no network; these observations do not establish HTTP, server, credential, callback timing or complete lifecycle parity.','HTMLDDA observes browser behavior, not a universal SDK contract; no Node simulation claims to reproduce document.all.','Callbacks reach Dart asynchronously and carry live handles, not synchronous SDK callback return values.'],platforms:{}};
  for(const rec of records){const expectedFile=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expectedFile||rec.run?.file!==rec.file+'.run.json')fail('integration record');
   const load=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('log or run digest');return b.toString('utf8');};
   const lines=load(rec.file,rec.sha256).split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});const done=parsePlatformTextResults(lines);if(rec.platform==='web'?!done.webPassed:!done.mobilePassed)fail('completion marker');
   const rows=lines.flatMap((line,index)=>{const v=decodePlatformLogLine(line);return v?.kind==='json'&&['sdkTDataNativeResults','sdkNativeHtmlDdaResults','sdkTDataDependencyResults'].includes(v.field)?[{field:v.field,data:JSON.parse(v.payload),line:index+1}]:[];});
   const a=rows.filter(x=>x.field==='sdkTDataNativeResults').map(x=>x.data),b=rows.filter(x=>x.field==='sdkNativeHtmlDdaResults').map(x=>x.data);
   const dependency=rows.filter(x=>x.field==='sdkTDataDependencyResults').map(x=>x.data);
   if(rows[0]?.field!=='sdkTDataDependencyResults'||!same(dependency,rec.sdkTDataDependencyResults)||!same(a,rec.sdkTDataNativeResults)||!same(b,rec.sdkNativeHtmlDdaResults)||compareSdkTDataNativeRows(a,b,dependency).status!=='BOUNDED_MATCH')fail('log observation binding or invalid cases');
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});observation.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:ref(x)}))};
  }
  return {byContract:{'Tmapv3.extension.TData#getGeoFromAddressJson':observation,'Tmapv3.extension.TData#getGeoFromAddress':observation},issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-tdata-native-observations-rejected',reason:String(error.message)}]};}
}
