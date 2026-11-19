import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {runSdkEventGettersSourceProbe} from './sdk_event_getters_source_probe.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER=['example/integration_test/sdk_event_getters_contracts.dart','a976b02c1f0b778e868d232e0ac16dd4a64582a92e6f0a13d5444f582debe99d'],REVIEW=['docs/sdk-audit/reviews/sdk-event-getters-source-review.json','e276814b9577e098513f1a913b801a9c1ecd83dffb01dd6ef7f411b3a684fc1d'];
const SPANS={base:[496893,497022,'a4543c11a2b4a72d9d55f178763702b775f35eaf18f4d7bae83d1988e44d6c7c'],subclass:[497022,497271,'ca029c64c9287b90c626dde3965d95963b4657b9497ef5a925dcec7413270cce'],cameraEmission:[501538,501604,'7950dde0c7a581c383a9cfa9785222da423dac8c941b1ab6169d0d30996c6738'],exportBinding:[727916,727939,'5b501af0eaf00d9805b69df9744d1e147525fb0debe8c13f0f3178d3b7ac364b']};
const IDS=['undefined','null','false','true','emptyString','unicode','zero','negativeZero','finite','nan','positiveInfinity','negativeInfinity','bigint','symbol','function','array','cycle','htmlDda'];
const CASES=IDS.map(id=>({id,name:true,data:true,readOnly:true,nativeIdentity:true,backingMutation:true,releaseAndReacquire:true}));
const THROWN=['undefined','null','negativeZero','nan','symbol','object','error','hostile'].map(id=>({id,name:true,data:true,valueIdentity:true,stackChecked:id==='error',safeDescriptionChecked:id==='hostile'}));
const fail=m=>{throw Error(m);};
function load(root,file,digest){if(typeof file!=='string'||path.isAbsolute(file))fail('invalid evidence path');const target=path.resolve(root,file);if(!target.startsWith(path.resolve(root)+path.sep)||!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');const b=fs.readFileSync(target);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('evidence hash mismatch: '+file);return b.toString('utf8');}
function sources(root,current){
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK),review=JSON.parse(load(root,...REVIEW));load(root,...HELPER);
 if(review.status!=='SOURCE_AND_MOCK_TESTED_LIVE_PENDING_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16')fail('source review mismatch');
 if(!current.inputs.some(x=>x.file===HELPER[0]&&x.sha256===HELPER[1])||!Array.isArray(review.files)||review.files.filter(x=>x.file===HELPER[0]&&x.sha256===HELPER[1]).length!==1)fail('helper binding mismatch');
 for(const f of review.files){if(f.file.startsWith('lib/')){if(current.libFingerprint.files[f.file]!==f.sha256)fail('reviewed library mismatch');}else if(f.file.startsWith('tool/sdk_audit/')||f.file.startsWith('test/'))load(root,f.file,f.sha256);}
 for(const [name,[start,end,digest]] of Object.entries(SPANS)){const r=review.source?.[name];if(r?.start!==start||r?.end!==end||r?.sha256!==digest||sha(sdk.slice(start,end))!==digest)fail('source span mismatch: '+name);}
 const proof=runSdkEventGettersSourceProbe({root});if(!same(proof.cases,CASES.slice(0,-1))||!same(proof.thrownCases,THROWN)||proof.subclass!==true)fail('source probe mismatch');
 const descriptor={enumerable:false,configurable:true,hasSetter:false};
 return {sameEvent:true,sameCameraData:true,subclass:true,htmlDdaSupported:true,exportedBase:true,ownName:false,ownData:false,constructor:sdk.slice(...SPANS.base.slice(0,2)),
  nameGetter:'get name(){return this.di}',dataGetter:'get data(){return this.fi}',nameDescriptor:descriptor,dataDescriptor:descriptor};
}
/** A finite observed value matrix; never promotes getter or event contracts. */
export function collectSdkEventGettersObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK)||!ev||!same(ev.libFingerprint,libFingerprint))fail('baseline or fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current run inputs mismatch');
  const expectedSource=sources(root,current),records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate platform runs');
  const result={mechanism:'SDK camera jump and actual exported Vsm.Event constructor',subclassIdentity:true,cameraName:'Zoom',cases:CASES,thrownCases:THROWN,limitations:['Selected values only; no physical gesture or whole Vsm.Event/Map.on parity.']};
  const common={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations:['Selected values and source structure do not establish every JS value, host exotic, proxy, mutation, OS or lifecycle.','Copied Dart collections do not preserve JS reference identity; retained handles do so only within one bridge until release.','Camera jump is not physical input. Device SDK bytes and closure identity are not measured.','Ordinary descriptor behavior can be altered by property or prototype mutation; this does not prove complete Vsm.Event or Map.on behavior.']};
  const out={'Vsm.Event#name':{...common,scope:'Base constructor getter and selected value/descriptor/handle lifetime observations.',platforms:{}},'Vsm.Event#data':{...common,scope:'Base constructor getter and selected value/descriptor/handle lifetime observations.',platforms:{}}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=load(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid successful run');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const status=parsePlatformTextResults(lines);if(!(rec.platform==='web'?status.webPassed:status.mobilePassed))fail('completion marker');
   const parse=field=>lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.field===field?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   const src=parse('sdkEventGettersSources'),res=parse('sdkEventGettersResults');
   if(src.length!==1||res.length!==1||src[0].line>=res[0].line||!same(src.map(x=>x.data),rec.sdkEventGettersSources)||!same(res.map(x=>x.data),rec.sdkEventGettersResults))fail('missing, duplicate, reordered or altered observations');
   if(!same(src[0].data,expectedSource)||!same(res[0].data,result))fail('getter source or result mismatch');
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   const observation={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:src[0].data,ref:ref(src[0])},observation:res[0].data,resultRef:ref(res[0])};
   for(const v of Object.values(out))v.platforms[rec.platform]=observation;
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-event-getters-observations-rejected',reason:String(error.message)}]};}
}
