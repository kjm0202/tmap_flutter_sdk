import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT, sha} from './common.mjs';
import {capturePlatformInputs, validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine, parsePlatformTextResults} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const SDK_FILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const REVIEW='docs/sdk-audit/reviews/sdk-native-environment-source-review.json';
const REVIEW_SHA='ca20ebd9caeb07292371c95e9bf0bf58d06a2e680f519f794cc5c53d59dd6055';
const sources=[
 ['Tmapv3.base.Config namespace',836829,839411,'ce8d4c12f32f00589dd3fc333e33dd759fbdd09236894d050c01876bc2bf7325'],
 ['Vsm.Map#setControlDock',711115,711163,'8d0088a7578a8d07c6580fdeb28b9301324ff4e3bf874789c79154ffd1359029'],
 ['Vsm.Map#getControlDock',711163,711207,'0c37d5dbd8d335ab236292a35a1f1fa9c9d0560d3e50f61143e255e3361269cc'],
 ['Vsm.Map#addControl',711207,711390,'1fd48dc34422b798984305cd2aba124e07b3d390c8467c0b41b953698501e047'],
 ['Vsm.Map#enable',712211,712356,'819be29e7fce3a01bc59f802d39473ed9298988dd18216fa8ae05d0c32dd28c8'],
 ['Vsm.Map#disable',712356,712505,'041c2e63c595f38d66fa3a43cf8227ba5d3a5a221e438407234e62cf45903e42'],
 ['Vsm.Map#isEnabled',712505,712540,'b2b27308ccb273b9bb05b09ac0ff482e91883e3222a5df2153a47f0d612fb549'],
 ['Vsm.Map#getPoiScale',715222,715305,'3e9f91f31c2ff67fadf881058044fa05cf502ad36ac8a680402a25a4d709d2c6'],
 ['Vsm.Map#setPoiScale',715305,715637,'8d1488776f833a0de0f1ae157d16801042a68babdec7ab6c7623e0e8a704640e'],
 ['Vsm.Extensions.TmapUtils initializer',725895,727915,'fe0e776dc6dd4965e1c7879849e0bf8f6f44724531a5e65b813619d444012d45'],
 ['Vsm.Map.ControlDockNames initializer',507574,507723,'ea75d3a5007d7b92d8f7186340b65fd30123eb83d56d2351b360999357e01fc5'],
 ['Vsm.Map.AdditionalFuncNames initializer',696252,696612,'471756afdbbefa0144d2ae2244126db0fa78cca83488ea508d575af4944682b0']
].map(([id,start,end,sha256])=>({id,start,end,sha256}));
const files=['lib/src/models/sdk_native_environment.dart','test/support/sdk_native_environment_vm.mjs','test/sdk_native_environment_test.dart','example/integration_test/sdk_native_environment_contracts.dart'];
const fail=x=>{throw Error(x);};
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');
 const bytes=fs.readFileSync(path.join(root,file));
 if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail('digest '+file);
 return bytes;
}
function refs(root){
 const r=JSON.parse(load(root,REVIEW,REVIEW_SHA));
 if(r.status!=='OPEN'||r.baselineId!==BASE||r.sdkSha256!==SDK||r.offsetUnit!=='UTF-16'||!same(r.source,sources)||!same(r.files?.map(x=>x.file),files))fail('review metadata');
 const sdk=load(root,SDK_FILE,SDK).toString('utf8');
 for(const x of sources)if(sha(sdk.slice(x.start,x.end))!==x.sha256)fail('source span '+x.id);
 for(const x of r.files)load(root,x.file,x.sha256);
 return r;
}
const debug=['showTileDebugInfo','showVectorTileDebugInfo','showLegacyVectorTileDebugInfo','showLegacyRasterTileDebugInfo','showCollisionDetection','showPoiVertex','showNetwork'];
const docks=['defaultDock','topLeft','topRight','bottomLeft','bottomRight'];
const bools=keys=>Object.fromEntries(keys.map(key=>[key,true]));
const rows=[
 {id:'config',status:'observed',checks:bools(['configIdentity','pixelIdentity','resolutionCallable','maxExtentCallable','resolutionFromCurrentTable'])},
 {id:'poi-presets',status:'observed',checks:bools(['getPoiScaleCallable','setPoiScaleCallable',...['small','normal','large'].flatMap(k=>[`${k}Identity`,`${k}HasScaleFields`])])},
 {id:'engine-names',status:'observed',checks:bools([...['enable','disable','isEnabled','addControl','getControlDock','setControlDock'].map(k=>`${k}Callable`),...debug.flatMap(k=>[`${k}Value`,`${k}State`]),...docks.map(k=>`${k}Value`)])}
];
export function compareSdkNativeEnvironment(input,{root=ROOT}={}){
 try{refs(root);if(!same(input,rows))fail('ordered row schema and checks');return {status:'BOUNDED_MATCH',issues:[]};}
 catch(e){return {status:'MISMATCH',issues:[String(e.message)]};}
}
export function collectSdkNativeEnvironmentObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline');
  refs(root);const current=capturePlatformInputs(root),ev=runtime?.platformEvidence;
  if(!ev||!same(ev.libFingerprint,libFingerprint)||!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform set');
  const item={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured on platform',libFingerprintSha256:libFingerprint.sha256,sourceReview:{file:REVIEW,sha256:REVIEW_SHA},nativeSource:{file:SDK_FILE,sha256:SDK,offsetUnit:'UTF-16',spans:sources},limitations:[
   'Three bounded rows observe Config identity and one resolution, live POI preset handles and field types, callable presence, and current debug/dock names and debug state.',
   'They do not observe POI setter execution, debug mutation, control lifecycle, render completion, dynamic SDK callable text, device SDK bytes, or the complete Config and constant domains.',
   'All names and nested preset objects remain mutable; handles have bridge-scoped lifetime and aliasing. Host setter/control transport stubs are not native renderer evidence.',
   'Observations do not promote or close any contract.'
  ],platforms:{}};
  for(const rec of records){
   const file=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==file||rec.run?.file!==file+'.run.json')fail('record');
   const lines=load(root,file,rec.sha256).toString('utf8').split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.exitCode!==0||run.signal!==null||run.sanitizedLogSha256!==rec.sha256)fail('run');
   const {sanitizedLogSha256,...raw}=run;
   validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const done=parsePlatformTextResults(lines);if(!(rec.platform==='web'?done.webPassed:done.mobilePassed))fail('completion');
   const found=lines.flatMap((line,i)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&x.field==='sdkNativeEnvironmentResults'?[{data:JSON.parse(x.payload),line:i+1}]:[];});
   if(!same(found.map(x=>x.data),rec.sdkNativeEnvironmentResults))fail('recorded log rows');
   const cmp=compareSdkNativeEnvironment(found.map(x=>x.data),{root});if(cmp.status!=='BOUNDED_MATCH')fail('comparison '+cmp.issues.join(','));
   item.platforms[rec.platform]={log:{file,sha256:rec.sha256},run:rec.run,cases:found.map(x=>({observation:x.data,ref:{file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations:{sdkNativeEnvironment:item},issues:[]};
 }catch(e){return {observations:{},issues:[{code:'sdk-native-environment-observations-rejected',reason:String(e.message)}]};}
}
