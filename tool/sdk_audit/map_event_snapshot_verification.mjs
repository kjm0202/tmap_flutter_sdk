import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
import {ROOT, sha} from './common.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';

const NAMES=['Click','ContextMenu','DragStart','DragEnd','ZoomStart','Zoom','ZoomEnd','TouchStart','TouchEnd'];
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASELINE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const FIXTURE='example/integration_test/map_event_snapshot_contracts.dart';
const NATIVE='docs/sdk-audit/reviews/event-snapshot-native-evidence.json';
const PROBE='docs/sdk-audit/reviews/event-snapshot-native-probe.mjs';
const BRIDGE='lib/src/js/js_map_event_snapshots.dart';
const METHODS={
 wrapperOn:[1261195,1261703,'c2e06fa64ec3dc4d91d83a8eb36d9987705bf54ce63c3c373d8335a2a1b4741e'],
 wrapperOff:[1261704,1261994,'7036d92e65a9e4b304a094959c37b47a5123a2294dbf8d2785898e4b940da919'],
 engineMapOnOff:[708798,708912,'32364a0c759a8ca522d880f05d95a55f17f274cbeccf6aec2eac7395a4acd054'],
 eventTarget:[497176,497204,'65aee1906b905979007b8be1274e0fda4aff04aa65dd8dc04d4616102887fa97'],
 mapGetTransform:[710927,710957,'1d376541c4b9ded2a1ef53b49d920c08aeb6f029558d5bd5c15a8195a5d2e66b'],
 transformGetCenter:[611371,611398,'0ace420c31b712acd4cabc5af5d713b00b38c3a36a6dfcf769be0e81d74c0f6e'],
 transformGetZoom:[610544,610569,'dd2f83b76e836ce7ba22a771eff6285e78f2ff211381d6beb4551528e77cf8b3'],
 cameraJumpTo:[502009,502602,'b71c324e9fb270c777ce550ec53c0ecca4066a21c4ff6c95f88ed58414e6f9c2'],
};
// The helper initializes its SDK listener through a non-shadowing local name
// and explicitly reports setup failure before collecting the same two phases.
const BINDING={baselineId:BASELINE,sdkSha256:SDK,fixtureFile:FIXTURE,fixtureSha256:'a21ae19a90c268755295b1685d78b74691c07312dea0acd4ca4742a550f44175',
 nativeFile:NATIVE,nativeSha256:'c3b7cd8c776a5828b1cb254fa6efa6e835a5d1dda80e49837c6a110f63b47767',
 probeFile:PROBE,probeSha256:'8a739dc6c36905d2b320d92ce20a0cdc9aeac750e7841f7ef9a6023de6c67553',bridgeFile:BRIDGE,
 bridgeSha256:'9235e622f9671f5445521862a6569bac53c1756ca5a71fee605f0cbce04b95c9',methods:METHODS};
