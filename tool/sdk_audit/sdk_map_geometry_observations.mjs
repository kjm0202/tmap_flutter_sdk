import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/sdk_map_geometry_contracts.dart',HELPER_SHA='d4a28f43eee02d4473ce72497e62e7640cdb9001971cc0280842d4eec8bc0e93';
const REVIEW='docs/sdk-audit/reviews/sdk-map-screen-geometry-source-review.json',REVIEW_SHA='e6eb9f59d33e382c28e2f8d1a3dc9720d1b2ab78362b0d8aa376288163767165';
const SDK_FILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const SOURCE={status:'observed',realToScreen:true,screenToReal:true,mechanism:'live callable presence, not whole-bundle digest'};
const specs=[
 {case:'seoul',operation:'realToScreen',input:{latitude:37.5665,longitude:126.978},legacy:true},
 {case:'origin',operation:'realToScreen',input:{latitude:0,longitude:0},legacy:true},
 {case:'signed-zero',operation:'realToScreen',input:{latitude:{special:'-0'},longitude:126.978},legacy:false},
 {case:'origin',operation:'screenToReal',input:{x:0,y:0},legacy:true},
 {case:'fractional',operation:'screenToReal',input:{x:112.25,y:84.75},legacy:true},
 {case:'signed-zero',operation:'screenToReal',input:{x:{special:'-0'},y:5},legacy:true},
];
export function sdkMapGeometryCases(){return structuredClone(specs);}
const keys=(v,fields)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...fields].sort());
const taggedNumber=v=>(typeof v==='number'&&Number.isFinite(v)&&!Object.is(v,-0))||
  (keys(v,['special'])&&['NaN','Infinity','-Infinity','-0'].includes(v.special));
