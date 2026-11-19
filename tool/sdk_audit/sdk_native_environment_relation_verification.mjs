// Evidence candidate only; this module never mutates or closes audit rows.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {rowSourceHash} from './scope_reviews.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {verifySdkHtmlNativeAdaptations} from './sdk_html_native_adaptation_verification.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const REVIEW='docs/sdk-audit/reviews/sdk-native-environment-relation-review.json',REVIEW_SHA="dc277ce7b478175aef0fc180bb90e83b499ce1801cb1f1cf45a2fd61c7580dec";
const fail=x=>{throw Error(x);};
function load(root,file,digest){if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('digest '+file);return b;}
const poi=['small','normal','large'],debug=['showTileDebugInfo','showVectorTileDebugInfo','showLegacyVectorTileDebugInfo','showLegacyRasterTileDebugInfo','showCollisionDetection','showPoiVertex','showNetwork'],docks=['defaultDock','topLeft','topRight','bottomLeft','bottomRight'];
export const nativeEnvironmentRelationContracts=Object.freeze([
 ...['getResolution','getMaxExtent'].flatMap(n=>[`Tmapv3.base.Config.${n}`,`Tmapv3.base.Config.${n}->return`,...(n==='getResolution'?[`Tmapv3.base.Config.${n}:argument[0]`]:[])]),
 'Vsm.Extensions.TmapUtils.POI_SCALE',...poi.flatMap(n=>[`Vsm.Extensions.TmapUtils.POI_SCALE.${n}`,`Vsm.Extensions.TmapUtils.POI_SCALE.${n}.fontScale`,`Vsm.Extensions.TmapUtils.POI_SCALE.${n}.iconScale`]),
 'Vsm.Map.AdditionalFuncNames',...debug.map(n=>'Vsm.Map.AdditionalFuncNames.'+n[0].toUpperCase()+n.slice(1)),
 'Vsm.Map.ControlDockNames',...['Default','TopLeft','TopRight','BottomLeft','BottomRight'].map(n=>'Vsm.Map.ControlDockNames.'+n)
]);
function refs(root){
 const r=JSON.parse(load(root,REVIEW,REVIEW_SHA));
 if(r.status!=='NATIVE_ENVIRONMENT_RELATION_PENDING_FRESH_RUNS'||r.baselineId!==BASE||r.sdkSha256!==SDK||r.offsetUnit!=='UTF-16'||r.rows?.length!==29||!same([...r.rows.map(x=>x.id)].sort(),[...nativeEnvironmentRelationContracts].sort()))fail('review metadata');
 const baseline=JSON.parse(load(root,'tool/sdk_audit/baselines/2026-11-17-production.json',r.baselineManifestSha256));if(baseline.id!==BASE||!baseline.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 if(!same(Object.keys(r.methods),['getResolution','getMaxExtent'])||r.source?.length!==12)fail('source metadata');
 for(const m of [...Object.values(r.methods),...r.source])if(!Number.isInteger(m.start)||!Number.isInteger(m.end)||m.start<0||m.end<=m.start||sha(sdk.slice(m.start,m.end))!==m.sha256||(m.source!==undefined&&sdk.slice(m.start,m.end)!==m.source))fail('SDK source span');
 for(const x of r.rows)if(x.auditId!=='U111-'+sha(x.id).slice(0,16)||!/^([a-f0-9]{64})$/.test(x.rowSourceHash))fail('row proof');
 const fileSet=['lib/src/models/sdk_native_environment.dart','example/integration_test/sdk_native_environment_relation_fixture.dart','example/integration_test/sdk_native_environment_relation_contracts.dart','test/sdk_native_environment_relation_test.dart','test/support/sdk_native_environment_vm.mjs'];
 if(!same(r.files?.map(x=>x.file),fileSet))fail('file set');for(const x of r.files)load(root,x.file,x.sha256);
 const deps={htmlCodecVerifier:'tool/sdk_audit/sdk_html_native_adaptation_verification.mjs',htmlReview:'docs/sdk-audit/reviews/sdk-html-native-adaptation-review.json',environmentReview:'docs/sdk-audit/reviews/sdk-native-environment-source-review.json'};
 for(const [key,file] of Object.entries(deps)){if(r.dependencies?.[key]!==file)fail('dependency');load(root,file,r.dependencies[key+'Sha256']);}
 return r;
}
const checks=keys=>Object.fromEntries(keys.map(k=>[k,true]));
const expected=[
 ...['normal','throw-pixel','throw-coerce','throw-table'].map(n=>({id:'resolution-'+n,checks:checks(['directKind','adapterKind','directToken','adapterToken','directTrace','adapterTrace']),passed:true})),
 ...Array.from({length:10},(_,i)=>({id:'key-'+i,checks:checks(['direct','adapter','directTrace','adapterTrace']),passed:true})),
 ...['cached','empty','throw','negative-zero','nan','infinity','bigint','symbol'].map(n=>({id:'extent-'+n,checks:checks(['directKind','adapterKind','directIdentity','adapterIdentity','directTrace','adapterTrace']),passed:true})),
 ...['getResolution','getMaxExtent'].flatMap(m=>Array.from({length:5},(_,i)=>({id:`arity-${m}-${i}`,checks:checks(['direct','adapter','directTrace','adapterTrace']),passed:true}))),
 ...poi.map(n=>({id:'preset-'+n,checks:checks(['direct','adapter']),passed:true})),
 ...poi.flatMap(n=>['fontScale','iconScale'].map(f=>({id:`field-${n}-${f}`,checks:checks(['samePreset','direct','adapter']),passed:true}))),
 ...debug.map(n=>({id:'debug-'+n,checks:checks(['direct','adapter']),passed:true})),
 ...docks.map(n=>({id:'dock-'+n,checks:checks(['direct','adapter']),passed:true})),
 ...['preset','field','debug','dock'].map(n=>({id:'throw-'+n,checks:checks(['direct','adapter']),passed:true})),
 ...['number','negative-zero','nan','infinity','string','boolean','bigint','symbol','null','undefined'].map(n=>({id:'primitive-field-'+n,checks:checks(['direct','adapter','directTrace','adapterTrace']),passed:true})),
 ...['primitive-symbol-key','inherited-field-object','inherited-field-proxy'].map(id=>({id,checks:checks(['direct','adapter','directTrace','adapterTrace']),passed:true})),
 ...['base-number','base-null','debug-number','debug-undefined','dock-number','dock-null'].map(n=>({id:'namespace-'+n,checks:checks(['direct','adapter','directTrace','adapterTrace']),passed:true})),
 ...['getResolution','getMaxExtent'].flatMap(m=>['number','negative-zero','nan','infinity','string','boolean','bigint','symbol','null','undefined','throw-getter','throw-call','noncallable'].map(n=>({id:`primitive-method-${m}-${n}`,checks:checks(['direct','adapter','directTrace','adapterTrace']),passed:true})))
];
export function compareSdkNativeEnvironmentRelation({source,rows,cleanup},{root=ROOT}={}){
 try{const r=refs(root),expectedSource={status:'observed',methods:Object.fromEntries(Object.entries(r.methods).map(([k,v])=>[k,v.source])),sdkDigestMeasurement:'not measured by this helper'};
  if(!same(source,expectedSource)||!same(rows,expected)||!same(cleanup,{restored:true,passed:true}))fail('source, case matrix, order or cleanup');return {status:'BOUNDED_MATCH',count:expected.length,issues:[]};
 }catch(e){return {status:'MISMATCH',issues:[String(e.message)]};}
}
/** Source/run/log binding only. All platform rows may be synthetic in tests. */
export function collectSdkNativeEnvironmentRelation({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline');refs(root);
  const current=capturePlatformInputs(root),ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint)||!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');
  const recs=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];if(recs.length!==3||platforms.some(p=>recs.filter(x=>x.platform===p).length!==1))fail('platform set');
  const observations={};for(const rec of recs){
   const file=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==file||rec.run?.file!==file+'.run.json')fail('record');
   const lines=load(root,file,rec.sha256).toString('utf8').split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.exitCode!==0||run.signal!==null||run.sanitizedLogSha256!==rec.sha256)fail('run');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const done=parsePlatformTextResults(lines);if(!(rec.platform==='web'?done.webPassed:done.mobilePassed))fail('completion');
   const fields=['sdkNativeEnvironmentRelationSources','sdkNativeEnvironmentRelationResults','sdkNativeEnvironmentRelationCleanups'];
   const found=lines.flatMap((line,i)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&fields.includes(x.field)?[{field:x.field,data:JSON.parse(x.payload),line:i+1}]:[];});
   const src=found.filter(x=>x.field===fields[0]),rs=found.filter(x=>x.field===fields[1]),cl=found.filter(x=>x.field===fields[2]);
   if(src.length!==1||rs.length!==102||cl.length!==1||found[0]!==src[0]||found.at(-1)!==cl[0]||!same(src.map(x=>x.data),rec[fields[0]])||!same(rs.map(x=>x.data),rec[fields[1]])||!same(cl.map(x=>x.data),rec[fields[2]]))fail('recorded rows or ordering');
   const cmp=compareSdkNativeEnvironmentRelation({source:src[0].data,rows:rs.map(x=>x.data),cleanup:cl[0].data},{root});if(cmp.status!=='BOUNDED_MATCH')fail('matrix '+cmp.issues.join(','));
   const ref=x=>({line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   observations[rec.platform]={log:{file,sha256:rec.sha256},run:rec.run,source:ref(src[0]),rows:rs.map(ref),cleanup:ref(cl[0])};
  }
  return {status:'observed-not-verified',platforms:observations,issues:[]};
 }catch(e){return {status:'rejected',platforms:{},issues:[{code:'sdk-native-environment-relation-rejected',reason:String(e.message)}]};}
}
/** Checks all 29 current inventory rows without mutating them. */
export function compareSdkNativeEnvironmentRelationRows(rows,{root=ROOT}={}){
 try {
  const r=refs(root);if(!Array.isArray(rows)||new Set(rows.map(x=>x.id)).size!==rows.length)fail('row set');
  for(const x of r.rows){const row=rows.find(y=>y.id===x.id);if(!row||row.owner!==x.owner||row.scope!==x.scope||!same(row.sourceNames,x.sourceNames)||!same(row.contracts,x.contracts)||!same(row.kinds,x.kinds)||!same(row.channels,x.channels)||rowSourceHash(row)!==x.rowSourceHash)fail('row '+x.id);}
  return {status:'BOUND',count:r.rows.length,issues:[]};
 }catch(e){return {status:'MISMATCH',issues:[String(e.message)]};}
}
/** Does not promote: even candidates need an independent integration decision. */
export function verifySdkNativeEnvironmentRelationCandidates({rows,runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const r=refs(root),bound=collectSdkNativeEnvironmentRelation({runtime,manifest,libFingerprint,root});if(bound.issues.length)fail('current platform binding');
  const html=verifySdkHtmlNativeAdaptations({rows,runtime,manifest,libFingerprint,root});if(html.issues.length||Object.keys(html.byContract).length!==17)fail('shared Html codec gate');
  if(compareSdkNativeEnvironmentRelationRows(rows,{root}).status!=='BOUND')fail('row binding');
  return {candidates:Object.fromEntries(r.rows.map(x=>[x.id,{status:'candidate-not-promoted',auditId:x.auditId,sourceReview:{file:REVIEW,sha256:REVIEW_SHA},platforms:bound.platforms,limitations:r.limitations}])),issues:[]};
 }catch(e){return {candidates:{},issues:[{code:'sdk-native-environment-relation-candidate-rejected',reason:String(e.message)}]};}
}