const fail=message=>{throw new Error(message);};
function contents(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file))fail('invalid evidence path');
 const base=path.resolve(root)+path.sep,realBase=fs.realpathSync(root)+path.sep,target=path.resolve(root,file);
 if(!target.startsWith(base)||!fs.realpathSync(target).startsWith(realBase))fail('evidence path outside root');
 const bytes=fs.readFileSync(target);if(sha(bytes)!==digest)fail('hash mismatch: '+file);return bytes.toString('utf8');
}
function libFiles(root){const result=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(['node_modules','.dart_tool','.cache'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile())result.push(path.relative(root,p));}}walk(path.join(root,'lib'));return result.sort();}
function validateNumber(v){return typeof v==='number'&&Number.isFinite(v)||v&&typeof v==='object'&&Object.keys(v).length===1&&['NaN','Infinity','-Infinity','-0'].includes(v.special);}
function validateField(field,coordinate){
 if(!field||typeof field!=='object'||Array.isArray(field))fail('invalid field');
 const keys=Object.keys(field).sort();
 if(field.status==='present'){
  if(!equal(keys,['status','value']))fail('invalid present field');
  const v=field.value;if(coordinate){if(!v||!equal(Object.keys(v).sort(),['latitude','longitude'])||!validateNumber(v.latitude)||!validateNumber(v.longitude))fail('invalid coordinate');}
  else if(!validateNumber(v))fail('invalid number');
 }else if(['missing','invalid'].includes(field.status)){if(!equal(keys,['status']))fail('invalid absent field');}
 else if(field.status==='error'){if(!equal(keys,['errorMessage','errorType','status'])||typeof field.errorType!=='string'||typeof field.errorMessage!=='string')fail('invalid error field');}
 else fail('invalid field status');
}
function validateEvents(events,names){
 if(!Array.isArray(events)||events.length!==names.length)fail('missing or duplicate events');
 events.forEach((e,i)=>{if(!e||!equal(Object.keys(e).sort(),['center','name','position','zoom'])||e.name!==names[i])fail('event order or name mismatch');validateField(e.position,true);validateField(e.center,true);validateField(e.zoom,false);});
}
function validatePhases(synthetic,jump){
 validateEvents(synthetic,NAMES);validateEvents(jump,['ZoomStart','Zoom','ZoomEnd']);
 for(const e of synthetic){if(!equal(e.position,{status:'present',value:{latitude:0,longitude:-2}})||e.center.status!=='present'||e.zoom.status!=='present')fail('synthetic fixture mismatch');}
 for(const e of jump)if(e.position.status!=='missing'||e.center.status!=='present'||e.zoom.status!=='present'||typeof e.zoom.value!=='number')fail('camera jump fixture mismatch');
 const initial=jump[0].zoom.value,desired=jump[1].zoom.value;
 if(!Number.isFinite(initial)||!Number.isFinite(desired)||Math.abs(desired-initial)!==0.25||jump[2].zoom.value!==desired)fail('fractional camera jump mismatch');
}
function validateNative(x,b){
 if(x.schemaVersion!==1||x.status!=='OBSERVED'||x.sdkSha256!==b.sdkSha256||x.sdkResponse?.sha256!==b.sdkSha256||x.sdkResponse?.pinned!==true||x.sdkResponse?.observed!==true||x.sdkResponse?.status!==200||x.map?.status!=='ready'||x.map?.sdkResponsePinned!==true||x.probe?.file!==b.probeFile||x.probe?.sha256!==b.probeSha256||x.bridge?.file!==b.bridgeFile||x.bridge?.sha256!==b.bridgeSha256)fail('native probe binding mismatch');
 const o=x.observations;if(!o||!equal(o.names,NAMES))fail('native fixture names mismatch');validatePhases(o.synthetic,o.cameraJump);
 if(o.initial!==o.cameraJump[0].zoom.value||o.desired!==o.cameraJump[1].zoom.value||!Number.isInteger(o.countBefore)||o.countDuring!==o.countBefore+1||o.countAfter!==o.countBefore||!Number.isInteger(o.independentBefore)||o.independentAfter!==o.independentBefore+1||o.receivedAfterDisable!==0||o.restored!==true)fail('native listener or camera observation mismatch');
 const sampleNames=['Click','ContextMenu','DragStart','DragEnd','Zoom','TouchStart','TouchEnd'];
 if(!Array.isArray(o.sampleSynthetic)||o.sampleSynthetic.length!==sampleNames.length)fail('sample callback observations missing');
 for(let i=0;i<sampleNames.length;i++){const s=o.sampleSynthetic[i],event=o.synthetic.find(e=>e.name===sampleNames[i]);if(s.name!==sampleNames[i])fail('sample callback name mismatch');
  if(['Click','ContextMenu','TouchStart','TouchEnd'].includes(s.name)){if(!equal(Object.keys(s).sort(),['name','position'])||!equal(s.position,event.position.value))fail('sample position mismatch');}
  else if(['DragStart','DragEnd'].includes(s.name)){if(!equal(Object.keys(s).sort(),['center','name'])||!equal(s.center,event.center.value))fail('sample center mismatch');}
  else if(!equal(Object.keys(s).sort(),['formatted','name','zoom'])||s.zoom!==event.zoom.value||typeof s.zoom!=='number'||s.formatted!==s.zoom.toFixed(0))fail('sample zoom mismatch');
 }
 return {countBefore:o.countBefore,countDuring:o.countDuring,countAfter:o.countAfter,independentBefore:o.independentBefore,independentAfter:o.independentAfter,receivedAfterDisable:o.receivedAfterDisable};
}

