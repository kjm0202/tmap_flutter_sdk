import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {rowSourceHash} from './scope_reviews.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {verifySdkHtmlNativeAdaptations} from './sdk_html_native_adaptation_verification.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const REVIEW='docs/sdk-audit/reviews/sdk-utilities-native-adaptation-review.json',REVIEW_SHA="8148d2156e621a168fb9285d2ffde26ebf2165239391b68f5a35123d84fd82d2";
const util=['extend','applyDefaults','toPixelString','numberFromPixelString','getParameterString','rgbFromHexString'],projection=['convertBesselTMToWGS84GEO','convertWGS84GEOToBesselTM','convertWGS84GEOToKatec','convertKatecToWGS84GEO','convertBesselGEOToWGS84GEO','convertWGS84GEOToBesselGEO','convertBesselTMToBesselGEO','convertBesselGEOToBesselTM'];
export const utilitiesNativeAdaptationContracts=Object.freeze([...util.map(x=>'Tmapv3.util.Util.'+x),...projection.map(x=>'Tmapv3.util.Projection.'+x)].flatMap(x=>[x,x+'->return']));
const methods=[...util.map(x=>'Util.'+x),...projection.map(x=>'Projection.'+x)],caseIds=['namespace-identity','projection-alias','coercion','proxy-coercion','util-errors','native-mutation','util-throw','native-callback','function-namespace','projection-getters','projection-nonfinite','projection-bigint','projection-throw','override-util','override-projection','noncallable'];
const oracle=[[38.00273710837287,127.00075788413041],[197988.2559800241,451580.91217548324],[309911.67860084504,552074.3516843411],[37.080298096684615,125.74849235213897],[37.56928716129875,126.97588229300463],[37.56371300926202,126.98011745345406],[37.99999999999957,127.00289027777802],[197801.28273082193,451890.2497682724]];
const fail=x=>{throw Error(x);};
function load(root,file,digest){if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');const f=path.resolve(root,file);if(!fs.realpathSync(f).startsWith(fs.realpathSync(root)+path.sep))fail('path escapes root');const b=fs.readFileSync(f);if(typeof digest!=='string'||sha(b)!==digest)fail('digest mismatch: '+file);return b;}
function references(root){
 const r=JSON.parse(load(root,REVIEW,REVIEW_SHA));if(r.status!=='UTIL_NATIVE_ADAPTATION_PENDING_FRESH_RUNS'||r.baselineId!==BASE||r.sdkSha256!==SDK||r.offsetUnit!=='UTF-16'||!same(Object.keys(r.methods).sort(),[...methods].sort())||!same(r.rows.map(x=>x.id),utilitiesNativeAdaptationContracts))fail('review metadata');
 const baseline=JSON.parse(load(root,'tool/sdk_audit/baselines/2026-11-17-production.json',r.baselineManifestSha256));if(baseline.id!==BASE||!baseline.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline file');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');if(r.alias?.start!==1281226||r.alias?.end!==1281266||sdk.slice(r.alias.start,r.alias.end)!==r.alias.source||sha(r.alias.source)!==r.alias.sha256)fail('SDK Projection alias');for(const x of Object.values(r.methods))if(!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.source||sha(x.source)!==x.sha256)fail('SDK method source');
 const files=['lib/src/models/sdk_utilities_native.dart','example/integration_test/sdk_utilities_native_contracts.dart','example/integration_test/sdk_utilities_native_domain_contracts.dart','test/sdk_utilities_domain_extension_test.dart','test/sdk_utilities_native_domain_source_test.mjs'],bridge=['lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart','lib/src/controller/sdk_native_event_commands.dart','lib/src/controller/transport.dart','lib/src/web/tmap_web_bridge.dart'];
 if(!same(r.files.map(x=>x.file),files)||!same(r.bridge.map(x=>x.file),bridge))fail('file set');for(const x of [...r.files,...r.bridge])load(root,x.file,x.sha256);
 if(r.commonDomain?.verifier!=='tool/sdk_audit/sdk_html_native_adaptation_verification.mjs'||r.commonDomain?.review!=='docs/sdk-audit/reviews/sdk-html-native-adaptation-review.json')fail('common domain references');
 load(root,r.commonDomain.verifier,r.commonDomain.verifierSha256);load(root,r.commonDomain.review,r.commonDomain.reviewSha256);
 if(!r.adaptation?.native||!r.adaptation?.dart||!r.adaptation?.rationale||!Array.isArray(r.adaptation.limitations)||r.adaptation.limitations.length<6)fail('adaptation');return r;
}
export function compareSdkUtilitiesDomainResult(value,methodsByName){
 if(value?.schemaVersion!==1||value.mechanism!=='native SDK Util and Projection through live handle transport'||value.passed!==true||!same(value.sources,Object.fromEntries(methods.map(n=>[n,methodsByName[n].source])))||!same(value.cases,caseIds.map(id=>({id,passed:true}))))fail('domain or callable source mismatch');return true;
}
function priorMatches(source,rows){
 const calls=[...util,...projection],expected={status:'observed',callables:Object.fromEntries(calls.map(x=>[x,true])),pointConstructor:true,latLngConstructor:true};
 const first=[{id:'constructors',status:'observed',point:[{special:'undefined'},null],latLng:[0,0],pointIdentity:true,latLngIdentity:true},{id:'mutate-identity',status:'observed',extendIdentity:true,defaultsIdentity:true,values:[1,2,3]},{id:'pixel',status:'observed',values:['12.5px','0px',12.5,{special:'undefined'}]},{id:'hex-color',status:'observed',channels:[18,52,86]},{id:'errors',status:'observed',util:['TypeError','TypeError'],projection:['TypeError','TypeError']}];
 if(!same(source,expected)||!Array.isArray(rows)||rows.length!==13||!same(rows.slice(0,5),first))return false;
 for(let i=0;i<8;i++){const x=rows[i+5],input=[1,2,4,5,7].includes(i)?[37.5665,126.978]:[200000,500000];if(!x||!same(Object.keys(x).sort(),['id','status','input','direct','adapted','inputAfter','distinct'].sort())||x.id!=='projection:'+projection[i]||x.status!=='observed'||!same(x.input,input)||!same(x.inputAfter,input)||!Array.isArray(x.direct)||x.direct.length!==2||!same(x.direct,x.adapted)||x.distinct!==true||x.direct.some((n,j)=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n-oracle[i][j])>([0,3,4,5,6].includes(i)?0.0001:0.1)))return false;}
 return true;
}
/** Separate mathematical parity is not asserted. The common codec source and
 * complete UTF-16 domain must also pass Html's current three-platform gate. */
