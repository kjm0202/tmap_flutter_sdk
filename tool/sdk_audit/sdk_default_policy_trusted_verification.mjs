import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e', BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const REVIEW=['docs/sdk-audit/reviews/sdk-default-policy-trusted-source-review.json',"ccd05d11204b65c87dd653608737ba02fd7abdb1decf67b625c6d8fdf6f0178f"];
const IDS=['policy-blocked','policy-after-cancel','policy-once-first','policy-once-second','policy-mismatch','policy-after-dispose'];
const ALL_IDS=['map-pan-before-cancel','map-pan-after-cancel','marker-drag',...IDS,'managed-marker-click','map-longtap-hold'];
const SPACE={web:'browser-css',android:'device-pixels',ios:'screen-points'},MECH={web:'Chrome DevTools mouse input',android:'adb touchscreen swipe',ios:'XCTest coordinate drag'};
const fail=x=>{throw Error(x)};
const number=x=>typeof x==='number'&&Number.isFinite(x), near=(a,b,t=1e-8)=>number(a)&&number(b)&&Math.abs(a-b)<=t;
const point=x=>x&&number(x.x)&&number(x.y),position=x=>Array.isArray(x)&&x.length===2&&x.every(number);
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
function load(root,file,digest){if(typeof file!=='string'||path.isAbsolute(file))fail('invalid path');const f=path.resolve(root,file);if(!f.startsWith(path.resolve(root)+path.sep)||!fs.realpathSync(f).startsWith(fs.realpathSync(root)+path.sep))fail('path escapes root');const b=fs.readFileSync(f);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('hash mismatch: '+file);return b.toString('utf8')}
function checkRow(platform,q,d,r,run,drivers,compiled){
 if(q?.schemaVersion!==1||q.id!==r.id||q.action!=='drag'||q.coordinateSpace!==SPACE[platform]||q.durationMs!==700||![q.from,q.to].every(point))fail('invalid request');
 if(d?.schemaVersion!==1||d.id!==q.id||d.platform!==platform||d.status!=='dispatched'||d.mechanism!==MECH[platform]||d.coordinateSpace!==q.coordinateSpace||!same(d.from,q.from)||!same(d.to,q.to)||d.durationMs!==q.durationMs||!same(d.sourceFiles,drivers)||!same(d.compiledDriver,compiled)||!iso(d.startedAt)||!iso(d.finishedAt)||Date.parse(d.startedAt)>Date.parse(d.finishedAt)||(run&&(Date.parse(d.startedAt)<Date.parse(run.startedAt)||Date.parse(d.finishedAt)>Date.parse(run.finishedAt))))fail('driver dispatch mismatch');
 if(r.schemaVersion!==1||r.status!=='observed'||r.platform!==platform||r.mechanism!=='browser-or-os-injected-trusted-input'||r.pixelTolerance!==6||r.coordinateTolerance!==1e-8||r.scope!=='Six automated trusted drags; not human physical input or DOM preventDefault parity.')fail('invalid observation');
 const css=r.cssCoordinates,a=r.after,b=r.beforeCenter;
 if(!point(css?.from)||!point(css?.to)||!near(css.to.x-css.from.x,90,1e-6)||!near(css.to.y-css.from.y,35,1e-6)||!position(b)||!position(a?.center)||a.untrusted!==0||!Array.isArray(a.trusted)||!Array.isArray(a.events))fail('invalid coordinates or event trace');
 const sx=(q.to.x-q.from.x)/90,sy=(q.to.y-q.from.y)/35,tx=q.from.x-sx*css.from.x,ty=q.from.y-sx*css.from.y;
 if(!number(sx)||sx<=0||!near(sx,sy,1e-7)||!number(tx)||!number(ty))fail('CSS request transform mismatch');
 if(!a.trusted.every(e=>typeof e.type==='string'&&e.isTrusted===true&&number(e.x)&&number(e.y)))fail('untrusted DOM trace');
 const at=(e,p)=>near(e.x,p.x,6)&&near(e.y,p.y,6);let input=false;
 for(const names of [['pointerdown','pointermove','pointerup'],['touchstart','touchmove','touchend'],['mousedown','mousemove','mouseup']])for(let i=0;i<a.trusted.length;i++){const down=a.trusted[i];if(down.type!==names[0]||!at(down,css.from))continue;for(let j=i+1;j<a.trusted.length;j++){const move=a.trusted[j];if(move.type!==names[1])continue;const dx=move.x-css.from.x,dy=move.y-css.from.y,vx=90,vy=35,f=(dx*vx+dy*vy)/(vx*vx+vy*vy);if(f<=0||f>1.15||Math.hypot(dx-f*vx,dy-f*vy)>6)continue;if(a.trusted.slice(j+1).some(e=>e.type===names[2]&&at(e,css.to)))input=true;}}
 const event=platform==='web'?'MouseDown':'TouchStart',field=platform==='web'?'button':'touchCount',value=platform==='web'?0:1;
 if(r.sdkEvent!==event||!same(r.condition,{[field]:r.id==='policy-mismatch'?2:value})||!a.events.some(e=>e.name===event&&e.isTrusted===true&&e[field]===value)||!input||r.inputEnded!==true||r.matchedInput!==true||r.sdkListenerMatched!==true)fail('trusted SDK/DOM listener evidence mismatch');
 const changed=!near(b[0],a.center[0])||!near(b[1],a.center[1]),blocked=r.id===IDS[0]||r.id===IDS[2];
 if(r.positionChanged!==changed||changed===blocked)fail('center response mismatch');
 if(r.id===IDS[5]){if(r.priorStats!==null||r.endStats!==null||r.disposedStatsRejected!==true)fail('disposed state mismatch');}
 else {const p=r.priorStats,n=r.endStats;if(!p||!n||![p.matches,n.matches,p.errors,n.errors].every(Number.isInteger)||p.errors!==0||n.errors!==0||n.matches-p.matches!==(blocked?1:0)||n.active!==(r.id===IDS[0]||r.id===IDS[4])||typeof n.attached!=='boolean'||r.disposedStatsRejected!==null)fail('policy stats mismatch');}
 if(r.statsOk!==true)fail('policy stats reported failure');return [sx,tx,ty];
}
/** Compares six policy rows within the complete ten-action driver sequence.
 * The other drag and marker-tap observations have separate strict collectors. */
