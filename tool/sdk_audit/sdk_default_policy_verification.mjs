import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {runSdkDefaultPolicySourceProbe} from './sdk_default_policy_source_probe.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER=['example/integration_test/native_default_policy_contracts.dart','5dec86b30e2e1fa1b747e5be83ae156e91f937de87e1469da2f9780d90e0c6bc'],REVIEW=['docs/sdk-audit/reviews/sdk-default-policy-source-review.json',"9ddc9404aa1f54edc8eac4de6672b3c16389eab49d8b2712824d9d020f8e5faf"];
const SPANS={eventClass:[497022,497271,'ca029c64c9287b90c626dde3965d95963b4657b9497ef5a925dcec7413270cce'],domEvents:[497456,497860,'4e432edd80c7e217daaf9d6f2b691d5b4f8be64f8e557f1c703c2118cec9ffee'],mouseDown:[528677,528987,'1fc4d7d6b6ad5e36c4b20e8a236d8fde7bf45198a9e4241d93a90ded06804c98'],wheel:[529500,529614,'9569cf1ad4d934c17681d92db286b830b96fb911f8c050a25c089c374f19759d'],touchStart:[529614,529904,'3d1b8bcacd2b9a3a0bedad1aad3a8263d316ca59dcaa1018ec0b983bcf1c1ddc'],eventFactories:[530191,530309,'93e6d675a61ed934325511c88e5e63b9e1d177bdd582c82704b741da438900cb'],engineMethods:[708798,709007,'037780844d72070e6f8616cf11f7b107d22f725754a0519c1332522848cb2096']};
const EXPECTED={mechanism:'synthetic SDK engine emit',before:[['Wheel',false],['Wheel',false],['Wheel',false],['MouseDown',false],['TouchStart',false]],after:[['Wheel',false],['Wheel',true],['Wheel',false],['MouseDown',true],['TouchStart',true]],wheelOnceMatches:1,mouseMatches:1,touchMatches:1,wheelObserverCount:3,afterCancel:false,cancelListenersPreserved:true,errors:0};
const fail=m=>{throw Error(m);};
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file))fail('invalid evidence path');const target=path.resolve(root,file);
 if(!target.startsWith(path.resolve(root)+path.sep)||!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('invalid evidence path');
 const bytes=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail('evidence hash mismatch: '+file);return bytes.toString('utf8');
}
function sources(root,current){
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK),review=JSON.parse(load(root,...REVIEW));load(root,...HELPER);
 if(review.status!=='SOURCE_AND_MOCK_TESTED_LIVE_PENDING_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16')fail('source review mismatch');
 if(!current.inputs.some(x=>x.file===HELPER[0]&&x.sha256===HELPER[1])||!Array.isArray(review.files)||review.files.filter(x=>x.file===HELPER[0]&&x.sha256===HELPER[1]).length!==1)fail('helper binding mismatch');
  if(review.sourceProbe?.file!=='tool/sdk_audit/sdk_default_policy_source_probe.mjs'||review.sourceProbe?.test!=='tool/sdk_audit/test/sdk_default_policy_source_probe.test.mjs')fail('source probe binding mismatch');
  load(root,review.sourceProbe.file,review.sourceProbe.sha256);load(root,review.sourceProbe.test,review.sourceProbe.testSha256);
  runSdkDefaultPolicySourceProbe({root});
 for(const f of review.files.filter(x=>x.file.startsWith('lib/')))if(current.libFingerprint.files[f.file]!==f.sha256)fail('reviewed library mismatch');
 let methods;for(const [name,[start,end,digest]] of Object.entries(SPANS)){const text=sdk.slice(start,end),item=review.source?.[name];
  if(sha(text)!==digest||item?.start!==start||item?.end!==end||item?.sha256!==digest)fail('SDK source span mismatch: '+name);if(name==='engineMethods')methods=text;}
 const part=(a,b)=>methods.slice(methods.indexOf(a),methods.indexOf(b));
 return {engineOn:part('on(t,e){','once(t,e){'),engineOff:part('off(t,e){','getListenerCount(t){'),engineEmit:methods.slice(methods.indexOf('emit(t){'))};
}
/** Groups bounded synthetic observations; does not promote contract statuses. */
export function collectSdkDefaultPolicyObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK)||!ev||!same(ev.libFingerprint,libFingerprint))fail('baseline or fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current run inputs mismatch');
  const expectedSources=sources(root,current),records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate platform runs');
  const common={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations:['Plain synthetic event-shaped objects were emitted through the SDK engine; SDK input gates, DOM defaults and trusted gestures were not exercised by this helper.','A predeclared synchronous SDK policy is not a synchronous decision from Dart. Listener ordering follows registration order.','Cancelled callbacks were observed inert while other listeners ran; engine listener membership/removal was not measured.','Runtime callable text does not establish device SDK bundle bytes or closure identity.','Successful run requires cleanup without reported errors; cleanup details are not separately emitted.']};
  const out={'Vsm.Map#on':{...common,scope:'Selected synthetic SDK engine policy and observer callbacks.',platforms:{}},'Vsm.Map#off':{...common,scope:'Callback suppression and independent listener delivery after policy cancellation; membership unmeasured.',platforms:{}}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=load(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('unsuccessful run');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   if(!(rec.platform==='web'?parsePlatformTextResults(lines).webPassed:parsePlatformTextResults(lines).mobilePassed))fail('completion marker');
   const parse=marker=>lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.marker===marker?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   const src=parse('SDK DEFAULT POLICY SOURCE:'),res=parse('SDK DEFAULT POLICY RESULT:');
   if(src.length!==1||res.length!==1||src[0].line>=res[0].line||!same(src.map(x=>x.data),rec.sdkDefaultPolicySources)||!same(res.map(x=>x.data),rec.sdkDefaultPolicyResults))fail('missing, duplicate, reordered or altered observations');
   if(!same(src[0].data,expectedSources)||!same(res[0].data,EXPECTED))fail('source or result mismatch');
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   const obs={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:src[0].data,ref:ref(src[0])},observation:res[0].data,resultRef:ref(res[0])};
   for(const value of Object.values(out))value.platforms[rec.platform]=obs;
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-default-policy-observations-rejected',reason:String(error.message)}]};}
}
