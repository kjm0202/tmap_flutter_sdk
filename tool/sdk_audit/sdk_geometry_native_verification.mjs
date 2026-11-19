import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';
import { ROOT, sha } from './common.mjs';
import { capturePlatformInputs, validatePlatformRunManifest } from './platform_run_binding.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/sdk_geometry_native_contracts.dart';
const HELPER_SHA='b6449b001f5c5ed46e458da90de3f583405714f03f9419742802913dd256331b';
const REVIEW='docs/sdk-audit/reviews/sdk-geometry-native-source-review.json';
const REVIEW_SHA='2e35d2aecae2321319bc307a254f53c5607a2f3ef95f65ff230e7abf38d4f10c';
const SDK_FILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const callableIds=['Tmapv3.base.LatLng#constructor','Tmapv3.base.Point#constructor',
  'Tmapv3.base.LatLng#latitude','Tmapv3.base.LatLng#longitude','Tmapv3.base.LatLng#distanceTo',
  'Tmapv3.base.LatLng#toEPSG3857','Tmapv3.base.Point#setX','Tmapv3.base.Point#setY',
  'Tmapv3.util.Projection.convertWGS84GEOToEPSG3857','Tmapv3.util.Projection.convertEPSG3857ToWGS84GEO'];
const contracts={project:'Tmapv3.util.Projection.convertWGS84GEOToEPSG3857',
  latLngProject:'Tmapv3.base.LatLng#toEPSG3857',unproject:'Tmapv3.util.Projection.convertEPSG3857ToWGS84GEO',
  distance:'Tmapv3.base.LatLng#distanceTo'};
const lat=(latitude,longitude)=>({latitude,longitude}), point=(x,y)=>({x,y});
const special=x=>({special:x});

// Independent fixed input contract, including tagged non-finite values and
// negative zero. A fresh copy prevents callers from altering future checks.
export function sdkGeometryNativeCases() {
  const z=special('-0'), nan=special('NaN'), inf=special('Infinity'), neg=special('-Infinity'), max=Number.MAX_VALUE;
  const coordinates=[['origin',lat(0,0)],['ordinary',lat(37.5665,126.978)],['signed-zero',lat(z,0)],
    ['epsg-limit',lat(85.06,180)],['outside-epsg',lat(85.1,0)],['sdk-clamp',lat(89.5,0)],
    ['north-pole',lat(90,181)],['south-pole',lat(-90,-181)],['beyond-pole',lat(100,181)],
    ['outside-longitude',lat(0,181)],['nan',lat(nan,1)],['positive-infinity',lat(inf,inf)],
    ['negative-infinity',lat(neg,neg)],['max-finite',lat(max,-max)],['subnormal',lat(5e-324,-5e-324)]];
  const points=[['origin',point(0,0)],['ordinary',point(14135126.30194829,4518366.509981736)],
    ['signed-zero',point(z,0)],['x-outside',point(30000000,0)],['y-outside',point(0,30000000)],
    ['positive-infinity',point(inf,inf)],['negative-infinity',point(neg,neg)],['nan-x',point(nan,0)],
    ['nan-y',point(0,nan)],['max-finite',point(max,-max)],['subnormal',point(-5e-324,5e-324)]];
  const distance=[['ordinary',lat(37.5665,126.978),lat(37.4979,127.0276)],['origin',lat(0,0),lat(0,0)],
    ['acos-nan-counterexample',lat(54.09320031758398,0),lat(54.09320031758398,0)],
    ['acos-finite-counterexample',lat(-50.83109876140952,0),lat(-50.83109876140952,0)],
    ['nearby',lat(54.09320031758398,0),lat(54.09320031758398,0.01)],['antipodes',lat(0,0),lat(0,180)],
    ['signed-zero',lat(z,0),lat(0,z)],['nonfinite',lat(nan,inf),lat(neg,z)],
    ['reversed',lat(-10,-20),lat(10,20)],['max-finite',lat(max,-max),lat(-max,max)]];
  const make=(method,scenario,argument,other)=>({id:`sdk-geometry-native:${scenario}:${method}`,scenario,method,
    before:{argument,...(other?{other}:{})}});
  return structuredClone([...coordinates.map(([n,v])=>make('project',n,v)),...coordinates.map(([n,v])=>make('latLngProject',n,v)),
    ...points.map(([n,v])=>make('unproject',n,v)),...distance.map(([n,a,b])=>make('distance',n,a,b))]);
}
const keys=(v,k)=>v && typeof v==='object' && !Array.isArray(v) && same(Object.keys(v).sort(),[...k].sort());
const number=v=>typeof v==='number'&&Number.isFinite(v)&&!Object.is(v,-0) ||
  keys(v,['special'])&&['NaN','Infinity','-Infinity','-0'].includes(v.special);
