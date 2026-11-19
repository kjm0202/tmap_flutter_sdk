import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/sdk_vsm_map_contracts.dart', HELPER_SHA='eb374c7c47f090b145d8195808682406a1bdd318a02c160eff87edd224750426';
const REVIEW='docs/sdk-audit/reviews/sdk-vsm-map-source-review.json', REVIEW_SHA="a915db50ef4118c5a3729e65f8480a8f2608d7187b1fdaaf57ceac5c33c98d23";
const SDK_FILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const cases=[
 ['project:ordinary',{latitude:37.5665,longitude:126.978},'Vsm.Map#project'],
 ['project:signed-zero',{latitude:{special:'-0'},longitude:0},'Vsm.Map#project'],
 ['unproject:ordinary',{x:200.25,y:150.5},'Vsm.Map#unproject'],
 ['unproject:signed-zero',{x:{special:'-0'},y:0},'Vsm.Map#unproject'],
 ['getActiveLayers',null,'Vsm.Map#getActiveLayers'],['getCurrentStyle',null,'Vsm.Map#getCurrentStyleNameAndType'],
 ['getPoiScale',null,'Vsm.Map#getPoiScale'],['getEnlargeScaleFactor',null,'Vsm.Map#getEnlargeScaleFactor'],
 ['getInteractive',null,'Vsm.Map#getInteractive'],['isInteracting',null,'Vsm.Map#isInteracting'],
 ['setMapInteractiveOptions',{pan:false},'Tmapv3.Map#setInteractive'],
 ['setInteractiveOptions',{pan:false},'Vsm.Map#setInteractive'],
 ['setPoiScale',{fontScale:1.1,iconScale:1.2},'Vsm.Map#setPoiScale'],
 ['setEnlargeScaleFactor',{value:1.1},'Vsm.Map#setEnlargeScaleFactor'],
 ['setInteractiveBoolean:false',{enabled:false},'Vsm.Map#setInteractive'],
 ['setInteractiveBoolean:true',{enabled:true},'Vsm.Map#setInteractive']
];
export function sdkVsmMapCases(){return structuredClone(cases.map(([id,input,contract])=>({id:`sdk-vsm-map:${id}`,input,contract})));}
const callables=['Vsm.Map#project','Vsm.Map#unproject','Vsm.Map#getActiveLayers','Vsm.Map#getCurrentStyleNameAndType',
 'Vsm.Map#getPoiScale','Vsm.Map#getEnlargeScaleFactor','Vsm.Map#getInteractive','Vsm.Map#isInteracting',
 'Vsm.Map#setInteractive','Vsm.Map#setPoiScale','Vsm.Map#setEnlargeScaleFactor','Tmapv3.Map#setInteractive','Tmapv3.Map#vsmMap'];
