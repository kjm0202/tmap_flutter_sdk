import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {observeTDataOriginal} from './tdata_lifecycle_source_probe.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const HELPER=['example/integration_test/tdata_request_session_contracts.dart','c4d4f9b15849720b98d9de7c27eb02ad37c443073ad77f821bd5725bd24b9d63'];
const REVIEW=['docs/sdk-audit/reviews/tdata-request-session-source-review.json','7fd12f5d516ebc9c8e61db4bba854ca7586b6bf2e46d94be2aa80e20e7bc0320'];
const PROBE=['tool/sdk_audit/tdata_lifecycle_source_probe.mjs','09de66d5719eba952820f2c01e6145e11f6136d635ea5b738dab1598df9bab36'];
const CASES=['segmented-json','segmented-xml','cancel-pending','autocomplete-json','autocomplete-cache','autocomplete-v2'];
const fail=message=>{throw Error(message);};
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const target=path.resolve(root,file);if(!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail('source or evidence hash mismatch: '+file);return bytes;
}
function sources(root,current){
 load(root,...HELPER);load(root,...PROBE);
 if(!current.inputs.some(x=>x.file===HELPER[0]&&x.sha256===HELPER[1]))fail('helper not in run inputs');
 const review=JSON.parse(load(root,...REVIEW));
 if(review.status!=='SOURCE_REVIEW_AND_OFFLINE_PROBE_U111_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.probe?.file!==PROBE[0]||review.probe.sha256!==PROBE[1])fail('source review mismatch');
 const implementation=['lib/src/services/tdata_request_session.dart','lib/src/controller/tdata_commands.dart'];
 if(!Array.isArray(review.reviewedImplementation)||review.reviewedImplementation.length!==implementation.length||implementation.some(f=>review.reviewedImplementation.filter(x=>x.file===f).length!==1))fail('reviewed implementation file set mismatch');
 for(const entry of review.reviewedImplementation){load(root,entry.file,entry.sha256);if(current.libFingerprint.files[entry.file]!==entry.sha256)fail('reviewed implementation fingerprint mismatch');}

 const observation=observeTDataOriginal(root);
 if(!same(observation.spans,review.pinnedFunctionSpans)||!same({jsonCallbacks:observation.jsonCallbacks,xmlCallbacks:observation.xmlCallbacks,
  optionMutation:observation.mutation,overlappingCallbacks:observation.overlappingCallbacks,debounce:observation.debounce,cache:observation.cache},review.observations))fail('SDK offline probe mismatch');
}
function validate(rows){
 if(!Array.isArray(rows)||rows.length!==CASES.length)fail('missing or duplicate cases');
 for(let i=0;i<CASES.length;i++){
  const r=rows[i];if(!r||r.case!==CASES[i]||r.status!=='observed'||r.reason!==undefined)fail('failed or reordered case');
  if(i<2){
   if(r.transport!=='authenticated-http'||r.resultState!=='success'||r.statusCode!==200||
      !Number.isSafeInteger(r.progressEvents)||r.progressEvents<1||!Number.isSafeInteger(r.receivedBytes)||r.receivedBytes<1||
      !same(r.callbacks,['complete'])||r.fixedCollisionRemoved!==true||r.bodyKind!==(i===0?'json-object':'xml-text'))fail('segmented sample mismatch');
  } else if(i===2){
   if(r.transport!=='local-no-http'||r.resultState!=='cancelled'||r.cancelCallbacks!==1)fail('cancel observation mismatch');
  } else if(i===4){
   if(r.transport!=='local-session-cache'||r.resultState!=='success'||r.fromCache!==true||r.sameBody!==true)fail('cache observation mismatch');
  } else if(r.transport!=='authenticated-http'||r.resultState!=='success'||!Number.isInteger(r.statusCode)||r.statusCode<200||r.statusCode>=300||r.fromCache!==false)fail('autocomplete HTTP sample mismatch');
 }
}
/** Collect bounded observations; no SDK callback or lifecycle contract is promoted. */
export function collectTDataSessionObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline or SDK mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform evidence or fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs mismatch');
  sources(root,current);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate integration records');
  const common={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',
   libFingerprintSha256:libFingerprint.sha256,helper:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations:[
    'Byte stream progress differs from native XHR readyState events; device SDK bytes are not measured.',
    'Callback dispatch and HTTP error policy, default per-session timers, opt-in coordinator sharing and opt-in cache differ from the pinned SDK.',
    'XML is returned as text; browser XML DOM, XML root error dispatch, XDomainRequest and complete lifecycle parity are not established.',
    'Selected live samples and offline fake-XHR probe do not promote U111 or every named wrapper.' ]};
  const bindings={
   'Tmapv3.extension.TData#getGeoFromAddressJson':['segmented-json'],
   'Tmapv3.extension.TData#getGeoFromAddress':['segmented-xml'],
   'Tmapv3.extension.TData#getAutoCompleteSearchJson':['cancel-pending','autocomplete-json','autocomplete-cache'],
   'Tmapv3.extension.TData#getAutoCompleteSearchV2Json':['autocomplete-v2'],
  };
  const out=Object.fromEntries(Object.keys(bindings).map(id=>[id,{...common,platforms:{}}]));
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const completion=parsePlatformTextResults(lines);
   if(rec.platform==='web'?!completion.webPassed:!completion.mobilePassed)fail('integration completion marker');
   const rows=lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.field==='tdataSessionResults'?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   if(!same(rows.map(x=>x.data),rec.tdataSessionResults))fail('log/record mismatch');
   validate(rows.map(x=>x.data));
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const [id,names] of Object.entries(bindings))out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.filter(x=>names.includes(x.data.case)).map(x=>({observation:x.data,ref:ref(x)}))};
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'tdata-session-observations-rejected',reason:String(error.message)}]};}
}