function validValue(method,v){
  if(method==='distance')return number(v);
  if(method==='unproject')return keys(v,['kind','latitude','longitude'])&&v.kind==='latLng'&&number(v.latitude)&&number(v.longitude);
  return keys(v,['kind','x','y'])&&v.kind==='point'&&number(v.x)&&number(v.y);
}
function references(root){
  const read=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(sha(b)!==digest)throw Error(`reference digest: ${file}`);return b;};
  read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA));const sdk=read(SDK_FILE,SDK).toString('utf8');
  if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||
     !Array.isArray(review.sources)||review.sources.length!==10||new Set(review.sources.map(x=>x.id)).size!==10||
     callableIds.some(id=>!review.sources.some(x=>x.id===id))||
     !review.files?.some(x=>x.file===HELPER&&x.sha256===HELPER_SHA))throw Error('source review metadata');
  // These exact reviewed implementations and tests must remain the files
  // bound by the review, even if a later run records a new library fingerprint.
  const reviewedFiles=['lib/src/models/sdk_geometry_native.dart','lib/src/controller/sdk_geometry_commands.dart',
    HELPER,'test/sdk_geometry_native_test.dart','test/sdk_geometry_controller_test.dart'];
  if(!Array.isArray(review.files)||review.files.length!==reviewedFiles.length||
     reviewedFiles.some(f=>review.files.filter(x=>x.file===f).length!==1))throw Error('reviewed file list');
  for(const f of review.files)read(f.file,f.sha256);
  const diagnostic=review.negativeZeroDdcEvidence;
  const previous='docs/sdk-audit/reviews/sdk-geometry-native-helper-pre-ddc-fix.dart.txt';
  const probe='docs/sdk-audit/reviews/sdk-geometry-ddc-negative-zero-probe.dart.txt';
  if(diagnostic?.file!=='docs/sdk-audit/reviews/sdk-geometry-ddc-negative-zero-evidence.json'||
     diagnostic.previousHelper?.file!==previous)throw Error('negative-zero evidence reference');
  const ddc=JSON.parse(read(diagnostic.file,diagnostic.sha256));
  if(ddc.probe?.file!==probe||!same(ddc.previousHelper,diagnostic.previousHelper))throw Error('negative-zero evidence binding');
  read(previous,diagnostic.previousHelper.sha256);read(probe,ddc.probe.sha256);
  const methods={};
  for(const e of review.sources){const excerpt=sdk.slice(e.start,e.end),i=excerpt.indexOf('function');
    if(e.file!==SDK_FILE||e.sha256!==SDK||!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end<=e.start||
       excerpt!==e.excerpt||sha(excerpt)!==e.sourceTextSha256||i<0)throw Error(`source span: ${e.id}`);
    methods[e.id]=excerpt.slice(i);
  }
  return {methods,review};
}

