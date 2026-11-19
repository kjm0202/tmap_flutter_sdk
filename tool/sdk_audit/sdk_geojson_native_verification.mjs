import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/sdk_geojson_native_contracts.dart',HELPER_SHA='2196935197f195343d60d04887dab94b980fa40271ec78cdfb7abd466958f520';
const REVIEW='docs/sdk-audit/reviews/sdk-geojson-native-source-review.json',REVIEW_SHA='da980692c880e898048c8314d20e4c36959ea5e9908daf2dc7c0fee94e7485fc';
const SDK_FILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const route={features:[{geometry:{type:'Point',coordinates:[127,37]},properties:{pointType:'S'}},{geometry:{type:'LineString',coordinates:[[127,37],[128,38]]},properties:{pointType:'M'}}]};
const rt={features:[{geometry:{type:'LineString',coordinates:[[1,2],[3,4],[5,6]],traffic:[[0,2,4]]},properties:{pointType:'T'}}]};
const ti={features:[{geometry:{type:'LineString',coordinates:[[1,2],[3,4]]},properties:{pointType:'C',congestion:3}}]};
const polygon={features:[{geometry:{type:'Polygon',coordinates:[[[1,2],[3,4],[5,6]]]},properties:{pointType:'P'}}]};
const fixtures=[['route',{method:'read',data:route}],['route-traffic',{method:'rpTrafficRead',data:rt}],['traffic-info',{method:'trafficInfoRead',data:ti}],['polygon',{method:'read',data:polygon}],['empty',{method:'read',data:{features:[]}}],['repeated-read',{method:'read',data:route}],['missing-features',{method:'read',data:{}}],['json-roundtrip',{json:'{"b":[1,2],"a":null}'}],['json-undefined',{value:'undefined'}],['json-cycle',{value:'self-referential-object'}],['special-numbers',{data:{features:[{geometry:{type:'Point',coordinates:[0,0]},properties:{pointType:'Z'}}]},x:{special:'-0'},y:{special:'Infinity'}}]];
export function sdkGeoJsonNativeCases(){return structuredClone(fixtures.map(([id,input])=>({id:`sdk-geojson:${id}`,input})));}
const methods=['read','parseData','rpTrafficRead','rpTrafficParseData','trafficInfoRead','trafficInfoParseData','drawRoute','drawRouteByTraffic','drawTrafficInfo'];
const callable=['Tmapv3.extension.GeoJSON#constructor',...methods.map(n=>'Tmapv3.extension.GeoJSON#'+n)];
function references(root){
 const read=(f,d)=>{const b=fs.readFileSync(path.join(root,f));if(sha(b)!==d)throw Error(`reference digest: ${f}`);return b;};read(HELPER,HELPER_SHA);
 const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDK_FILE,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!Array.isArray(review.sources)||!same(review.sources.map(x=>x.id).sort(),[...callable].sort()))throw Error('source review metadata');
 const files=['lib/src/models/sdk_geojson_native.dart','lib/src/models/sdk_native_json.dart','lib/src/controller/sdk_geojson_commands.dart','test/sdk_geojson_native_test.dart',HELPER,'tool/sdk_audit/geojson_source_probe.mjs','tool/sdk_audit/test/geojson_source_probe.test.mjs','test/geojson_native_bridge_test.mjs'];
 if(!Array.isArray(review.files)||review.files.length!==files.length||files.some(f=>review.files.filter(x=>x.file===f).length!==1)||!review.files.some(x=>x.file===HELPER&&x.sha256===HELPER_SHA))throw Error('review file set');for(const f of review.files)read(f.file,f.sha256);
 const out={};for(const x of review.sources){if(x.file!==SDK_FILE||x.sha256!==SDK||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error(`source span: ${x.id}`);out[x.id]=x.excerpt;}return out;
}
const coord=(x,y,t,array)=>({array,x:JSON.stringify(x),y:JSON.stringify(y),t:t===undefined?'[undefined]':JSON.stringify(t),serialized:array?'[]':JSON.stringify({x,y})});
const feature=(nodeType,pointType,geometry)=>({nodeType,pointType:JSON.stringify(pointType),geometry});
const expectedValues=[
 {same:true,features:[feature('Point','S',[coord(127,37,undefined,false)]),feature('LineString','M',[coord(127,37,undefined,true),coord(128,38,undefined,true)])]},
 {same:true,features:[feature('LineString','T',[coord(1,2,4,true),coord(3,4,4,true),coord(5,6,4,true)])]},
 {same:true,features:[feature('LineString','C',[coord(1,2,3,true),coord(3,4,3,true)])]},
 {same:true,features:[feature('Polygon','P',[coord([1,2],[3,4],undefined,true)])]},
 {same:true,features:[]},null,null,'{"b":[1,2],"a":null}','undefined',null,{xNegative:true,yInfinite:true,inputPreserved:true,serialized:'{"x":0,"y":null}'}];expectedValues[5]={same:true,features:[...expectedValues[0].features,...expectedValues[0].features]};