export function verifySdkUtilitiesNativeAdaptations({rows,runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline');
  const review=references(root),ev=runtime?.platformEvidence,current=capturePlatformInputs(root);
  if(!ev||!same(current,{libFingerprint,inputs:ev.inputs})||!same(ev.libFingerprint,libFingerprint))fail('current inputs');
  const common=verifySdkHtmlNativeAdaptations({rows,runtime,manifest,libFingerprint,root});if(common.issues.length||Object.keys(common.byContract).length!==17)fail('shared codec/domain evidence');
  if(!Array.isArray(rows)||new Set(rows.map(x=>x.id)).size!==rows.length)fail('row set');
  for(const expected of review.rows){const x=rows.find(y=>y.id===expected.id);if(!x||x.owner!==expected.owner||x.scope!==expected.scope||!same(x.sourceNames,expected.sourceNames)||!same(x.contracts,expected.contracts)||!same(x.kinds,expected.kinds)||!same(x.channels,expected.channels)||rowSourceHash(x)!==expected.rowSourceHash)fail('row evidence: '+expected.id);}
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform set');
  const observed={};for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));if(run.exitCode!==0||run.signal!==null||run.sanitizedLogSha256!==rec.sha256)fail('run');const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});const done=parsePlatformTextResults(lines);if(!(rec.platform==='web'?done.webPassed:done.mobilePassed))fail('completion');
   const found=lines.flatMap((line,index)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&['sdkUtilitiesNativeSources','sdkUtilitiesNativeResults','sdkUtilitiesNativeDomainResults'].includes(x.field)?[{field:x.field,data:JSON.parse(x.payload),line:index+1}]:[];});const sources=found.filter(x=>x.field==='sdkUtilitiesNativeSources'),results=found.filter(x=>x.field==='sdkUtilitiesNativeResults'),domain=found.filter(x=>x.field==='sdkUtilitiesNativeDomainResults');
   if(sources.length!==1||domain.length!==1||found[0]!==sources[0]||found.at(-1)!==domain[0]||!same(sources.map(x=>x.data),rec.sdkUtilitiesNativeSources)||!same(results.map(x=>x.data),rec.sdkUtilitiesNativeResults)||!same(domain.map(x=>x.data),rec.sdkUtilitiesNativeDomainResults)||!priorMatches(sources[0].data,results.map(x=>x.data)))fail('log observations or ordering');
   compareSdkUtilitiesDomainResult(domain[0].data,review.methods);const line=domain[0].line;observed[rec.platform]={log:{file:rec.file,sha256:rec.sha256,line,logLineSha256:sha(lines[line-1])},run:rec.run,domain:domain[0].data,codec:common.byContract['Tmapv3.base.Html#getElement'].platforms[rec.platform]};
  }
  return {byContract:Object.fromEntries(utilitiesNativeAdaptationContracts.map(id=>[id,{status:'reviewed-adaptation',contract:id,scope:'Complete native SDK call through asynchronous live handle forwarding; no independent mathematical parity or device SDK byte identity is asserted.',baselineId:BASE,libFingerprintSha256:libFingerprint.sha256,sourceReview:{file:REVIEW,sha256:REVIEW_SHA},adaptation:review.adaptation,platforms:observed}])),issues:[]};
 }catch(e){return {byContract:{},issues:[{code:'sdk-utilities-native-adaptation-rejected',reason:String(e.message)}]};}
}