export function compareSdkDefaultPolicyTrustedRows({platform,requests,driverResults,results,run,drivers,compiled}){
 if(!SPACE[platform]||requests?.length!==11||driverResults?.length!==12||results?.length!==6)fail('missing or duplicate input observations');
 if(!same(requests.map(x=>x.id),ALL_IDS)||!same(driverResults.map(x=>x.id),[...ALL_IDS,'driver-lifecycle']))fail('complete input sequence mismatch');
 if(!driverResults.slice(0,-1).every(x=>x.status==='dispatched'&&same(x.sourceFiles,drivers)&&same(x.compiledDriver,compiled)))fail('other input dispatch incomplete');
 let transform,previousEnd;
 for(let i=0;i<6;i++){const q=requests[i+3],d=driverResults[i+3],r=results[i];if(r?.id!==IDS[i])fail('phase order mismatch');const t=checkRow(platform,q,d,r,run,drivers,compiled);if(transform&&!t.every((x,j)=>near(x,transform[j],1e-6)))fail('inconsistent input transform');transform=t;if(previousEnd&&Date.parse(d.startedAt)<previousEnd)fail('driver order mismatch');previousEnd=Date.parse(d.finishedAt);}
 const life=driverResults[11];if(life?.id!=='driver-lifecycle'||life.status!=='completed'||life.gestures!==11||life.requests!==11||life.error!==null||life.platform!==platform||!same(life.sourceFiles,drivers)||!same(life.compiledDriver,compiled))fail('incomplete driver lifecycle');return true;
}
/** Groups bounded trusted-input observations, without promoting contract status. */
export function collectSdkDefaultPolicyTrustedObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try {const ev=runtime?.platformEvidence;if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK)||!ev||!same(ev.libFingerprint,libFingerprint))fail('baseline or fingerprint mismatch');
 const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current input mismatch');
 const review=JSON.parse(load(root,...REVIEW)),sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK);if(review.status!=='SOURCE_REVIEW_ONLY'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16')fail('source review mismatch');
 load(root,review.helper.file,review.helper.sha256);if(!current.inputs.some(x=>same(x,review.helper)))fail('helper input mismatch');
 for(const [f,h] of Object.entries(review.modelFiles)){load(root,f,h);if(current.libFingerprint.files[f]!==h)fail('model input mismatch')}
 for(const [f,h] of Object.entries(review.drivers))load(root,f,h);
 for(const s of Object.values(review.source)){if(!Number.isInteger(s.start)||!Number.isInteger(s.end)||sha(sdk.slice(s.start,s.end))!==s.sha256)fail('SDK source span mismatch')}
 const build=JSON.parse(load(root,review.iosBuildManifest.file,review.iosBuildManifest.sha256));if(build.sourceFile!=='tool/sdk_audit/native_gesture_driver/TrustedInputTests.swift'||build.sourceSha256!==review.drivers[build.sourceFile]||build.buildExit!==0||!/^[a-f0-9]{64}$/.test(build.buildLogSha256||''))fail('invalid iOS build manifest');const compiled={...build,buildManifestSha256:review.iosBuildManifest.sha256};
 const records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing platform runs');
 const common={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,fixture:review.helper,sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations:review.limitations};const out={'Vsm.Map#on':{...common,scope:review.scope,platforms:{}},'Vsm.Map#off':{...common,scope:'Selected policy suppression and independent listener delivery after cancellation; native listener membership is not measured.',platforms:{}}};
 for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');const log=load(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid run');const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});const text=parsePlatformTextResults(lines);if(rec.platform==='web'?!text.webPassed:!text.mobilePassed)fail('missing completion');
 const fields=['trustedInputRequests','trustedInputDriverResults','sdkDefaultPolicyTrustedResults'],parsed=Object.fromEntries(fields.map(f=>[f,[]]));lines.forEach((line,i)=>{const v=decodePlatformLogLine(line);if(v?.kind==='json'&&fields.includes(v.field))parsed[v.field].push({data:JSON.parse(v.payload),line:i+1})});for(const f of fields)if(!same(parsed[f].map(x=>x.data),rec[f]))fail('log record mismatch: '+f);
 compareSdkDefaultPolicyTrustedRows({platform:rec.platform,requests:rec.trustedInputRequests,driverResults:rec.trustedInputDriverResults,results:rec.sdkDefaultPolicyTrustedResults,run,drivers:review.drivers,compiled:rec.platform==='ios'?compiled:null});const req=parsed.trustedInputRequests,drv=parsed.trustedInputDriverResults,res=parsed.sdkDefaultPolicyTrustedResults;for(let i=0;i<6;i++)if(req[i+3].line>=res[i].line||req[i+3].line>=drv[i+3].line||(i<5&&res[i].line>=req[i+4].line))fail('input/result order mismatch');if(drv[11].line<=drv[9].line)fail('driver lifecycle order mismatch');
 const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});const observations=res.map((x,i)=>({request:req[i+3].data,driver:drv[i+3].data,result:x.data,requestRef:ref(req[i+3]),driverRef:ref(drv[i+3]),resultRef:ref(x)}));for(const v of Object.values(out))v.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,observations,driverLifecycle:{observation:drv[11].data,ref:ref(drv[11])}};
 }
 return {byContract:out,issues:[]};
 } catch(error){return {byContract:{},issues:[{code:'sdk-default-policy-trusted-observations-rejected',reason:String(error.message)}]};}
}