/** Compare exact observations made in one runtime, without status promotion. */
export function compareSdkGeometryNative({source,rows},{root=ROOT}={}){
  const issues=[],missing=[];let ref;
  try{ref=references(root);}catch(e){issues.push(`reference: ${e.message}`);}
  if(!ref)return {status:'MISMATCH',count:Array.isArray(rows)?rows.length:0,issues,missing};
  if(source?.id!=='sdk-geometry-native:callable-sources'||source.expectedSdkSha256!==SDK||
     source.sdkDigestMeasurement!=='not measured by this helper'||
     !same(source.observation,{status:'observed',aliases:{latLng:true,point:true,projection:true},methods:ref.methods}))issues.push('callable source observation');
  const expected=new Map(sdkGeometryNativeCases().map(x=>[x.id,x])),found=new Map();
  if(!Array.isArray(rows))rows=[];
  if(rows.length===expected.size && !same(rows.map(x=>x?.id),[...expected.keys()]))issues.push('case order');
  for(const row of rows){if(!row||!expected.has(row.id)){issues.push(`unexpected row: ${row?.id}`);continue;}
    if(found.has(row.id)){issues.push(`duplicate row: ${row.id}`);continue;}found.set(row.id,row);}
  for(const [id,e] of expected){const row=found.get(id);if(!row){missing.push(id);continue;}
    const fail=why=>issues.push(`${id}: ${why}`);
    if(row.scenario!==e.scenario||row.method!==e.method||row.expectedSdkSha256!==SDK||
       row.sdkDigestMeasurement!=='not measured by this helper'||!same(row.before,e.before))fail('identity or input');
    const n=row.native,d=row.controller,fields=e.method==='distance'?['status','value','repeat','inputAfter']:['status','value','repeat','distinct','inputAfter'];
    if(!keys(n,fields)||!keys(d,fields)||n.status!=='observed'||d.status!=='observed'||
       !validValue(e.method,n.value)||!same(n.value,n.repeat)||!same(n.value,d.value)||!same(d.value,d.repeat)||
       !same(e.before,n.inputAfter)||!same(e.before,d.inputAfter)||
       (e.method!=='distance'&&(n.distinct!==true||d.distinct!==true)))fail('result, repeat, identity or input preservation');
  }
  return {status:issues.length?'MISMATCH':missing.length?'INCOMPLETE':'BOUNDED_MATCH',count:rows.length,issues,missing,
    scope:'51 fixed typed cases; same-runtime SDK/controller observations only. No promotion or device SDK-byte measurement.'};
}

/** Run-bound collector; observed cases do not mark contract dimensions passed. */
export function collectSdkGeometryNativeObservations({runtime,manifest,libFingerprint,root=ROOT}){
  try{
    const fail=message=>{throw Error(message);}, ev=runtime?.platformEvidence;
    if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline or SDK mismatch');
    if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform evidence or library mismatch');
    const current=capturePlatformInputs(root);
    if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current source inputs do not match evidence');
    references(root);
    const records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[],platforms=['android','ios','web'];
    if(records.length!==3||platforms.some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate integration records');
    const out=Object.fromEntries(Object.entries(contracts).map(([method,id])=>[id,{
      status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',
      libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},
      sourceReview:{file:REVIEW,sha256:REVIEW_SHA},method,platforms:{},limitations:[
        'Fresh numeric snapshots; custom JS values, aliases, getters, listeners and prototype mutations are outside the observation.',
        'Callable text is observed on each platform, not entire SDK bytes or private closure identity.',
        'Selected same-runtime cases are not whole-domain equivalence, device SDK-byte proof or contract verification.',
        'Synchronous Dart projection and distance retain their distinct behavior.'
      ]}]));
    for(const rec of records){
      const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
      if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration or run record');
      const load=(file,digest)=>{const bytes=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail('log or run digest mismatch');return bytes.toString('utf8');};
      const log=load(rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
      if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run binding');
      const {sanitizedLogSha256,...rawRun}=run;
      // The raw digest was checked by the recorder; private raw bytes are not available here.
      validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
      if(!platformLogPassed(log.split('\n'),rec.platform))fail('integration completion marker');
      const parse=marker=>parsePlatformMarkerRows(lines,marker);
      const sources=parse('SDK GEOMETRY NATIVE SOURCE:'),rows=parse('SDK GEOMETRY NATIVE RESULT:');
      if(sources.length!==1||rows.length!==51||!same(sources.map(x=>x.data),rec.sdkGeometryNativeSources)||
         !same(rows.map(x=>x.data),rec.sdkGeometryNativeResults))fail('missing, duplicate or altered geometry observations');
      if(sources[0].line>=rows[0].line)fail('source observation follows result');
      const comparison=compareSdkGeometryNative({source:sources[0].data,rows:rows.map(x=>x.data)},{root});
      if(comparison.status!=='BOUNDED_MATCH')fail(`geometry comparison: ${JSON.stringify(comparison)}`);
      const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
      for(const [method,id] of Object.entries(contracts)){
        const selected=rows.filter(x=>x.data.method===method),count=method==='unproject'?11:method==='distance'?10:15;
        if(selected.length!==count)fail('method case count');
        out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,
          source:{observation:sources[0].data,ref:ref(sources[0])},cases:selected.map(x=>({observation:x.data,ref:ref(x)}))};
      }
    }
    return {byContract:out,issues:[]};
  }catch(error){return {byContract:{},issues:[{code:'sdk-geometry-native-observations-rejected',reason:String(error.message)}]};}
}
