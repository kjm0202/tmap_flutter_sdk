// This gate returns candidates only; it never mutates contract rows.
import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {rowSourceHash} from './scope_reviews.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {verifySdkHtmlNativeAdaptations} from './sdk_html_native_adaptation_verification.mjs';
import {verifySdkUtilitiesNativeAdaptations,utilitiesNativeAdaptationContracts} from './sdk_utilities_native_adaptation_verification.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const REVIEW='docs/sdk-audit/reviews/sdk-projection-facet-domain-review.json',REVIEW_SHA="960e417d736280c3bc7e43a35336b82a719c7191574d79aeaaf62dfef75aead6";
export const projectionFacetMethods=Object.freeze(['convertBesselTMToWGS84GEO','convertWGS84GEOToBesselTM','convertWGS84GEOToKatec','convertKatecToWGS84GEO','convertBesselGEOToWGS84GEO','convertWGS84GEOToBesselGEO','convertBesselTMToBesselGEO','convertBesselGEOToBesselTM']);
const geo=new Set(['convertWGS84GEOToBesselTM','convertWGS84GEOToKatec','convertBesselGEOToWGS84GEO','convertWGS84GEOToBesselGEO','convertBesselGEOToBesselTM']);
export const projectionFacetContracts=Object.freeze(projectionFacetMethods.flatMap(name=>['',...(geo.has(name)?['.latitude','.longitude']:['.x','.y'])].map(suffix=>`Tmapv3.util.Projection.${name}:argument[0]${suffix}`)));
const fail=x=>{throw Error(x);};
function load(root,file,digest){if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('digest: '+file);return b;}
function references(root){
 const r=JSON.parse(load(root,REVIEW,REVIEW_SHA));if(r.status!=='PROJECTION_FACET_ADAPTATION_PENDING_FRESH_RUNS'||r.baselineId!==BASE||r.sdkSha256!==SDK||r.offsetUnit!=='UTF-16'||!same(Object.keys(r.methods),projectionFacetMethods))fail('review metadata');
 const baseline=JSON.parse(load(root,'tool/sdk_audit/baselines/2026-11-17-production.json',r.baselineManifestSha256));if(baseline.id!==BASE||!baseline.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline file');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');for(const [name,m] of Object.entries(r.methods))if(!Number.isInteger(m.start)||!Number.isInteger(m.end)||m.start<0||m.end<=m.start||sdk.slice(m.start,m.end)!==m.source||sha(m.source)!==m.sha256)fail('SDK method: '+name);
 if(!Array.isArray(r.rows)||r.rows.length!==24||!same([...r.rows.map(x=>x.id)].sort(),[...projectionFacetContracts].sort()))fail('review facet set');
 for(const x of r.rows){if(x.owner!=='Tmapv3.util.Projection'||!/^U111-[0-9a-f]{16}$/.test(x.auditId)||!/^([a-f0-9]{64})$/.test(x.rowSourceHash)||x.source?.kind!=='sdk-ast'||!Array.isArray(x.source.spans)||!x.source.spans.length)fail('facet source');
  for(const span of x.source.spans)if(!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<0||span.end<=span.start||sdk.slice(span.start,span.end)!==span.excerpt)fail('facet span: '+x.id);
 }
 const files=['example/integration_test/sdk_projection_facet_contracts.dart','example/integration_test/sdk_projection_facet_fixture.dart','test/sdk_projection_facet_source_test.mjs','test/sdk_projection_facet_helper_test.dart','test/support/sdk_projection_facet_vm.mjs'];
 if(!Array.isArray(r.files)||!same(r.files.map(x=>x.file),files))fail('reviewed file set');for(const f of r.files)load(root,f.file,f.sha256);
 const deps={htmlCodecVerifier:'tool/sdk_audit/sdk_html_native_adaptation_verification.mjs',utilitiesMethodVerifier:'tool/sdk_audit/sdk_utilities_native_adaptation_verification.mjs',facetIndex:'docs/sdk-audit/reviews/sdk-projection-open-facets-proof-review.json',design:'docs/sdk-audit/reviews/sdk-projection-facet-domain-design.md'};
 for(const [key,file] of Object.entries(deps)){if(r.dependencies?.[key]!==file)fail('dependency path');load(root,file,r.dependencies[key+'Sha256']);}
 if(!r.adaptation?.native||!r.adaptation?.dart||!r.adaptation?.rationale||!Array.isArray(r.adaptation.limitations)||r.adaptation.limitations.length<7)fail('adaptation scope');return r;
}
const keys=(v,k)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
const number=v=>typeof v==='number'&&Number.isFinite(v)&&!Object.is(v,-0)||keys(v,['special'])&&['NaN','Infinity','-Infinity','-0'].includes(v.special);
const returned=v=>keys(v,['status','values'])&&v.status==='returned'&&Array.isArray(v.values)&&v.values.length===2&&v.values.every(number);
const thrown=v=>keys(v,['status','name','token'])&&v.status==='threw'&&typeof v.name==='string'&&typeof v.token==='boolean';
const local=v=>keys(v,['status','name'])&&v.status==='local-rejected'&&['StateError','ArgumentError'].includes(v.name);
function expectedTrace(method,mode){const g=geo.has(method),names=g?['latitude','longitude']:['y','x'],values=g?[37.5665,126.978]:[500000,200000],out=[];if(mode==='mutate')values[1]=g?127.2:210000;
 for(let i=0;i<2;i++){out.push({event:'get',name:names[i]});if(mode===`throw-get-${i}`)break;if(g){out.push({event:'call',name:names[i],receiver:true,argc:0});if(mode===`throw-call-${i}`)break;}out.push({event:'value',name:names[i],value:values[i]});}return out;}
