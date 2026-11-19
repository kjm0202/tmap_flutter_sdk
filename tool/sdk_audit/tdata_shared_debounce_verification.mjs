import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {observeSharedAutocompleteSource} from './tdata_autocomplete_shared_source_probe.mjs';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714',SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const HELPER='example/integration_test/tdata_shared_debounce_contracts.dart',HELPER_SHA='8ac5cdf1956613b3e1f0dc2ec86522861b201dc2470b97681b02d0c14d95d053',REVIEW='docs/sdk-audit/reviews/tdata-shared-debounce-source-review.json',REVIEW_SHA='9a8f8df9068f550d746c7057eeb06f507c6e7e11c06169cd59839c6eb29312dd';
export function sharedDebounceCases(){return [
 {id:'shared-slots',status:'observed',transport:'mock-http',states:['cancelled','success','success','success'],sent:['current','isolated','v2'],callbacks:['current-complete','old-cancel','v2-complete']},
 {id:'inflight-race',status:'observed',transport:'mock-http',states:['success','success','success'],sent:['first','immediate','next'],callbacks:['first-complete','immediate-complete','next-complete']},
 {id:'dispose',status:'observed',transport:'mock-http',states:['cancelled','success','cancelled','cancelled','success']}
];}
function references(root){
 const read=(f,d)=>{const b=fs.readFileSync(path.join(root,f));if(sha(b)!==d)throw Error(`reference digest: ${f}`);return b;};
 read(HELPER,HELPER_SHA);const r=JSON.parse(read(REVIEW,REVIEW_SHA));
 if(r.status!=='OPEN'||r.baselineId!==BASE||r.sdkSha256!==SDK||r.offsetUnit!=='UTF-16')throw Error('review metadata');
 const files=['lib/src/services/tdata_request_session.dart','test/tdata_request_coordinator_test.dart',HELPER,'tool/sdk_audit/tdata_autocomplete_shared_source_probe.mjs','tool/sdk_audit/test/tdata_autocomplete_shared_source_probe.test.mjs'];
 if(!Array.isArray(r.files)||r.files.length!==files.length||files.some(f=>r.files.filter(x=>x.file===f).length!==1))throw Error('review file set');
 for(const f of r.files)read(f.file,f.sha256);
 const source=read(`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 const expected=['cbFunc','cbFuncJson','setKeyValueFromObject','setKeyValueFromObjectJson','getCache','getKey','setKey','removeKey','getAutoCompleteSearch','getAutoCompleteSearchJson','getAutoCompleteSearchV2Json'];
 if(!Array.isArray(r.sources)||!same(r.sources.map(x=>x.id).sort(),expected.sort()))throw Error('source set');
 for(const x of r.sources)if(!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||source.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sha256)throw Error(`source span: ${x.id}`);
 const p=observeSharedAutocompleteSource(root),bounded={pendingAfterSupersede:[22,33],pendingAfterCompletion:[33,44],timeoutRemoved:true,requests:['first','immediate','later','v2'],calls:['first:complete'],aborts:0};
 if(!same(r.probe,bounded)||!same(Object.fromEntries(Object.keys(bounded).map(k=>[k,p[k]])),bounded)||!same(Object.fromEntries(r.sources.map(({id,start,end,sha256})=>[id,{start,end,sha256}])),p.spans))throw Error('source probe mismatch');
}
export function compareSharedDebounce(rows,{root=ROOT}={}){try{references(root);if(!same(rows,sharedDebounceCases()))throw Error('fixed mock observations');return {status:'BOUNDED_MATCH',count:3,issues:[]};}catch(e){return {status:'MISMATCH',issues:[e.message]};}}
export function collectSharedDebounceObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or sdk');if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library fingerprint');const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');references(root);
 const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];if(records.length!==3||platforms.some(p=>records.filter(r=>r.platform===p).length!==1))fail('integration records');
 const item={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['All rows use in-memory mock HTTP and exercise the Dart adapter, not native SDK runtime or authenticated HTTP.','The separate pinned SDK source probe uses simulated timers and XHR, not a device browser or SDK whole-byte measurement.','Coordinator sharing is explicit; Dart task cancellation, callbacks, cache and lifecycle remain adapter behavior. No full-domain equivalence or contract closure is claimed.'],platforms:{}};
 for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('integration record');const load=(f,d)=>{const b=fs.readFileSync(path.join(root,f));if(!/^[a-f0-9]{64}$/.test(d||'')||sha(b)!==d)fail('log/run digest');return b.toString('utf8');};const log=load(rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run binding');const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});const completion=parsePlatformTextResults(lines);if(rec.platform==='web'?!completion.webPassed:!completion.mobilePassed)fail('completion marker');
 const rows=lines.flatMap((line,index)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&x.field==='tdataSharedDebounceResults'?[{data:JSON.parse(x.payload),line:index+1}]:[];});if(!same(rows.map(x=>x.data),rec.tdataSharedDebounceResults))fail('log observations');const comparison=compareSharedDebounce(rows.map(x=>x.data),{root});if(comparison.status!=='BOUNDED_MATCH')fail('fixed cases');item.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,mockCases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};}
 return {byContract:Object.fromEntries(['getAutoCompleteSearch','getAutoCompleteSearchJson','getAutoCompleteSearchV2Json'].map(n=>[`Tmapv3.extension.TData#${n}`,item])),issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'tdata-shared-debounce-observations-rejected',reason:String(error.message)}]};}
}
