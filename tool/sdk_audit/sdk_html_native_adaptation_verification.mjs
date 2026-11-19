// A source- and run-bound adaptation gate. It never mutates contract rows.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {rowSourceHash} from './scope_reviews.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const REVIEW='docs/sdk-audit/reviews/sdk-html-native-adaptation-review.json';
const REVIEW_SHA='5671820ef9dbbab3f016646622fc72cb40bc83ef8ca1edad58921249145d49dc';
const names=['getElement','getElementLeft','getElementTop','getElementWidth','getElementHeight','getElementBounds','getElementPosition','getVisible','onMoveHandler'];
const ids=names.flatMap(n=>n==='onMoveHandler'?[`Tmapv3.base.Html#${n}`]:[`Tmapv3.base.Html#${n}`,`Tmapv3.base.Html#${n}->return`]);
const stringCases=[...Array.from({length:16},(_,i)=>`units_${(i*4096).toString(16).padStart(4,'0')}`),'lone_high','lone_low','reversed','pair','nul_mixed'];
const scalarCases=['undefined','null','false','true','nan','positive_infinity','negative_infinity','negative_zero','positive_zero','finite','min_subnormal','max_finite','bigint'];
const handleCases=['object','array','function','symbol','html_dda','proxy'];
const fail=x=>{throw Error(x);};
const priorNames=['getElement','getElementBounds','getElementPosition','getElementLeft','getElementTop','getElementWidth','getElementHeight','getVisible','setElementPosition','moveElementPosition','setElementSize','setElementBounds','setVisible','createDivElement','createSpanElement','createImageElement','appendChild','removeChild','appendChildElement','removeChildElement','removeFromParent'];
function expectedPrior(){return {source:{status:'observed',callables:Object.fromEntries(priorNames.map(x=>[x,true])),htmlConstructor:true,boundsConstructor:true},rows:[
 {id:'initial-error',status:'observed',initial:[null,0,0,1,1,true],error:'TypeError',visibleAfter:false},
 {id:'position-size-visibility',status:'observed',elementIdentity:true,values:[12,13,14,15,true],style:['12px','13px','14px','15px','visible'],position:[12,13]},
 {id:'bounds-identity',status:'observed',retained:true,cloneDistinct:true,left:19,cloneLeft:5,nullError:'TypeError',retainedAfter:true},
 {id:'child-lifecycle',status:'observed',initialDetached:true,htmlChildAttached:true,htmlChildRemoved:true,elementAttached:true,elementRemoved:true},
 {id:'element-field',status:'observed',wroteNull:true,observedNull:true,restored:true,identityRestored:true},
 {id:'image-no-src',status:'observed',undefinedResult:true,tag:'IMG',detached:true}]};}
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');
 const absolute=path.resolve(root,file);if(!fs.realpathSync(absolute).startsWith(fs.realpathSync(root)+path.sep))fail('path escapes root');
 const bytes=fs.readFileSync(absolute);if(typeof digest!=='string'||sha(bytes)!==digest)fail('digest mismatch: '+file);return bytes;
}
function references(root){
 const review=JSON.parse(load(root,REVIEW,REVIEW_SHA));
 if(review.status!=='HTML_NATIVE_ADAPTATION_PENDING_FRESH_RUNS'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(Object.keys(review.methods),names)||!same(review.rows.map(x=>x.id),ids))fail('review metadata');
 const baseline=JSON.parse(load(root,'tool/sdk_audit/baselines/2026-11-17-production.json',review.baselineManifestSha256));
 if(baseline.id!==BASE||!baseline.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline file');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 for(const m of Object.values(review.methods)){if(!Number.isInteger(m.start)||!Number.isInteger(m.end)||m.start<0||m.end<=m.start||sdk.slice(m.start,m.end)!==m.source||sha(m.source)!==m.sha256)fail('method source');}
 const files=['lib/src/models/sdk_html_native.dart','example/integration_test/sdk_html_native_contracts.dart','example/integration_test/sdk_html_native_domain_contracts.dart','test/sdk_html_methods_extension_test.dart','test/sdk_html_methods_extension_source_test.mjs'];
 const bridge=['lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart','lib/src/controller/sdk_native_event_commands.dart','lib/src/controller/transport.dart','lib/src/web/tmap_web_bridge.dart'];
 if(!same(review.files.map(x=>x.file),files)||!same(review.bridge.map(x=>x.file),bridge))fail('file set');
 for(const x of [...review.files,...review.bridge])load(root,x.file,x.sha256);
 if(!review.adaptation?.native||!review.adaptation?.dart||!review.adaptation?.rationale||!Array.isArray(review.adaptation.limitations)||review.adaptation.limitations.length<6)fail('adaptation');
 return review;
}
/** Checks the fixed observation schema. Does not itself certify any platform. */
export function compareSdkHtmlDomainResult(value,methods){
 const expected=[{id:'source_methods',sources:Object.fromEntries(names.map(n=>[n,methods[n].source]))},
  ...stringCases.map(id=>({id,element:true,visible:true,nativeRoundTrip:true})),
  ...scalarCases.map(id=>({id,elementVisibleSame:true,roundTrip:true,isHandle:false})),
  ...handleCases.map(id=>({id,elementVisibleSame:true,roundTrip:true,isHandle:true})),
  ...['getElement','getVisible'].flatMap(id=>[{id:`${id}:override`,dispatch:true},{id:`${id}:throw`,nativeThrowIdentity:true}]),
  ...['getElement','getVisible'].flatMap(id=>['undefined','null','negative_zero'].map(v=>({id:`${id}:throw:${v}`,nativeThrowIdentity:true}))),
  {id:'html_dda_callable',nativeCallable:true,bridgeCallable:true,match:true},
  {id:'prototype_override',receiver:true,identity:true},
  {id:'proxy_receiver',dispatch:true},
  {id:'hostile_throw',identity:true},
  {id:'pixel_method',sameCoordinates:true,distinctObjects:true},
  {id:'argument_forwarding',receiverAndArguments:true,returnIdentity:true},
  {id:'release_alias',sameAlias:true,releaseRejected:true,newHandle:true}];
 if(value?.schemaVersion!==1||value.mechanism!=='actual SDK Html getter methods through native handle transport'||value.passed!==true||!same(value.results,expected))fail('domain or SDK callable source mismatch');
 return true;
}
/** Requires fresh current-input bound actual logs for all three platforms.
 * Prior logs, samples, or a successful individual platform cannot certify rows.
 * Successful output is an adaptation candidate; integration remains explicit. */
export function verifySdkHtmlNativeAdaptations({rows,runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline');
  const review=references(root),ev=runtime?.platformEvidence,current=capturePlatformInputs(root);
  if(!ev||!same(current,{libFingerprint,inputs:ev.inputs})||!same(ev.libFingerprint,libFingerprint))fail('current inputs');
  if(!Array.isArray(rows)||new Set(rows.map(x=>x.id)).size!==rows.length)fail('row set');
  for(const expected of review.rows){
   const row=rows.find(x=>x.id===expected.id);
   if(!row||row.owner!=='Tmapv3.base.Html'||row.scope!=='undocumented-review-required'||!same(row.sourceNames,[row.id])||!same(row.contracts,[])||!same(row.kinds,expected.kinds)||!same(row.channels,expected.channels)||rowSourceHash(row)!==expected.rowSourceHash)fail('row evidence: '+expected.id);
  }
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform set');
  const observations={};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.exitCode!==0||run.signal!==null||run.sanitizedLogSha256!==rec.sha256)fail('run');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const completion=parsePlatformTextResults(lines);if(!(rec.platform==='web'?completion.webPassed:completion.mobilePassed))fail('completion');
   const found=lines.flatMap((line,index)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&['sdkHtmlNativeSources','sdkHtmlNativeResults','sdkHtmlGetterDomainResults'].includes(x.field)?[{field:x.field,data:JSON.parse(x.payload),line:index+1}]:[];});
   const src=found.filter(x=>x.field==='sdkHtmlNativeSources'),results=found.filter(x=>x.field==='sdkHtmlNativeResults'),domain=found.filter(x=>x.field==='sdkHtmlGetterDomainResults');
   if(src.length!==1||domain.length!==1||found[0]!==src[0]||found.at(-1)!==domain[0]||!same(src.map(x=>x.data),rec.sdkHtmlNativeSources)||!same(results.map(x=>x.data),rec.sdkHtmlNativeResults)||!same(domain.map(x=>x.data),rec.sdkHtmlGetterDomainResults)||!same({source:src[0].data,rows:results.map(x=>x.data)},expectedPrior()))fail('log observations or ordering');
   compareSdkHtmlDomainResult(domain[0].data,review.methods);
   const line=domain[0].line;observations[rec.platform]={log:{file:rec.file,sha256:rec.sha256,line,logLineSha256:sha(lines[line-1])},run:rec.run,domain:domain[0].data};
  }
  const byContract=Object.fromEntries(ids.map(id=>[id,{status:'reviewed-adaptation',contract:id,scope:'Complete native method via asynchronous SdkHtmlNative.callNative; explicit numeric, lifetime, timing, exception and argument-copy adaptations.',baselineId:BASE,libFingerprintSha256:libFingerprint.sha256,sourceReview:{file:REVIEW,sha256:REVIEW_SHA},adaptation:review.adaptation,platforms:observations}]));
  return {byContract,issues:[]};
 }catch(e){return {byContract:{},issues:[{code:'sdk-html-native-adaptation-rejected',reason:String(e.message)}]};}
}