function validPair(pair,id,expectedKind){if(!keys(pair,['id','direct','adapter','passed'])||pair.id!==id||pair.passed!==true||!same(pair.direct,pair.adapter))return false;
 return expectedKind==='typeError'?thrown(pair.direct)&&pair.direct.name==='TypeError'&&!pair.direct.token:expectedKind==='returned'?returned(pair.direct):local(pair.direct)&&pair.direct.name===expectedKind;}
/** Fixed behavior and independently specified access traces for all eight. */
export function compareSdkProjectionFacet({source,rows,shared},{root=ROOT}={}){
 const issues=[];let r;try{r=references(root);}catch(e){return {status:'MISMATCH',issues:[`reference: ${e.message}`]};}
 const expectedSource={status:'observed',projectionIdentity:true,aliasIdentity:true,methods:Object.fromEntries(projectionFacetMethods.map(n=>[n,r.methods[n].source])),sdkDigestMeasurement:'not measured by this helper'};
 if(!same(source,expectedSource))issues.push('callable source/identity');
 if(!Array.isArray(rows)||rows.length!==8)return {status:'MISMATCH',issues:[...issues,'case count']};
 const spy=[{receiver:true,argc:2,first:true,extra:true},{receiver:true,argc:2,first:true,extra:true}];
 for(let i=0;i<projectionFacetMethods.length;i++){
  const method=projectionFacetMethods[i],row=rows[i],g=geo.has(method),modes=['normal','mutate','throw-get-0','throw-get-1',...(g?['throw-call-0','throw-call-1']:[])];
  if(!keys(row,['method','inputKind','cases','invalid','extra','copy','released','passed'])||row.method!==method||row.inputKind!==(g?'geographic':'planar')||row.passed!==true||!Array.isArray(row.cases)||row.cases.length!==modes.length){issues.push(`row: ${method}`);continue;}
  for(let j=0;j<modes.length;j++){const mode=modes[j],x=row.cases[j],throwing=mode.startsWith('throw-');
   if(!keys(x,['mode','directTrace','adapterTrace','direct','adapter','distinct','passed'])||x.mode!==mode||x.passed!==true||!same(x.directTrace,expectedTrace(method,mode))||!same(x.adapterTrace,expectedTrace(method,mode))||!same(x.direct,x.adapter)||
      (throwing?!(thrown(x.direct)&&x.direct.token&&x.distinct===null):!(returned(x.direct)&&x.distinct===true)))issues.push(`trace/result: ${method}/${mode}`);
  }
  if(!Array.isArray(row.invalid)||row.invalid.length!==4||!['omitted','undefined','null','bigint'].every((id,j)=>validPair(row.invalid[j],id,id==='bigint'&&!g?'returned':'typeError')))issues.push(`invalid arguments: ${method}`);
  const e=row.extra;if(!keys(e,['records','direct','adapter','passed'])||e.passed!==true||!same(e.records,spy)||!returned(e.direct)||!same(e.direct,e.adapter))issues.push(`extra arguments: ${method}`);
  const c=row.copy;if(!keys(c,['distinct','dartUnchanged','nativeMutated','direct','adapter','passed'])||c.passed!==true||c.distinct!==true||c.dartUnchanged!==true||c.nativeMutated!==true||!same(c.direct,c.adapter)||!(g?thrown(c.direct)&&c.direct.name==='TypeError'&&!c.direct.token:returned(c.direct)))issues.push(`copy: ${method}`);
  if(!validPair(row.released,'released','StateError'))issues.push(`released handle: ${method}`);
 }
 if(!keys(shared,['crossBridge','passed'])||shared.passed!==true||!validPair(shared.crossBridge,'cross-bridge','ArgumentError'))issues.push('cross-bridge ownership');
 return {status:issues.length?'MISMATCH':'BOUNDED_MATCH',issues,count:rows.length,scope:'Eight source-bound call paths and 24 accessor facets with bounded live cases; identity/timing/exception adaptations remain explicit.'};
}
/** Requires current three-platform logs AND both existing upstream gates. */
export function verifySdkProjectionFacetAdaptations({rows,runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline');const review=references(root),ev=runtime?.platformEvidence,current=capturePlatformInputs(root);
  if(!ev||!same(current,{libFingerprint,inputs:ev.inputs})||!same(ev.libFingerprint,libFingerprint))fail('current inputs');
  const common=verifySdkHtmlNativeAdaptations({rows,runtime,manifest,libFingerprint,root});if(common.issues.length||Object.keys(common.byContract).length!==17)fail('common codec proof');
  const utilities=verifySdkUtilitiesNativeAdaptations({rows,runtime,manifest,libFingerprint,root});if(utilities.issues.length||!same(Object.keys(utilities.byContract),utilitiesNativeAdaptationContracts)||projectionFacetMethods.some(n=>utilities.byContract[`Tmapv3.util.Projection.${n}`]?.status!=='reviewed-adaptation'||utilities.byContract[`Tmapv3.util.Projection.${n}->return`]?.status!=='reviewed-adaptation'))fail('utilities method proof');
  if(!Array.isArray(rows)||new Set(rows.map(x=>x.id)).size!==rows.length)fail('row set');
  for(const expected of review.rows){const row=rows.find(x=>x.id===expected.id);if(!row||row.owner!==expected.owner||row.scope!==expected.scope||!same(row.sourceNames,expected.sourceNames)||!same(row.contracts,expected.contracts)||!same(row.kinds,expected.kinds)||!same(row.channels,expected.channels)||rowSourceHash(row)!==expected.rowSourceHash)fail('facet row: '+expected.id);}
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform set');
  const observed={};for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));if(run.exitCode!==0||run.signal!==null||run.sanitizedLogSha256!==rec.sha256)fail('run');const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const done=parsePlatformTextResults(lines);if(!(rec.platform==='web'?done.webPassed:done.mobilePassed))fail('completion');
   const fields=['sdkProjectionFacetSources','sdkProjectionFacetResults','sdkProjectionFacetShared'],found=lines.flatMap((line,index)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&fields.includes(x.field)?[{field:x.field,data:JSON.parse(x.payload),line:index+1}]:[];});
   const src=found.filter(x=>x.field===fields[0]),results=found.filter(x=>x.field===fields[1]),shared=found.filter(x=>x.field===fields[2]);
   if(src.length!==1||results.length!==8||shared.length!==1||found[0]!==src[0]||found.at(-1)!==shared[0]||!same(src.map(x=>x.data),rec.sdkProjectionFacetSources)||!same(results.map(x=>x.data),rec.sdkProjectionFacetResults)||!same(shared.map(x=>x.data),rec.sdkProjectionFacetShared))fail('log observations/order');
   const cmp=compareSdkProjectionFacet({source:src[0].data,rows:results.map(x=>x.data),shared:shared[0].data},{root});if(cmp.status!=='BOUNDED_MATCH')fail(`facet comparison: ${JSON.stringify(cmp.issues)}`);
   const lineRef=x=>({line:x.line,sha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});observed[rec.platform]={log:{file:rec.file,sha256:rec.sha256,source:lineRef(src[0]),results:results.map(lineRef),shared:lineRef(shared[0])},run:rec.run,source:src[0].data,results:results.map(x=>x.data),shared:shared[0].data};
  }
  return {byContract:Object.fromEntries(review.rows.map(x=>[x.id,{status:'reviewed-adaptation',contract:x.id,auditId:x.auditId,scope:'Native SDK facet through asynchronous live-handle forwarding; bounded accessor cases plus explicit codec and lifecycle adaptations, not independent math or device-byte proof.',baselineId:BASE,libFingerprintSha256:libFingerprint.sha256,sourceReview:{file:REVIEW,sha256:REVIEW_SHA},adaptation:review.adaptation,platforms:observed}])),issues:[]};
 }catch(e){return {byContract:{},issues:[{code:'sdk-projection-facet-adaptation-rejected',reason:String(e.message)}]};}
}
