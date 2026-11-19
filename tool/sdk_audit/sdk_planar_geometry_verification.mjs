import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';
import { ROOT, sha } from './common.mjs';
import { capturePlatformInputs, validatePlatformRunManifest } from './platform_run_binding.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/sdk_planar_geometry_contracts.dart';
const HELPER_SHA='63c985422c7835a290a5ed302e1a22cac925d97047e74ff3b099197efec71d4f';
const REVIEW='docs/sdk-audit/reviews/sdk-planar-geometry-source-review.json';
const REVIEW_SHA='e84ebd79abb2273d6fbbab4c2d32600e856ed086fefe7736c2b29bb1ff703f20';
const SDK_FILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const callableIds=['Tmapv3.base.Point#constructor','Tmapv3.util.Util.checkNearPath','Tmapv3.util.Util.checkPointInPolygon'];
const sourceIds=[...callableIds,'Tmapv3.shape.Polyline#tapChecker','Tmapv3.shape.Polygon#contains','Tmapv3.util.Util:private-near-path-math'];
const contracts={near:'Tmapv3.util.Util.checkNearPath',polygon:'Tmapv3.util.Util.checkPointInPolygon'};
const point=(x,y)=>({x,y}),special=s=>({special:s});

// These are independently fixed inputs, not values inferred from platform logs.
export function sdkPlanarGeometryCases(){
  const z=special('-0'),nan=special('NaN'),inf=special('Infinity');
  const line=[point(0,0),point(10,0)],square=[point(0,0),point(10,0),point(10,10),point(0,10)];
  const near=[
    ['horizontal-hit',point(5,0.5),line,1],['threshold-inclusive',point(5,1),line,1],
    ['outside-threshold',point(5,1),line,0.5],['vertical',point(1,5),[point(0,0),point(0,10)],1],
    ['diagonal',point(5,6),[point(0,0),point(10,10)],2],
    ['first-not-nearest',point(9.8,1),[point(0,0),point(10,0),point(10,10)],2],
    ['outside-segment',point(-0.1,0),line,1],['endpoint-perpendicular',point(0,1),line,1],
    ['empty',point(0,0),[],1],['null-path',point(0,0),null,1],['one-point',point(0,0),[point(0,0)],1],
    ['duplicate-points',point(0,0),[point(0,0),point(0,0)],1],['signed-zero',point(z,0),[point(z,0),point(10,0)],z],
    ['negative-tolerance',point(5,0),line,-1],['nan-point',point(nan,0),line,1],
    ['infinite-point',point(inf,0),line,1],['nan-tolerance',point(5,0),line,nan],['infinite-tolerance',point(5,1),line,inf]
  ];
  const poly=[['interior',point(5,5),square],['exterior',point(11,5),square],['left-edge',point(0,5),square],
    ['right-edge',point(10,5),square],['vertex',point(0,0),square],['empty',point(0,0),[]],
    ['null-path',point(0,0),null],['one-point',point(0,0),[point(0,0)]],['two-points',point(1,0),line],
    ['closed',point(5,5),[point(0,0),point(10,0),point(10,10),point(0,10),point(0,0)]],
    ['reversed',point(5,5),[point(0,10),point(10,10),point(10,0),point(0,0)]],
    ['concave',point(3,3),[point(0,0),point(6,0),point(3,2),point(6,6),point(0,6)]],
    ['self-crossing',point(5,5),[point(0,0),point(10,10),point(0,10),point(10,0)]],
    ['duplicate-points',point(5,5),[point(0,0),point(10,0),point(10,0),point(10,10),point(0,10)]],
    ['signed-zero',point(z,0),[point(z,0),point(10,0)]],['nan-point',point(nan,0),square]];
  const row=(method,scenario,p,path,tolerance)=>({id:`sdk-planar-geometry:${scenario}:${method}`,method,scenario,
    before:{point:p,path,...(method==='near'?{tolerance}:{})}});
  return structuredClone([...near.map(([n,p,path,t])=>row('near',n,p,path,t)),...poly.map(([n,p,path])=>row('polygon',n,p,path))]);
}
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
const number=v=>typeof v==='number'&&Number.isFinite(v)&&!Object.is(v,-0)||
  keys(v,['special'])&&['NaN','Infinity','-Infinity','-0'].includes(v.special);