export function compareSdkGeoJsonNative({source,rows},{root=ROOT}={}){
 let reference;try{reference=references(root);}catch(e){return {status:'MISMATCH',issues:[`reference: ${e.message}`]};}
 const issues=[];if(source?.id!=='sdk-geojson:callable-sources'||source.expectedSdkSha256!==SDK||source.sdkDigestMeasurement!=='not measured by this helper'||!same(source.observation,{status:'observed',builtInJson:true,methods:reference}))issues.push('callable sources');
 const expected=sdkGeoJsonNativeCases();if(!Array.isArray(rows)||rows.length!==expected.length)return {status:'MISMATCH',issues:[...issues,'case count']};
 for(let i=0;i<expected.length;i++){const r=rows[i],e=expected[i];if(r?.id!==e.id||!same(r.input,e.input)){issues.push(`identity/input: ${e.id}`);continue;}
  const v=r.native;if(!v||typeof v!=='object'||!same(v,r.controller)){issues.push(`native/controller: ${e.id}`);continue;}
  if(i===6||i===9){if(v.status!=='threw'||v.name!=='TypeError'||typeof v.message!=='string')issues.push(`expected TypeError: ${e.id}`);}
  else if(v.status!=='observed'||!same(v.value,expectedValues[i]))issues.push(`fixed SDK/JSON value: ${e.id}`);
 }
 return {status:issues.length?'MISMATCH':'BOUNDED_MATCH',count:rows.length,issues,scope:'Eleven fixed formatter and browser JSON cases, no complete contract promotion.'};
}
const bindings={'Tmapv3.extension.GeoJSON#read':['route','polygon','empty','repeated-read','missing-features','special-numbers'],'Tmapv3.extension.GeoJSON#rpTrafficRead':['route-traffic'],'Tmapv3.extension.GeoJSON#trafficInfoRead':['traffic-info']};
export function collectSdkGeoJsonNativeObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline/SDK mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library fingerprint');const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current source inputs');references(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration record set');
  const out=Object.fromEntries(Object.keys(bindings).map(id=>[id,{status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['SDK GeoJSON is a specialized stateful route/traffic reader with no general GeoJSON writer.','JSON.parse/stringify are browser built-ins, not SDK extension contracts.','Named properties of native coordinate arrays do not survive normal JSON stringification.','Fresh Dart collections are copied, while JS handles retain identity.','Draw effects, complete device SDK bytes, closure identity and complete domain parity were not established.'],platforms:{}}]));
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('integration record');
   const load=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('log/run digest');return b.toString('utf8');};
   const log=load(rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const completion=parsePlatformTextResults(lines);if(rec.platform==='web'?!completion.webPassed:!completion.mobilePassed)fail('completion marker');
   const parse=field=>lines.flatMap((line,index)=>{const x=decodePlatformLogLine(line);return x?.kind==='json'&&x.field===field?[{data:JSON.parse(x.payload),line:index+1}]:[];});
   const sources=parse('sdkGeoJsonSources'),rows=parse('sdkGeoJsonResults');if(sources.length!==1||rows.length!==fixtures.length||sources[0].line>=rows[0].line||!same(sources.map(x=>x.data),rec.sdkGeoJsonSources)||!same(rows.map(x=>x.data),rec.sdkGeoJsonResults))fail('log observations');
   const comparison=compareSdkGeoJsonNative({source:sources[0].data,rows:rows.map(x=>x.data)},{root});if(comparison.status!=='BOUNDED_MATCH')fail(`comparison: ${JSON.stringify(comparison)}`);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const [id,names] of Object.entries(bindings)){const selected=rows.filter(x=>names.some(n=>x.data.id===`sdk-geojson:${n}`));out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:sources[0].data,ref:ref(sources[0])},cases:selected.map(x=>({observation:x.data,ref:ref(x)})),builtInJsonCases:rows.filter(x=>x.data.id.startsWith('sdk-geojson:json-')).map(x=>({observation:x.data,ref:ref(x)}))};}
  }return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-geojson-native-observations-rejected',reason:String(error.message)}]};}
}