function validResult(operation,value){
 if(operation==='realToScreen')return keys(value,['x','y'])&&[value.x,value.y].every(v=>taggedNumber(v)&&(typeof v!=='number'||Number.isInteger(v)));
 // Pinned Map.screenToReal constructs a LatLng, which normalizes non-finite
 // numbers and negative zero. This is bounded numeric evidence only.
 return keys(value,['latitude','longitude'])&&[value.latitude,value.longitude].every(v=>typeof v==='number'&&Number.isFinite(v)&&!Object.is(v,-0));
}
function references(root){
 const read=(file,digest)=>{const bytes=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)throw Error(`reference digest: ${file}`);return bytes;};
 read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDK_FILE,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16')throw Error('review metadata');
 const ids=['Tmapv3.Map#realToScreen','Tmapv3.Map#screenToReal','Tmapv3.Map#setZoom'];
 if(!Array.isArray(review.sources)||review.sources.length!==ids.length||ids.some(id=>review.sources.filter(s=>s.id===id).length!==1))throw Error('source set');
 for(const entry of review.sources){if(!Number.isInteger(entry.start)||!Number.isInteger(entry.end)||entry.start<0||entry.end<=entry.start||entry.end>sdk.length||sha(sdk.slice(entry.start,entry.end))!==entry.sha256)throw Error(`source span: ${entry.id}`);}
 const files=['lib/src/models/sdk_geometry_native.dart','lib/src/controller/sdk_geometry_commands.dart','lib/src/controller/map_commands.dart','lib/src/js/js_utils.dart','lib/src/web/bridge_scripts/map_control.dart','lib/src/web/tmap_web_bridge.dart','test/sdk_map_screen_transport_test.mjs','test/sdk_map_geometry_native_test.dart','test/support/sdk_map_geometry_runtime.mjs',HELPER];
 if(!Array.isArray(review.files)||review.files.length!==files.length||files.some(f=>review.files.filter(x=>x.file===f).length!==1)||!review.files.some(x=>x.file===HELPER&&x.sha256===HELPER_SHA))throw Error('review file set');
 for(const f of review.files)read(f.file,f.sha256);
}
/** Validate bounded rows, without deriving an expected coordinate from the current camera. */
export function compareSdkMapGeometry({source,rows},{root=ROOT}={}){
 const issues=[];try{references(root);}catch(error){issues.push(`reference: ${error.message}`);}
 if(!same(source,SOURCE))issues.push('callable presence observation');
 if(!Array.isArray(rows)||rows.length!==specs.length)return {status:'MISMATCH',count:Array.isArray(rows)?rows.length:0,issues:[...issues,'case count']};
 for(let i=0;i<specs.length;i++){
  const row=rows[i],spec=specs[i];
  if(!keys(row,['case','operation','input','native','snapshot','legacy','matched'])||row.case!==spec.case||row.operation!==spec.operation||!same(row.input,spec.input)) {issues.push(`identity/input at ${i}`);continue;}
  if(row.matched!==true||!validResult(spec.operation,row.native)||!same(row.native,row.snapshot)||
     (spec.legacy?!same(row.native,row.legacy):row.legacy!==null))issues.push(`result mismatch: ${spec.operation}/${spec.case}`);
 }
 return {status:issues.length?'MISMATCH':'BOUNDED_MATCH',count:rows.length,issues,scope:'Six fixed inputs on one active map; same-runtime values and callable presence only. No whole SDK digest or contract promotion.'};
}
/** Verify current input, run and log hashes before recording observations. */
export function collectSdkMapGeometryObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const fail=message=>{throw Error(message);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline or SDK mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform library fingerprint');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current source inputs');references(root);
  const records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(r=>r.platform===p).length!==1))fail('integration record set');
  const contracts={'realToScreen':'Tmapv3.Map#realToScreen','screenToReal':'Tmapv3.Map#screenToReal'};
  const out=Object.fromEntries(Object.entries(contracts).map(([method,id])=>[id,{status:'observed-not-verified',method,baselineId:BASE,expectedSdkSha256:SDK,
   sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},platforms:{},limitations:[
    'Six selected inputs on a changing live map; each row compares values obtained in the same runtime. No full-domain equivalence or contract promotion.',
    'The source observation measures function-handle presence, not callable text, entire SDK bytes or closure identity on the device.',
    'Snapshot inputs and results have no JS object identity. Native handles preserve identity under their own bridge lifetime and error semantics.',
    'The legacy forward path constructs a normalized SDK LatLng; the signed-zero forward row deliberately has no legacy comparison.',
    'Native Map.realToScreen applies SDK integer rounding; Vsm projection uses a different unrounded path.',
    'No row asserts special-number results or a fixed map transform, and the native input object is not re-read after the call.'
   ]}]));
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const load=(file,digest)=>{const bytes=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail('log or run digest');return bytes.toString('utf8');};
   const log=load(rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const completion=parsePlatformTextResults(lines);if(rec.platform==='web'?!completion.webPassed:!completion.mobilePassed)fail('completion marker');
   const found=lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&['sdkMapGeometrySources','sdkMapGeometryResults'].includes(row.field)?[{field:row.field,data:JSON.parse(row.payload),line:index+1}]:[];});
   const sources=found.filter(x=>x.field==='sdkMapGeometrySources'),rows=found.filter(x=>x.field==='sdkMapGeometryResults');
   if(sources.length!==1||rows.length!==6||found[0]!==sources[0]||!same(sources.map(x=>x.data),rec.sdkMapGeometrySources)||!same(rows.map(x=>x.data),rec.sdkMapGeometryResults))fail('log observation set or ordering');
   const comparison=compareSdkMapGeometry({source:sources[0].data,rows:rows.map(x=>x.data)},{root});if(comparison.status!=='BOUNDED_MATCH')fail(`comparison: ${JSON.stringify(comparison)}`);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const [method,id] of Object.entries(contracts)){const selected=rows.filter(x=>x.data.operation===method);out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:sources[0].data,ref:ref(sources[0])},cases:selected.map(x=>({observation:x.data,ref:ref(x)}))};}
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-map-geometry-observations-rejected',reason:String(error.message)}]};}
}