const validPoint=p=>keys(p,['x','y'])&&number(p.x)&&number(p.y);
const hit=v=>keys(v,['kind','matchIndex','matchPoint'])&&v.kind==='nearPathHit'&&
  Number.isSafeInteger(v.matchIndex)&&v.matchIndex>=0&&validPoint(v.matchPoint);
function references(root){
  const read=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(sha(b)!==digest)throw Error(`reference digest: ${file}`);return b;};
  read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDK_FILE,SDK).toString('utf8');
  if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||
    !Array.isArray(review.sources)||review.sources.length!==sourceIds.length||new Set(review.sources.map(x=>x.id)).size!==sourceIds.length||
    sourceIds.some(id=>!review.sources.some(x=>x.id===id)))throw Error('source review metadata');
  const files=['lib/src/models/sdk_geometry_native.dart','lib/src/controller/sdk_geometry_commands.dart','test/sdk_geometry_planar_test.dart',HELPER];
  if(!Array.isArray(review.files)||review.files.length!==files.length||files.some(f=>review.files.filter(x=>x.file===f).length!==1)||
    !review.files.some(x=>x.file===HELPER&&x.sha256===HELPER_SHA))throw Error('review file list');
  for(const f of review.files)read(f.file,f.sha256);
  const methods={};for(const e of review.sources){const excerpt=sdk.slice(e.start,e.end),start=excerpt.indexOf('function');
    if(e.file!==SDK_FILE||e.sha256!==SDK||!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end<=e.start||
      excerpt!==e.excerpt||sha(excerpt)!==e.sourceTextSha256)throw Error(`source span: ${e.id}`);
    if(callableIds.includes(e.id)){if(start<0)throw Error(`callable: ${e.id}`);methods[e.id]=excerpt.slice(start);}
  }
  return {methods};
}

// Small source-derived expectations disallow a shared but incorrect outcome.
function expectedOutcome(caseId){
  const hitAt=(index,x,y)=>({kind:'nearPathHit',matchIndex:index,matchPoint:{x,y}});
  const expected={
    'horizontal-hit:near':hitAt(0,5,0),'threshold-inclusive:near':hitAt(0,5,0),
    'outside-threshold:near':null,'vertical:near':hitAt(0,0,5),
    'diagonal:near':hitAt(0,5.5,5.5),'duplicate-points:near':hitAt(0,0,0),
    'first-not-nearest:near':hitAt(0,9.8,0),'outside-segment:near':null,
    'empty:near':null,'one-point:near':null,'negative-tolerance:near':null,
    'signed-zero:near':hitAt(0,special('-0'),0),
    'nan-point:near':null,'nan-tolerance:near':null,'infinite-tolerance:near':hitAt(0,5,0),
    'interior:polygon':true,'exterior:polygon':false,'left-edge:polygon':true,'right-edge:polygon':false,
    'vertex:polygon':true,'empty:polygon':false,'null-path:polygon':false,'one-point:polygon':false,
    'two-points:polygon':false,'closed:polygon':true,'reversed:polygon':true,'duplicate-points:polygon':true,
    'signed-zero:polygon':false,'nan-point:polygon':false
  };
  return Object.hasOwn(expected,caseId)?{known:true,value:expected[caseId]}:{known:false};
}

