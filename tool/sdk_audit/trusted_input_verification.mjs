import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const HELPER=['example/integration_test/map_trusted_input_contracts.dart','05ab315b7b086094dc3583c854be6e84ea73951ab178121b9ee8097ef1fa5ce2'];
const REVIEW=['docs/sdk-audit/reviews/trusted-input-source-review.json',"1a6de69d78752cac41d58df30e1d30028eebbca47aa322be3b6fd383d320ecd4"];
const DRIVERS={'tool/sdk_audit/trusted_gesture_driver.mjs':'386ee14ce6c7d0d93c3c49806616549fae2199ee80b1810f002894ecf92a443f','tool/sdk_audit/native_gesture_driver/TrustedInputTests.swift':'1c18ed0e3ef9a38141f938a5423dd95eb13825a0c8d98620416e255a0e2de8f0'};
const IOS_MANIFEST=['docs/sdk-audit/reviews/trusted-longtap-ios-build-manifest.json','e82d07127dff887b9df90fca88b4a41050e2cd32f5f00814a31b5adf2c96d0c3'];
const PRIOR=[['docs/sdk-audit/reviews/map-drag-progress-source-review.json','5a971d0ce9496346f416d71455069cc19eb4e36e68403783d25e0a742a0ca6d8'],['docs/sdk-audit/reviews/map-control-lifecycle-source-review.json','7dea9467f6775c91a8dc11f515adb286ca5e3853b6db437af88164af80624a43']];
const IDS=['map-pan-before-cancel','map-pan-after-cancel','marker-drag'];
const ALL_IDS=[...IDS,'policy-blocked','policy-after-cancel','policy-once-first','policy-once-second','policy-mismatch','policy-after-dispose','managed-marker-click','map-longtap-hold'];
const SPACE={web:'browser-css',android:'device-pixels',ios:'screen-points'};
const MECH={web:'Chrome DevTools mouse input',android:'adb touchscreen swipe',ios:'XCTest coordinate drag'};
const fail=x=>{throw Error(x);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>keys(p,['x','y'])&&finite(p.x)&&finite(p.y);
const position=p=>Array.isArray(p)&&p.length===2&&p.every(finite);
const near=(a,b,t=1e-8)=>Math.abs(a-b)<=t;
const nearPos=(a,b)=>position(a)&&position(b)&&near(a[0],b[0])&&near(a[1],b[1]);
const pos=e=>[e.latitude,e.longitude];
const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const phases=rows=>Array.isArray(rows)&&rows.length>=3&&rows[0].phase==='start'&&rows.at(-1).phase==='end'&&rows.slice(1,-1).every(x=>x.phase==='move');
function checkedFile(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');
 const full=path.resolve(root,file);if(!fs.realpathSync(full).startsWith(fs.realpathSync(root)+path.sep))fail('path escapes root');
 const b=fs.readFileSync(full);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('digest mismatch: '+file);return b.toString('utf8');
}
function sources(root,current){
 const sdk=checkedFile(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK),review=JSON.parse(checkedFile(root,...REVIEW));checkedFile(root,...HELPER);
 if(!same(review.iosBuildManifest,{file:IOS_MANIFEST[0],sha256:IOS_MANIFEST[1]}))fail('iOS build manifest review mismatch');
 if(review.status!=='SOURCE_REVIEW_ONLY'||review.baselineId!==BASE||review.sdkSha256!==SDK||!same(review.helper,{file:HELPER[0],sha256:HELPER[1]})||!same(review.driverFiles,DRIVERS)||!same(review.priorReviews,PRIOR.map(([file,sha256])=>({file,sha256}))))fail('source review mismatch');
 if(!current.inputs.some(x=>same(x,{file:HELPER[0],sha256:HELPER[1]})))fail('helper is not in platform inputs');
 for(const [file,digest] of Object.entries(DRIVERS))checkedFile(root,file,digest);
 const build=JSON.parse(checkedFile(root,...IOS_MANIFEST)),swift='tool/sdk_audit/native_gesture_driver/TrustedInputTests.swift';
 if(!keys(build,['sourceFile','sourceSha256','buildExit','buildLogSha256'])||build.sourceFile!==swift||build.sourceSha256!==DRIVERS[swift]||build.buildExit!==0||typeof build.buildLogSha256!=='string'||!/^[a-f0-9]{64}$/.test(build.buildLogSha256))fail('invalid iOS build manifest');
 const prior=PRIOR.map(entry=>JSON.parse(checkedFile(root,...entry)));
 for(const name of ['mapOn','getCenter','getZoom','engineEmit','gestureDrag']){
  const span=prior[0].source?.[name];if(!span||sha(sdk.slice(span.start,span.end))!==span.sha256)fail('SDK source span mismatch: '+name);
 }
 return {...build,buildManifestSha256:IOS_MANIFEST[1]};
}
function checkEvents(row,marker){
 const {before,after,cssCoordinates:css}=row;
 if(!keys(before,['center','marker','a','b'])||!keys(after,['center','marker','a','b','trusted','untrusted','nativeTrace'])||
    !position(before.center)||!position(before.marker)||!position(after.center)||!position(after.marker)||
    ![before.a,before.b,after.a,after.b].every(x=>Number.isInteger(x)&&x>=0)||after.untrusted!==0||!Array.isArray(after.trusted)||!Array.isArray(after.nativeTrace)||
    !keys(css,['from','to'])||!point(css.from)||!point(css.to))fail('invalid input or state shape');
 if(!near(css.to.x-css.from.x,marker?60:90,1e-6)||!near(css.to.y-css.from.y,marker?30:35,1e-6))fail('invalid CSS gesture intent');
 if(!after.trusted.every(e=>keys(e,['type','isTrusted','pointerType','x','y','markerTarget'])&&e.isTrusted===true&&typeof e.type==='string'&&(e.pointerType===null||typeof e.pointerType==='string')&&finite(e.x)&&finite(e.y)&&typeof e.markerTarget==='boolean'))fail('untrusted or malformed event');
 const at=(e,p)=>near(e.x,p.x,6)&&near(e.y,p.y,6);
 let matched=false;
 for(const kinds of [['pointerdown','pointermove','pointerup'],['touchstart','touchmove','touchend'],['mousedown','mousemove','mouseup']]){
  const events=after.trusted;for(let i=0;i<events.length;i++){const down=events[i];if(down.type!==kinds[0]||!at(down,css.from)||(marker&&!down.markerTarget))continue;
   for(let j=i+1;j<events.length;j++){const move=events[j];if(move.type!==kinds[1])continue;
    const dx=move.x-css.from.x,dy=move.y-css.from.y,vx=css.to.x-css.from.x,vy=css.to.y-css.from.y,f=(dx*vx+dy*vy)/(vx*vx+vy*vy);
    if(f<=0||f>1.15||Math.hypot(dx-f*vx,dy-f*vy)>6)continue;
    if(events.slice(j+1).some(e=>e.type===kinds[2]&&at(e,css.to)))matched=true;
   }
  }
 }
 if(!matched||row.inputEnded!==true||row.matchedInput!==true||row.positionChanged!==true||nearPos(before[marker?'marker':'center'],after[marker?'marker':'center']))fail('trusted input or position did not match');
 if(!Array.isArray(row.dartMap)||!Array.isArray(row.dartMarker))fail('invalid Dart traces');
 const mapRow=e=>keys(e,['phase','latitude','longitude','zoom'])&&finite(e.latitude)&&finite(e.longitude)&&Number.isInteger(e.zoom);
 if(!row.dartMap.every(mapRow)||!after.nativeTrace.every(mapRow))fail('invalid map trace');
 const markerRow=e=>keys(e,['id','phase','latitude','longitude'])&&typeof e.id==='string'&&e.id.length>0&&finite(e.latitude)&&finite(e.longitude);
 if(!row.dartMarker.every(markerRow))fail('invalid marker trace');
 if(marker){
  const d=row.dartMarker;if(!phases(d)||!d.every(e=>e.id===d[0].id)||!nearPos(pos(d.at(-1)),after.marker)||!d.slice(1,-1).some(e=>!nearPos(pos(e),pos(d[0])))||
   row.independentListenersPreserved!==null||row.mapTraceMatches!==null||row.markerFinalMatches!==true||row.markerMoveChanged!==true)fail('marker callbacks or final position mismatch');
 }else{
  const d=row.dartMap,n=after.nativeTrace;if(!phases(d)||n.length!==d.length||!d.every((e,i)=>e.phase===n[i].phase&&e.zoom===n[i].zoom&&nearPos(pos(e),pos(n[i])))||
    after.b<=before.b||(row.id===IDS[0]?after.a<=before.a:after.a!==before.a)||row.independentListenersPreserved!==true||row.mapTraceMatches!==true||row.markerFinalMatches!==null||row.markerMoveChanged!==null)fail('map trace or independent listeners mismatch');
 }
}
/** Throws on invalid simulated or recorded rows; these rows alone are not runtime evidence. */
export function compareTrustedInputRows({platform,requests,driverResults,results,run,iosBuildManifest}){
 if(!SPACE[platform]||!Array.isArray(requests)||!Array.isArray(driverResults)||!Array.isArray(results)||requests.length!==3||driverResults.length!==4||results.length!==3)fail('missing or duplicate trusted input rows');
 let transform=null,previous=null,previousDispatchEnd=null;
 const compiled=driverResults[0]?.compiledDriver;
 if(platform==='ios'){
  const sourceFile='tool/sdk_audit/native_gesture_driver/TrustedInputTests.swift';
  if(!same(compiled,iosBuildManifest))fail('iOS build manifest/log mismatch');
  if(!keys(compiled,['sourceFile','sourceSha256','buildExit','buildLogSha256','buildManifestSha256'])||compiled.sourceFile!==sourceFile||compiled.sourceSha256!==DRIVERS[sourceFile]||compiled.buildExit!==0||!['buildLogSha256','buildManifestSha256'].every(k=>typeof compiled[k]==='string'&&/^[a-f0-9]{64}$/.test(compiled[k])))fail('invalid iOS compiled driver provenance');
 }else if(compiled!==null)fail('unexpected compiled driver provenance');
 if(!driverResults.every(d=>same(d.compiledDriver,compiled)))fail('inconsistent compiled driver provenance');
 for(let i=0;i<3;i++){
  const q=requests[i],d=driverResults[i],r=results[i],marker=i===2;
  if(!keys(q,['schemaVersion','id','action','coordinateSpace','from','to','durationMs'])||q.schemaVersion!==1||q.id!==IDS[i]||q.action!=='drag'||q.coordinateSpace!==SPACE[platform]||q.durationMs!==700||![q.from,q.to].every(p=>point(p)&&p.x>=0&&p.y>=0&&p.x<=10000&&p.y<=10000))fail('invalid gesture request');
  if(!keys(d,['schemaVersion','platform','compiledDriver','id','status','mechanism','coordinateSpace','from','to','durationMs','startedAt','finishedAt','sourceFiles'])||d.schemaVersion!==1||d.platform!==platform||d.id!==q.id||d.status!=='dispatched'||d.mechanism!==MECH[platform]||d.coordinateSpace!==q.coordinateSpace||!same(d.from,q.from)||!same(d.to,q.to)||d.durationMs!==q.durationMs||!same(d.sourceFiles,DRIVERS)||!iso(d.startedAt)||!iso(d.finishedAt)||Date.parse(d.startedAt)>Date.parse(d.finishedAt)||(run&&(Date.parse(d.startedAt)<Date.parse(run.startedAt)||Date.parse(d.finishedAt)>Date.parse(run.finishedAt))))fail('invalid driver dispatch');
  if(previousDispatchEnd!==null&&Date.parse(d.startedAt)<previousDispatchEnd)fail('driver dispatch order');previousDispatchEnd=Date.parse(d.finishedAt);
  if(!keys(r,['schemaVersion','id','status','mechanism','before','after','cssCoordinates','pixelTolerance','coordinateTolerance','dartMap','dartMarker','inputEnded','matchedInput','positionChanged','independentListenersPreserved','mapTraceMatches','markerFinalMatches','markerMoveChanged','scope'])||r.schemaVersion!==2||r.id!==q.id||r.status!=='observed'||r.mechanism!=='browser-or-os-injected-trusted-input'||r.pixelTolerance!==6||r.coordinateTolerance!==1e-8||r.scope!=='Three automated trusted drags; not all gestures or human physical input.')fail('invalid helper result');
  checkEvents(r,marker);
  const c=r.cssCoordinates,sx=(q.to.x-q.from.x)/(c.to.x-c.from.x),sy=(q.to.y-q.from.y)/(c.to.y-c.from.y),tx=q.from.x-sx*c.from.x,ty=q.from.y-sx*c.from.y;
  if(!finite(sx)||sx<=0||!near(sx,sy,1e-7)||!finite(tx)||!finite(ty))fail('request/CSS transform mismatch');
  const current=[sx,tx,ty];if(transform&&!current.every((x,j)=>near(x,transform[j],1e-6)))fail('inconsistent request/CSS transform');transform=current;
  if(previous&&(r.before.a!==previous.a||r.before.b!==previous.b))fail('listener counts not continuous');previous=r.after;
 }
 const lifecycle=driverResults[3];
 if(!keys(lifecycle,['schemaVersion','platform','compiledDriver','id','status','gestures','requests','error','sourceFiles'])||lifecycle.schemaVersion!==1||lifecycle.platform!==platform||lifecycle.id!=='driver-lifecycle'||lifecycle.status!=='completed'||lifecycle.gestures!==ALL_IDS.length||lifecycle.requests!==ALL_IDS.length||lifecycle.error!==null||!same(lifecycle.sourceFiles,DRIVERS))fail('driver lifecycle incomplete');
 return true;
}
/** Bounded runtime observations only, never a verified status. */
export function collectTrustedInputObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(manifest?.id!==BASE||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('baseline mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform fingerprint mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs mismatch');const iosBuildManifest=sources(root,current);
  const records=Array.isArray(ev.records)?ev.records.filter(r=>r.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(r=>r.platform===p).length!==1))fail('missing or duplicate platform run');
  const common={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},limitations:['Browser/OS automated trusted input, not a human physical gesture.','Flutter custom marker pointer adapter is not SDK-native marker drag parity.','No complete Map.on/off, marker, or input API parity is established.','Successful run implies cleanup did not report failure; cleanup is not separately traced.','The iOS source-build manifest is independently hashed, but build log bytes and binary contents are not independently verified.']};
  const out={'Tmapv3.Map#on':{...common,scope:'Two trusted automated map pans, native and Dart trace, and independent listener removal.',platforms:{}},'Tmapv3.mapobject.Marker!drag':{...common,scope:'One trusted automated marker drag through Flutter custom pointer adapter.',platforms:{}}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=checkedFile(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(checkedFile(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('invalid run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const text=parsePlatformTextResults(lines);if(rec.platform==='web'?!text.webPassed:!text.mobilePassed)fail('missing successful completion');
   const fields=['trustedInputRequests','trustedInputDriverResults','trustedInputResults'],parsed=Object.fromEntries(fields.map(k=>[k,[]]));
   lines.forEach((line,i)=>{const value=decodePlatformLogLine(line);if(value?.kind==='json'&&fields.includes(value.field))parsed[value.field].push({data:JSON.parse(value.payload),line:i+1});});
   for(const field of fields)if(!same(parsed[field].map(x=>x.data),rec[field]))fail('record/log mismatch: '+field);
   const allRequests=parsed.trustedInputRequests,allDrivers=parsed.trustedInputDriverResults;
   if(!same(allRequests.map(x=>x.data.id),ALL_IDS)||!same(allDrivers.map(x=>x.data.id),[...ALL_IDS,'driver-lifecycle']))fail('full input-driver sequence');
   if(!allDrivers.slice(0,-1).every(x=>x.data.status==='dispatched'&&same(x.data.sourceFiles,DRIVERS)&&same(x.data.compiledDriver,allDrivers[0].data.compiledDriver)))fail('other input dispatch incomplete');
   const req=allRequests.filter(x=>IDS.includes(x.data.id)),drv=allDrivers.filter(x=>IDS.includes(x.data.id)||x.data.id==='driver-lifecycle'),res=parsed.trustedInputResults;
   compareTrustedInputRows({platform:rec.platform,requests:req.map(x=>x.data),driverResults:drv.map(x=>x.data),results:rec.trustedInputResults,run,iosBuildManifest});
   for(let i=0;i<3;i++)if(req[i].line>=res[i].line||req[i].line>=drv[i].line||(i<2&&res[i].line>=req[i+1].line))fail('invalid marker order');
   if(drv[3].line<=drv[2].line)fail('driver completion order');
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const [key,indexes] of [['Tmapv3.Map#on',[0,1]],['Tmapv3.mapobject.Marker!drag',[2]]])out[key].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,observations:indexes.map(i=>({request:req[i].data,driver:drv[i].data,result:res[i].data,requestRef:ref(req[i]),driverRef:ref(drv[i]),resultRef:ref(res[i])})),driverLifecycle:{observation:drv[3].data,ref:ref(drv[3])}};
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'trusted-input-observations-rejected',reason:String(error.message)}]};}
}
