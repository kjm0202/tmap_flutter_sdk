import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW='docs/sdk-audit/reviews/native-resources-integration-review.json';
const REVIEW_SHA="ef91a25e8a6fdd0a2d6e4bae7caab9b5773e8bfc4791fc6fb58cc70319074005";
const groups={
  domOccurrence:{field:'domOccurrenceCaptureResults',marker:'DOM EVENT OCCURRENCE RESULT:'},
  engineCleanup:{field:'nativeEngineCleanupResults',marker:'NATIVE ENGINE CLEANUP RESULT:'},
  managedCluster:{field:'sdkManagedMarkerClusterResults',marker:'SDK MANAGED MARKER CLUSTER RESULT:'},
  shapeEvents:{field:'sdkShapeEventsResults',marker:'SDK SHAPE EVENTS RESULT:'},
  xmlKmlForwarding:{field:'sdkXmlKmlForwardingResults',marker:'SDK XML KML FORWARD RESULT:'},
  mapClose:{field:'mapCloseResults',marker:'MAP CLOSE RESULT:'},
  bulkOff:{field:'nativeBulkOffEmitterResults',marker:'NATIVE BULK OFF EMITTER RESULT:'},
};
const fail=x=>{throw Error(x);};
const keys=(x,names)=>x&&typeof x==='object'&&!Array.isArray(x)&&same(Object.keys(x).sort(),[...names].sort());
const allChecks=(x,names)=>keys(x,names)&&Object.values(x).every(v=>v===true);
export function compareNativeResourceRows(name,rows){
  if(!Array.isArray(rows)||!groups[name])return false;
  if(name==='xmlKmlForwarding')return rows.length===4&&rows.every((r,i)=>keys(r,['id','passed','scope'])&&r.id===['native-constructor-read','guarded-depth','xml-shared-document','synthetic-full-arguments'][i]&&r.passed===true&&r.scope==='native-sdk-detached-dom-synthetic-spy');
  if(rows.length!==1)return false;const r=rows[0];
  if(name==='domOccurrence')return keys(r,['scope','checks','passed'])&&r.scope==='synthetic-dom-sdk-canvas'&&r.passed===true&&allChecks(r.checks,['receiver','sameEvent','currentAtDispatch','pathAtDispatch','currentAfterDispatch','synthetic','externalFirst','onceAbortCancel','externalPreserved','eventAfterCancel']);
  if(name==='engineCleanup')return keys(r,['scope','checks','passed'])&&r.scope==='synthetic-failure-real-sdk-emitter'&&r.passed===true&&allChecks(r.checks,['registered','initialDelivery','failureAndToken','deliverySuppressed','retainedExact','partialRetry','retryAndForeign','foreignStillInvoked','originalEmitter','replacementPreserved']);
  if(name==='mapClose')return keys(r,['scope','checks','before','after','passed'])&&r.scope==='real-sdk-terminal-close'&&r.passed===true&&allChecks(r.checks,['before','sdkListenersCleared','sdkDestroyNotDelivered','wrapperContainerRemoved','handleExpired'])&&same(r.before,{destroy:true,foreign:true,attached:true})&&same(r.after,{destroyListeners:0,foreignListeners:0,destroyCount:0,foreignCount:0,attached:false});
  if(name==='bulkOff')return keys(r,['scope','cases','passed'])&&r.scope==='synthetic-failure-real-sdk-emitter'&&r.passed===true&&Array.isArray(r.cases)&&r.cases.length===2&&r.cases.every((c,i)=>keys(c,['id','checks','affected','pendingAfterFailure','cleanupToken','errorName','errorMessage','thrownKind','counts','passed'])&&c.id===['engineOff','wrapperOff'][i]&&allChecks(c.checks,['registered','initialDelivery','currentForeignRemoved','firstOldRemoved','failureTokenAndAffected','oldForeignOnly','retryExact','deliveryStillSuppressed'])&&same(c.affected,['engine','wrapper'])&&c.pendingAfterFailure===1&&typeof c.cleanupToken==='string'&&c.cleanupToken.length>0&&c.errorName==='Error'&&c.errorMessage==='Error: synthetic old-emitter off failure'&&c.thrownKind==='handle'&&same(c.counts,{oldHits:3,currentHits:0,delivered:2})&&c.passed===true);
  if(name==='managedCluster')return keys(r,['status','independent','initialForeignCount','attachedDelta','afterFirstDetachDelta','afterSecondDestroyDelta','finalDelta','tracked'])&&r.status==='observed'&&r.independent===true&&Number.isInteger(r.initialForeignCount)&&r.initialForeignCount>=1&&r.attachedDelta===2&&r.afterFirstDetachDelta===1&&r.afterSecondDestroyDelta===0&&r.finalDelta===0&&same(r.tracked,[1,1]);
  if(name==='shapeEvents')return keys(r,['status','mechanism','rawRegistrationFailed','firstDispatch','afterManagedCancel','gestureProbeRequested','gestureCounts','gestureTrustVerified'])&&r.status==='observed'&&r.mechanism==='attached SDK polyline, synthetic pixel path, direct tapChecker'&&r.rawRegistrationFailed===true&&same(r.firstDispatch,[1,1])&&same(r.afterManagedCancel,[1,2])&&r.gestureProbeRequested===false&&same(r.gestureCounts,[0,0])&&r.gestureTrustVerified===false;
  return false;
}
function load(root,file,digest){
  if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid reference path');
  const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('reference escapes root');
  const b=fs.readFileSync(p);if(sha(b)!==digest)fail('reference mismatch: '+file);return b;
}
/** Source-bound, bounded observations only. No ledger status or API proof. */
export function collectNativeResourceObservations({runtime,manifest,libFingerprint,root=ROOT}){
  try{
    if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
    const ev=runtime?.platformEvidence,current=capturePlatformInputs(root);
    if(!ev||!same(current,{libFingerprint,inputs:ev.inputs})||!same(ev.libFingerprint,libFingerprint))fail('current inputs mismatch');
    const review=JSON.parse(load(root,REVIEW,REVIEW_SHA));
    if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||!Array.isArray(review.files)||!review.files.length||!same(Object.keys(review.groups).sort(),Object.keys(groups).sort()))fail('source review scope');
    load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK);
    for(const ref of [...review.files,...review.priorReviews])load(root,ref.file,ref.sha256);
    for(const [name,group] of Object.entries(groups)){
      const helper=review.groups[name].helper;
      if(!review.files.some(x=>x.file===helper)||review.groups[name].field!==group.field||review.groups[name].marker!==group.marker)fail('helper binding');
      for(const entry of ['example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart']){
        if(!review.files.some(x=>x.file===entry))fail('entrypoint binding');
        const source=fs.readFileSync(path.join(root,entry),'utf8');
        if(!source.includes("import '"+path.basename(helper)+"';")||!source.includes('await '+review.groups[name].function+'('))fail('missing helper invocation');
      }
    }
    const records=(ev.records||[]).filter(x=>x.kind==='integration');
    if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('platform records');
    const observations=Object.fromEntries(Object.keys(groups).map(name=>[name,{status:'observed-not-verified',sourceReview:{file:REVIEW,sha256:REVIEW_SHA},scope:review.groups[name].scope,platforms:{}}]));
    for(const rec of records){
      const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
      if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('record status or path');
      const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
      if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
      const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
      if(!platformLogPassed(lines,rec.platform))fail('success marker');
      for(const [name,group] of Object.entries(groups)){
        const rows=parsePlatformMarkerRows(lines,group.marker),data=rows.map(x=>x.data);
        if(!same(data,rec[group.field])||!compareNativeResourceRows(name,data))fail('invalid observations: '+name);
        observations[name].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
      }
    }
    return {observations,issues:[]};
  }catch(error){return {observations:{},issues:[{code:'native-resource-observations-rejected',reason:String(error.message)}]};}
}