/** Exact same-runtime comparisons of the fixed typed fixture; no promotion. */
export function compareSdkPlanarGeometry({source,rows},{root=ROOT}={}){
  const issues=[],missing=[];let ref;
  try{ref=references(root);}catch(e){issues.push(`reference: ${e.message}`);}
  if(!ref)return {status:'MISMATCH',count:Array.isArray(rows)?rows.length:0,issues,missing};
  if(source?.id!=='sdk-planar-geometry:callable-sources'||source.expectedSdkSha256!==SDK||
    source.sdkDigestMeasurement!=='not measured by this helper'||
    !same(source.observation,{status:'observed',aliases:{point:true},methods:ref.methods}))issues.push('callable source observation');
  const expected=new Map(sdkPlanarGeometryCases().map(x=>[x.id,x])),found=new Map();
  if(!Array.isArray(rows))rows=[];
  if(rows.length===expected.size&&!same(rows.map(x=>x?.id),[...expected.keys()]))issues.push('case order');
  for(const row of rows){if(!row||!expected.has(row.id)){issues.push(`unexpected row: ${row?.id}`);continue;}
    if(found.has(row.id)){issues.push(`duplicate row: ${row.id}`);continue;}found.set(row.id,row);}
  for(const [id,e] of expected){const row=found.get(id);if(!row){missing.push(id);continue;}
    const fail=why=>issues.push(`${id}: ${why}`),n=row.native,d=row.controller;
    if(row.scenario!==e.scenario||row.method!==e.method||row.expectedSdkSha256!==SDK||
      row.sdkDigestMeasurement!=='not measured by this helper'||!same(row.before,e.before))fail('identity or input');
    if(!n||!same(n,d)||!same(n.inputAfter,e.before)){fail('native/controller or input preservation');continue;}
    if(e.method==='near'&&e.scenario==='null-path'){
      if(!keys(n,['status','phase','name','message','inputAfter'])||n.status!=='threw'||n.phase!=='invoke'||n.name!=='TypeError'||typeof n.message!=='string')fail('null path exception');
      continue;
    }
    const isHit=e.method==='near'&&n.value!==null;
    const fields=isHit?['status','value','repeat','inputAfter','distinct']:['status','value','repeat','inputAfter'];
    if(!keys(n,fields)||n.status!=='observed'||!same(n.value,n.repeat)||
      (e.method==='near'?(n.value!==null&&!hit(n.value)):typeof n.value!=='boolean')||
      (isHit&&(n.distinct!==true||n.value.matchIndex>=e.before.path.length-1)))fail('result, repeat or identity');
    const fixed=expectedOutcome(`${e.scenario}:${e.method}`);
    if(fixed.known&&!same(n.value,fixed.value))fail('source-derived expected result');
  }
  return {status:issues.length?'MISMATCH':missing.length?'INCOMPLETE':'BOUNDED_MATCH',count:rows.length,issues,missing,
    scope:'34 fixed planar inputs; direct SDK and controller in the same runtime. No whole-domain or contract promotion claim.'};
}

/** Collect run-bound observations, never contract verification dimensions. */
export function collectSdkPlanarGeometryObservations({runtime,manifest,libFingerprint,root=ROOT}){
  try{
    const fail=message=>{throw Error(message);},ev=runtime?.platformEvidence;
    if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline or SDK mismatch');
    if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform evidence or library mismatch');
    const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current source inputs do not match evidence');
    references(root);
    const records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[],platforms=['android','ios','web'];
    if(records.length!==3||platforms.some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate integration records');
    const out=Object.fromEntries(Object.entries(contracts).map(([method,id])=>[id,{
      status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',
      libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},method,platforms:{},
      limitations:['Fresh numeric snapshots do not represent native aliases, arbitrary JS objects, accessors or prototype mutations.',
        'Public namespace reachability does not establish documentation or support; callable text does not prove device SDK bytes or closure identity.',
        'Selected cases do not establish whole-domain parity, event behavior or contract verification.']} ]));
    for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
      if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration or run record');
      const load=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('log or run digest mismatch');return b.toString('utf8');};
      const log=load(rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
      if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run binding');
      const {sanitizedLogSha256,...rawRun}=run;
      // Only sanitized bytes are available here; the recorder checked raw bytes.
      validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
      if(!platformLogPassed(log.split('\n'),rec.platform))fail('integration completion marker');
      const parse=marker=>parsePlatformMarkerRows(lines,marker);
      const sources=parse('SDK PLANAR GEOMETRY SOURCE:'),rows=parse('SDK PLANAR GEOMETRY RESULT:');
      if(sources.length!==1||rows.length!==34||!same(sources.map(x=>x.data),rec.sdkPlanarGeometrySources)||
        !same(rows.map(x=>x.data),rec.sdkPlanarGeometryResults))fail('missing, duplicate or altered planar observations');
      if(sources[0].line>=rows[0].line)fail('source observation follows result');
      const comparison=compareSdkPlanarGeometry({source:sources[0].data,rows:rows.map(x=>x.data)},{root});
      if(comparison.status!=='BOUNDED_MATCH')fail(`planar comparison: ${JSON.stringify(comparison)}`);
      const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
      for(const [method,id] of Object.entries(contracts)){
        const selected=rows.filter(x=>x.data.method===method);if(selected.length!==(method==='near'?18:16))fail('method case count');
        out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,
          source:{observation:sources[0].data,ref:ref(sources[0])},cases:selected.map(x=>({observation:x.data,ref:ref(x)}))};
      }
    }
    return {byContract:out,issues:[]};
  }catch(error){return {byContract:{},issues:[{code:'sdk-planar-geometry-observations-rejected',reason:String(error.message)}]};}
}