function refs(root){
 const read=(f,d)=>{const b=fs.readFileSync(path.join(root,f));if(sha(b)!==d)throw Error(`reference digest: ${f}`);return b;};
 read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDK_FILE,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!Array.isArray(review.sources)||new Set(review.sources.map(x=>x.id)).size!==review.sources.length)throw Error('source review metadata');
 const files=['lib/src/models/sdk_vsm_map_native.dart','lib/src/controller/sdk_vsm_map_commands.dart','test/sdk_vsm_map_native_test.dart',HELPER];
 if(!Array.isArray(review.files)||review.files.length!==files.length||files.some(f=>review.files.filter(x=>x.file===f).length!==1)||!review.files.some(x=>x.file===HELPER&&x.sha256===HELPER_SHA))throw Error('review file list');
 for(const f of review.files)read(f.file,f.sha256);
 const methods={};for(const x of review.sources){if(x.file!==SDK_FILE||x.sha256!==SDK||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error(`source span: ${x.id}`);
   if(callables.includes(x.id)){const pos=x.id.startsWith('Tmapv3.')?x.excerpt.indexOf('function'):0;if(pos<0)throw Error('callable source');methods[x.id]=x.excerpt.slice(pos);}}
 if(!same(Object.keys(methods).sort(),[...callables].sort()))throw Error('callable set');return methods;
}
const number=x=>typeof x==='number'&&Number.isFinite(x)&&!Object.is(x,-0)||x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===1&&['NaN','Infinity','-Infinity','-0'].includes(x.special);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function compareSdkVsmMap({source,rows},{root=ROOT,historical14=false}={}){
 const issues=[];let methods;try{methods=refs(root);}catch(e){return {status:'MISMATCH',issues:[`reference: ${e.message}`]};}
 if(source?.id!=='sdk-vsm-map:callable-sources'||source.expectedSdkSha256!==SDK||source.sdkDigestMeasurement!=='not measured by this helper'||!same(source.observation,{status:'observed',reachable:true,methods}))issues.push('callable source observation');
 const expected=historical14?sdkVsmMapCases().slice(0,14):sdkVsmMapCases();if(!Array.isArray(rows)||rows.length!==expected.length)return {status:'MISMATCH',issues:[...issues,'case count']};
 for(let i=0;i<expected.length;i++){
  const x=rows[i],e=expected[i],mutation=i>=10;
  if(x?.id!==e.id||!same(x?.input,e.input)){issues.push(`case identity or input: ${e.id}`);continue;}
  if(!object(x.native)||x.native.status!=='observed'||!Object.hasOwn(x.native,'value')||!same(x.native,x.controller)){issues.push(`result mismatch: ${e.id}`);continue;}
  const v=x.native.value;if(mutation&&(!object(x.before)||x.before.status!=='observed'||!Object.hasOwn(x.before,'value')))issues.push(`missing before: ${e.id}`);
  if(i<4&&(!object(v)||!number(v[i<2?'x':'latitude'])||!number(v[i<2?'y':'longitude'])))issues.push(`coordinate result: ${e.id}`);
  if(i===4&&!Array.isArray(v))issues.push(`layers result: ${e.id}`);
  if(i===5&&v!==null&&!object(v))issues.push(`style result: ${e.id}`);
  if(i===6&&(!object(v)||!number(v.fontScale)||!number(v.iconScale)))issues.push(`scale result: ${e.id}`);
  if(i===7&&!number(v))issues.push(`factor result: ${e.id}`);
  if(i===8&&typeof v!=='boolean'&&!object(v))issues.push(`interactive result: ${e.id}`);
  if(i===9&&typeof v!=='boolean')issues.push(`interacting result: ${e.id}`);
  if((i===10||i===11)&&(!object(v)||v.pan!==false))issues.push(`interactive mutation: ${e.id}`);
  if(i===12&&(!object(v)||v.fontScale!==1.1||v.iconScale!==1.2))issues.push(`scale mutation: ${e.id}`);
  if(i===13&&v!==1.1)issues.push(`factor mutation: ${e.id}`);
  if(i===14&&v!==false||i===15&&v!==true)issues.push(`interactive Boolean mutation: ${e.id}`);
 }
 return {status:issues.length?'MISMATCH':'BOUNDED_MATCH',count:rows.length,issues,scope:historical14?'14 historical bounded rows only; no run binding or full contract promotion.':'16 bounded same-runtime observations; no full contract promotion.'};
}
export function collectSdkVsmMapObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or SDK mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current source inputs do not match evidence');refs(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration record set');
  const contracts=[...new Set(cases.map(x=>x[2]))];const out=Object.fromEntries(contracts.map(id=>[id,{status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['Vsm reachability does not establish official documentation or support.','Detached snapshots do not preserve native object identity, accessors, custom prototypes or arbitrary coercions.','Callable text does not establish loaded device SDK bytes or closure identity; bounded cases do not verify full contracts.'],platforms:{}}]));
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const load=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('log or run digest');return b.toString('utf8');};
   const log=load(rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const completion=parsePlatformTextResults(lines);
   if(rec.platform==='web'?!completion.webPassed:!completion.mobilePassed)fail('completion marker');
   const parse=field=>lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.field===field?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   const sources=parse('sdkVsmMapSources'),rows=parse('sdkVsmMapResults');
   if(sources.length!==1||rows.length!==cases.length||sources[0].line>=rows[0].line||!same(sources.map(x=>x.data),rec.sdkVsmMapSources)||!same(rows.map(x=>x.data),rec.sdkVsmMapResults))fail('log observations');
   const comparison=compareSdkVsmMap({source:sources[0].data,rows:rows.map(x=>x.data)},{root});if(comparison.status!=='BOUNDED_MATCH')fail(`comparison: ${JSON.stringify(comparison)}`);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const id of contracts){const selected=rows.filter((_,i)=>cases[i][2]===id);out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:sources[0].data,ref:ref(sources[0])},cases:selected.map(x=>({observation:x.data,ref:ref(x)}))};}
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-vsm-map-observations-rejected',reason:String(error.message)}]};}
}