/** Return bounded observations, never verified contract dimensions. */
export function collectMapEventSnapshotObservations(args){return collectMapEventSnapshotObservationsForFixture(args,BINDING);}
// The synthetic binding is for hermetic tests; reconciliation uses the fixed wrapper.
export function collectMapEventSnapshotObservationsForFixture({runtime,manifest,libFingerprint,root=ROOT},b){
 try{
  const ev=runtime?.platformEvidence;if(!ev)fail('platform evidence unavailable');
  if(manifest?.id!==b.baselineId||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===b.sdkSha256))fail('baseline or SDK mismatch');
  const sdkFile='tool/sdk_audit/.cache/sources/'+b.sdkSha256,sdk=contents(root,sdkFile,b.sdkSha256),sources={};
  for(const [name,[start,end,digest]] of Object.entries(b.methods)){const body=sdk.slice(start,end);if(sha(body)!==digest)fail('SDK source body mismatch: '+name);sources[name]={file:sdkFile,start,end,sourceTextSha256:digest};}
  if(!libFingerprint?.files||sha(JSON.stringify(libFingerprint.files))!==libFingerprint.sha256||!equal(ev.libFingerprint,libFingerprint))fail('Flutter fingerprint mismatch');
  if(!equal(Object.keys(libFingerprint.files).sort(),libFiles(root)))fail('Flutter file set changed');
  for(const [file,digest] of Object.entries(libFingerprint.files))contents(root,file,digest);
  if(libFingerprint.files[b.bridgeFile]!==b.bridgeSha256)fail('bridge source mismatch');
  if(!Array.isArray(ev.inputs))fail('fixture inputs missing');const inputs=new Map();
  for(const input of ev.inputs){if(inputs.has(input.file))fail('duplicate input');inputs.set(input.file,input);contents(root,input.file,input.sha256);}
  if(inputs.get(b.fixtureFile)?.sha256!==b.fixtureSha256)fail('reviewed fixture mismatch');
  for(const file of ['example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart'])if(!inputs.has(file))fail('platform runner missing');
  contents(root,b.probeFile,b.probeSha256);const native=JSON.parse(contents(root,b.nativeFile,b.nativeSha256)),listener=validateNative(native,b);
  const records=(ev.records||[]).filter(r=>r.kind==='integration');
  if(records.length!==3||new Set(records.map(r=>r.platform)).size!==3||['android','ios','web'].some(p=>!records.some(r=>r.platform===p))||new Set(records.map(r=>r.file)).size!==3)fail('missing or duplicate platform runs');
  const platforms={};
  for(const rec of records){
   if(rec.passed!==true||!rec.file?.startsWith('docs/sdk-audit/platform-logs/'))fail('invalid integration record');
   if(rec.run?.file!==rec.file+'.run.json'||typeof rec.run.sha256!=='string')fail('per-run binding missing');
   const run=JSON.parse(contents(root,rec.run.file,rec.run.sha256));
   if(run.schemaVersion!==1||run.platform!==rec.platform||run.kind!==rec.kind||run.signal!==null||run.exitCode!==0||typeof run.deviceId!=='string'||!run.deviceId||!Number.isFinite(Date.parse(run.startedAt))||!Number.isFinite(Date.parse(run.finishedAt))||Date.parse(run.finishedAt)<Date.parse(run.startedAt)||!/^[a-f0-9]{64}$/.test(run.rawLogSha256)||run.sanitizedLogSha256!==rec.sha256)fail('invalid per-run binding');
   for(const side of [run.inputsBefore,run.inputsAfter])if(!side||!equal(side.libFingerprint,libFingerprint)||!equal(side.inputs,ev.inputs))fail('run input or fingerprint mismatch');
   const log=contents(root,rec.file,rec.sha256),lines=log.split('\n');
   if(!(rec.platform==='web'?parsePlatformTextResults(lines).webPassed:parsePlatformTextResults(lines).mobilePassed))fail('integration did not complete successfully');
   const found=[];for(let i=0;i<lines.length;i++){const row=decodePlatformLogLine(lines[i]);if(row?.kind==='json'&&row.marker==='MAP EVENT SNAPSHOT RESULT:'){let data;try{data=JSON.parse(row.payload);}catch{fail('malformed event observation');}found.push({data,line:i+1});}}
   if(found.length!==2||!Array.isArray(rec.mapEventSnapshotResults)||!equal(found.map(x=>x.data),rec.mapEventSnapshotResults))fail('missing, duplicate or altered recorded phases');
   const phases=['synthetic-emitter','sdk-camera-jump'];
   for(let i=0;i<2;i++){const x=found[i].data,phase=phases[i];
    if(x.id!==`map-event-snapshot:${phase}`||x.mechanism!==phase||x.expectedSdkSha256!==b.sdkSha256||x.sdkDigestMeasurement!=='not measured by this helper'||x.callableMeasurement!=='Function.prototype.toString of invoked methods; SDK bytes not measured'||!Array.isArray(x.limitations)||!equal(x.native,x.dart))fail('phase identity or snapshot mismatch');
    if(!x.callableSources||!equal(Object.keys(x.callableSources).sort(),['cameraJumpTo','mapGetTransform','transformGetCenter','transformGetZoom']))fail('callable sources missing');
    for(const name of Object.keys(x.callableSources)){const [start,end]=b.methods[name];if(x.callableSources[name]!==sdk.slice(start,end))fail('runtime callable source mismatch: '+name);}
   }
   validatePhases(found[0].data.native,found[1].data.native);
   platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,phases:found.map(({data,line})=>({mechanism:data.mechanism,events:data.native,ref:{file:rec.file,sha256:rec.sha256,line,logLineSha256:sha(lines[line-1]),observationSha256:sha(JSON.stringify(data))}})),listenerLifecycle:'not measured by Flutter helper'};
  }
  const common={status:'observed-not-verified',baselineId:b.baselineId,sdkSha256:b.sdkSha256,libFingerprintSha256:libFingerprint.sha256,fixture:{file:b.fixtureFile,sha256:b.fixtureSha256},platforms,nativeBrowser:{file:b.nativeFile,sha256:b.nativeSha256,listenerLifecycle:listener},limitations:['Platform helper compares detached selected fields only; it does not measure platform SDK bytes.','Synthetic emitter events are manufactured; camera.jumpTo is real SDK camera dispatch, not a physical gesture.','Listener ordering, all event payloads, object identity, and complete Map.on, Vsm.Event or target behavior remain unverified.']};
  return {byContract:{'Tmapv3.Map#on':{...common,scope:'Selected sample callback fields, engine subscriptions, and bounded independent listener observation.',sources:{wrapperOn:sources.wrapperOn,wrapperOff:sources.wrapperOff,engineMapOnOff:sources.engineMapOnOff}},'Vsm.Event':{...common,scope:'Selected detached event name, position, center and zoom; target transform getters are read but target identity and API are not transported.',sources:{eventTarget:sources.eventTarget,mapGetTransform:sources.mapGetTransform,transformGetCenter:sources.transformGetCenter,transformGetZoom:sources.transformGetZoom,cameraJumpTo:sources.cameraJumpTo}}},issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'map-event-snapshot-observations-rejected',reason:String(error.message)}]};}
}
