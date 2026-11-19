import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER=['example/integration_test/native_sdk_events_contracts.dart','a532585b5e3cbd58bb5bb54d0f142e71897830001deed0d55288855b6cbaf119'];
const REVIEW=['docs/sdk-audit/reviews/native-sdk-events-source-review.json','86bdacefd470b8ba7b5e3d4d5d0fc230532d1f00092b29ec92ebb8de55d7060c'];
const SPANS={eventBase:[496893,497022,'a4543c11a2b4a72d9d55f178763702b775f35eaf18f4d7bae83d1988e44d6c7c'],mapEvent:[497022,497271,'ca029c64c9287b90c626dde3965d95963b4657b9497ef5a925dcec7413270cce'],engineMethods:[708798,709007,'037780844d72070e6f8616cf11f7b107d22f725754a0519c1332522848cb2096'],wrapperOn:[1261195,1261703,'c2e06fa64ec3dc4d91d83a8eb36d9987705bf54ce63c3c373d8335a2a1b4741e'],wrapperOff:[1261704,1261994,'7036d92e65a9e4b304a094959c37b47a5123a2294dbf8d2785898e4b940da919']};
const fail=m=>{throw Error(m);};
function load(root,file,digest){
 const target=path.resolve(root,file);if(typeof file!=='string'||path.isAbsolute(file)||!target.startsWith(path.resolve(root)+path.sep)||!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('invalid evidence path');
 const data=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(data)!==digest)fail('evidence digest mismatch: '+file);return data.toString('utf8');
}
function sources(root,current){
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK),review=JSON.parse(load(root,...REVIEW));load(root,...HELPER);
 if(review.status!=='SOURCE_AND_MOCK_TESTED_LIVE_PENDING_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16')fail('source review mismatch');
 if(!current.inputs.some(x=>x.file===HELPER[0]&&x.sha256===HELPER[1]))fail('helper input mismatch');
 if(!Array.isArray(review.files)||review.files.filter(x=>x.file===HELPER[0]&&x.sha256===HELPER[1]).length!==1)fail('review fixture mismatch');
 for(const entry of review.files.filter(x=>x.file.startsWith('lib/')))if(current.libFingerprint.files[entry.file]!==entry.sha256)fail('reviewed library mismatch');
 const texts={};for(const [name,[start,end,digest]] of Object.entries(SPANS)){
  const item=review.source?.[name],value=sdk.slice(start,end);
  if(item?.start!==start||item?.end!==end||item?.sha256!==digest||sha(value)!==digest)fail('source span mismatch: '+name);texts[name]=value;
 }
 const fn=x=>x.slice(x.indexOf('function'));
 const methods=texts.engineMethods;
 const method=(a,b)=>methods.slice(methods.indexOf(a),methods.indexOf(b));
 return {wrapperOn:fn(texts.wrapperOn),wrapperOff:fn(texts.wrapperOff),engineOn:method('on(t,e){','once(t,e){'),engineOnce:method('once(t,e){','off(t,e){'),engineOff:method('off(t,e){','getListenerCount(t){'),engineEmit:methods.slice(methods.indexOf('emit(t){'))};
}
const EXPECTED={synthetic:{move:2,once:1,cancel:1,longTap:1,sameEvent:true,sameTarget:true,cyclicData:true,negativeZero:true,externalAfterCancel:3},cameraJump:{zoom:1,target:true,readonlyTarget:true,preventDefaultState:true,constructedEvent:true}};
/** Bounded observations only; no contract is promoted by this collector. */
export function collectNativeSdkEventsObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('run inputs mismatch');
  const callableSources=sources(root,current),records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate runs');
  const limitations=['Synthetic TouchMove, TouchCancel and LongTap emissions are not physical input.','Camera jump is a separate actual SDK action; selected cases do not prove complete Map.on/off or Vsm.Event behavior.','Dart callbacks are asynchronous relative to SDK dispatch; preventDefault state does not prove synchronous cancellation.','Runtime callable text does not establish SDK bytes or private closure identity on the device.','Cleanup was required for helper success but its individual operations were not separately recorded.'];
  const scopes={'Tmapv3.Map#on':'Engine subscriptions, once, retained event identity and isolated cancellation for selected synthetic names; actual camera Zoom.', 'Vsm.Event':'Actual camera Zoom event and an object constructed through its runtime constructor; selected identity and preventDefault state.', 'Vsm.Event#name':'Selected actual camera Zoom and constructed Probe name values.', 'Vsm.Event#data':'Selected synthetic cyclic data and constructed Probe data access.'};
  const out={};for(const [key,scope] of Object.entries(scopes))out[key]={status:'observed-not-verified',scope,baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations,platforms:{}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=load(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   if(!(rec.platform==='web'?parsePlatformTextResults(lines).webPassed:parsePlatformTextResults(lines).mobilePassed))fail('integration completion marker');
   const parse=marker=>lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.marker===marker?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   const src=parse('NATIVE SDK EVENTS SOURCE:'),res=parse('NATIVE SDK EVENTS RESULT:');
   if(src.length!==1||res.length!==1||src[0].line>=res[0].line||!same(src.map(x=>x.data),rec.nativeSdkEventSources)||!same(res.map(x=>x.data),rec.nativeSdkEventResults))fail('missing, duplicate, reordered or altered markers');
   if(!same(src[0].data,callableSources)||!same(res[0].data,EXPECTED))fail('callable source or result mismatch');
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   const obs={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:src[0].data,ref:ref(src[0])},observation:res[0].data,resultRef:ref(res[0])};
   for(const value of Object.values(out))value.platforms[rec.platform]=obs;
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'native-sdk-events-observations-rejected',reason:String(error.message)}]};}
}
