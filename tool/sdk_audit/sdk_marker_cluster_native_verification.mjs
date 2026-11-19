import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT, sha} from './common.mjs';
import {capturePlatformInputs, validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine, parsePlatformTextResults} from './platform_log_markers.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/sdk_marker_cluster_native_contracts.dart';
const HELPER_SHA='ffacc02b84ccb25deafc275cceaa4385e10b1a4eef4b988afabef48abf98cca5';
const REVIEW='docs/sdk-audit/reviews/sdk-marker-cluster-native-source-review.json';
const REVIEW_SHA="90ed43092cb930bc279b87be7c48b934afc3469f96d702aae65c5b606c3ca7f7";
const names=['addMarker','removeMarker','clearMarkers','setOptions','setMap','getMap','setVisible','setOpacity','setZIndex','destroy'];
// Explicit simulation, not evidence of a device run.
export function sdkMarkerClusterNativeSynthetic() {
 return {source:{status:'observed',clusterConstructor:true,markerConstructor:true,callables:Object.fromEntries(names.map(x=>[x,true]))},
  rows:[{id:'two-unattached-clusters',status:'observed',independent:true,originals:true,options:[false,0,0,null],added:[2,1],removed:[1,true],cleared:[true,0,1,1],updated:[0,false],returnsUndefined:Array(8).fill(true),secondSurvives:true}]};
}
function references(root) {
 const load=(f,d)=>{const b=fs.readFileSync(path.join(root,f));if(sha(b)!==d)throw Error(`reference digest: ${f}`);return b;};
 load(HELPER,HELPER_SHA);const review=JSON.parse(load(REVIEW,REVIEW_SHA));
 const sdk=load(`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16')throw Error('review metadata');
 const files=['lib/src/js/js_native_events.dart','lib/src/models/sdk_native_events.dart','lib/src/models/sdk_marker_cluster_native.dart','test/sdk_marker_cluster_native_test.dart','test/sdk_marker_cluster_native_source_test.mjs',HELPER];
 if(!Array.isArray(review.files)||!same(review.files.map(x=>x.file).sort(),files.sort()))throw Error('file set');
 for(const x of review.files)load(x.file,x.sha256);
 const ids=['MarkerCluster','MarkerCluster#setMap','MarkerCluster#destroy','Map#off','MapObject#setMap','Marker'];
 if(!Array.isArray(review.sources)||!same(review.sources.map(x=>x.id).sort(),ids.sort()))throw Error('source set');
 for(const x of review.sources)if(!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sha(sdk.slice(x.start,x.end))!==x.sha256)throw Error(`source span: ${x.id}`);
}
export function compareSdkMarkerClusterNative({source,rows},{root=ROOT}={}) {
 try {references(root); const expected=sdkMarkerClusterNativeSynthetic();
  if(!same(source,expected.source)||!same(rows,expected.rows))throw Error('source or fixed case mismatch');
  return {status:'BOUNDED_MATCH',count:1,issues:[]};
 }catch(e){return {status:'MISMATCH',issues:[String(e.message)]};}
}
export function collectSdkMarkerClusterNativeObservations({runtime,manifest,libFingerprint,root=ROOT}) {
 try {
  const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or sdk');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library fingerprint');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs');references(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(r=>r.platform===p).length!==1))fail('integration records');
  const item={status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,libFingerprintSha256:libFingerprint.sha256,
   fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:[
    'Two unattached clusters and two markers are bounded samples; map attachment, other listeners, rendering and complete lifecycle are not observed.',
    'SDK setMap and destroy use distinct listener paths; setMap can remove other Zoom listeners. The fixture does not call setMap.',
    'The source VM uses synthetic dependencies. Platform callability flags are not source text or device SDK byte measurements; no API status is promoted.'
   ],platforms:{}};
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('integration record');
   const load=(f,d)=>{const b=fs.readFileSync(path.join(root,f));if(!/^[a-f0-9]{64}$/.test(d||'')||sha(b)!==d)fail('log/run digest');return b.toString('utf8');};
   const log=load(rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const completion=parsePlatformTextResults(lines);if(rec.platform==='web'?!completion.webPassed:!completion.mobilePassed)fail('completion marker');
   const found=lines.flatMap((line,index)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&['sdkMarkerClusterNativeSources','sdkMarkerClusterNativeResults'].includes(x.field)?[{field:x.field,data:JSON.parse(x.payload),line:index+1}]:[];});
   const sources=found.filter(x=>x.field==='sdkMarkerClusterNativeSources'),rows=found.filter(x=>x.field==='sdkMarkerClusterNativeResults');
   if(sources.length!==1||found[0]!==sources[0]||!same(sources.map(x=>x.data),rec.sdkMarkerClusterNativeSources)||!same(rows.map(x=>x.data),rec.sdkMarkerClusterNativeResults))fail('log observations/order');
   if(compareSdkMarkerClusterNative({source:sources[0].data,rows:rows.map(x=>x.data)},{root}).status!=='BOUNDED_MATCH')fail('fixed cases');
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   item.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:sources[0].data,ref:ref(sources[0])},cases:rows.map(x=>({observation:x.data,ref:ref(x)}))};
  }
  const ids=['Tmapv3.extension.MarkerCluster',...names.map(x=>`Tmapv3.extension.MarkerCluster#${x}`)];
  return {byContract:Object.fromEntries(ids.map(k=>[k,item])),issues:[]};
 }catch(e){return {byContract:{},issues:[{code:'sdk-marker-cluster-native-observations-rejected',reason:String(e.message)}]};}
}
