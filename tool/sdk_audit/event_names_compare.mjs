import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, fingerprint, sha, writeJSON } from './common.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const NATIVE='docs/sdk-audit/reviews/event-names-native-evidence.json', NATIVE_SHA='67c35d6184fb5ea623b34a09ad0a48cef5bd12aa11f551bab427c329771a579c';
const PROBE='docs/sdk-audit/reviews/event-names-native-probe.mjs', PROBE_SHA='c767ac1fe9ee344fa5072d2aa6d07117f2d8c94bf2add32a6601feabb5f2a1ce';
const HELPER='example/integration_test/event_names_contracts.dart', HELPER_SHA='6dcda6bb99d0295165a96a7a0a70fd63b496292f6736a68acd81429558586dc5';
const DART='lib/src/constants/event_names.dart', DART_SHA='45285d925ba6ed83e07cdacecde8b72ae5b4edd787a72316e8081081d69755a3';
const MARKER='EVENT NAMES RESULT: ', ID='event-names:namespace-and-43-members';

export function loadEventNamesNative(read=fs.readFileSync){
 const bytes=read(path.join(ROOT,NATIVE));if(sha(bytes)!==NATIVE_SHA)throw Error('native fixture hash drift');
 const native=JSON.parse(bytes.toString());
 if(native.status!=='OPEN'||native.sdkSha256!==SDK||native.probe?.file!==PROBE||native.probe?.sha256!==PROBE_SHA)throw Error('native fixture metadata');
 if(sha(read(path.join(ROOT,PROBE)))!==PROBE_SHA)throw Error('native probe hash drift');
 const sdk=read(path.join(ROOT,'tool/sdk_audit/.cache/sources',SDK),'utf8');if(sha(sdk)!==SDK)throw Error('SDK hash drift');
 for(const id of ['engineEnum','engineMapAssignment','tmapAlias']){const e=native.sourceEvidence?.[id];if(!e||e.sha256!==SDK||e.file!==`tool/sdk_audit/.cache/sources/${SDK}`||sdk.slice(e.start,e.end)!==e.excerpt)throw Error(`source span ${id}`);}
 const n=native.observation;
 if(!n?.aliasSameObject||n.tmap?.keys?.length!==43||!isDeepStrictEqual(n.tmap,n.engine)||new Set(n.tmap.keys).size!==43)throw Error('native alias or members');
 const expected={};for(const key of n.tmap.keys){const d=n.tmap.descriptors[key];if(d?.value!==key||d.writable!==true||d.enumerable!==true||d.configurable!==true)throw Error(`native descriptor ${key}`);expected[key]=key;}
 const dart=read(path.join(ROOT,DART),'utf8');if(sha(dart)!==DART_SHA)throw Error('Dart const source hash drift');
 if(!dart.includes('abstract final class TMapEventNames')||!dart.includes('static const Map<String, String> values = {'))throw Error('Dart const declarations missing');
 for(const key of n.tmap.keys)if(!dart.includes(`static const String ${key} = '${key}';`)||!dart.includes(`'${key}': ${key},`))throw Error(`Dart const declaration ${key}`);
 return{observation:n,expected,source:{sdkSha256:SDK,nativeFixture:{file:NATIVE,sha256:NATIVE_SHA},probe:{file:PROBE,sha256:PROBE_SHA},dartConstSource:{file:DART,sha256:DART_SHA},readonly:'Static const source declaration; no runtime mutation test was performed.'}};
}

export function compareEventNamesObservations(rows,{read=fs.readFileSync}={}){
 const issues=[],missing=[];let native;try{native=loadEventNamesNative(read);}catch(e){issues.push(`native/source: ${e.message}`);}
 if(!Array.isArray(rows)||rows.length===0)return{status:issues.length?'MISMATCH':'INCOMPLETE',count:0,missing:['event observation'],issues};
 if(rows.length!==1)issues.push('exactly one namespace observation required');
 const row=rows[0]||{},check=(ok,field)=>{if(!ok)issues.push(field);};
 check(row.id===ID,'observation ID');
 check(row.expectedSdkSha256===SDK&&row.sdkDigestMeasurement==='not measured by this helper','device SDK measurement metadata');
 if(native){
  check(isDeepStrictEqual(row.native,{status:'observed',...native.observation}),'native alias, namespace descriptors, keys or holder descriptor');
  check(isDeepStrictEqual(row.dart?.values,native.expected),'Dart values');
  check(isDeepStrictEqual(row.dart?.staticMembers,native.expected),'Dart static constants');
  check(row.dart?.staticMatchesValues===true&&row.dart?.dartMatchesNativeValues===true,'Dart/native comparison flags');
 }
 return{status:issues.length?'MISMATCH':missing.length?'INCOMPLETE':'BOUNDED_MATCH',count:rows.length,memberCount:43,issues,missing,source:native?.source,scope:'Read-only native alias and property descriptor snapshot; Dart const source/value adaptation. No native/global mutation, device SDK byte measurement, event delivery or contract promotion.'};
}

export async function compareEventNamesPlatforms(mobile,{read=fs.readFileSync,currentLibFingerprint}={}){
 const issues=[],missing=[],fixtures={},platforms={};
 for(const file of [HELPER,'example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart']){
  const entries=(mobile?.inputs||[]).filter(x=>x.file===file);if(entries.length!==1){missing.push(`fixture record: ${file}`);continue;}
  try{const actual=sha(read(path.join(ROOT,file)));fixtures[file]={recorded:entries[0].sha256,actual};if(actual!==entries[0].sha256||(file===HELPER&&actual!==HELPER_SHA))issues.push(`fixture drift: ${file}`);}catch{missing.push(`fixture file: ${file}`);}
 }
 if(!currentLibFingerprint)currentLibFingerprint=await fingerprint(path.join(ROOT,'lib'));
 if(!mobile?.libFingerprint?.sha256||!mobile?.libFingerprint?.files)missing.push('library fingerprint');else if(!isDeepStrictEqual(mobile.libFingerprint,currentLibFingerprint))issues.push('library fingerprint drift');
 for(const platform of ['web','android','ios']){
  const records=(mobile?.records||[]).filter(x=>x.platform===platform&&x.kind==='integration');if(records.length!==1){missing.push(`${platform}: missing or duplicate record`);continue;}
  const rec=records[0];if(!Array.isArray(rec.eventNamesResults)||!rec.eventNamesResults.length){missing.push(`${platform}: observations`);continue;}
  const result=compareEventNamesObservations(rec.eventNamesResults,{read});if(result.status==='INCOMPLETE')missing.push(`${platform}: observation`);else if(result.status!=='BOUNDED_MATCH')issues.push(`${platform}: observation mismatch`);
  const file=`docs/sdk-audit/platform-logs/${platform==='web'?'web-final.log':platform+'-complete.log'}`;
  if(rec.file!==file||rec.passed!==true)issues.push(`${platform}: run status or log path`);
  try{
   const body=read(path.join(ROOT,file),'utf8'),digest=sha(body);if(digest!==rec.sha256)issues.push(`${platform}: log hash`);
   const parsed=body.split('\n').filter(l=>l.includes(MARKER)).map(l=>JSON.parse(l.split(MARKER)[1].trim()));
   if(!isDeepStrictEqual(parsed,rec.eventNamesResults))issues.push(`${platform}: log/record mismatch`);
   if(platform==='web'?(!body.includes('LIVE RESULT: PASS')||body.includes('LIVE RESULT: FAIL')):(!body.includes('All tests passed!')||body.includes('Some tests failed.')))issues.push(`${platform}: completion marker`);
   platforms[platform]={...result,log:{file,sha256:digest},observationsSha256:sha(JSON.stringify(parsed))};
  }catch(e){missing.push(`${platform}: log unavailable or invalid: ${e.message}`);}
 }
 return{contractStatus:'OPEN',evidenceStatus:missing.length?'INCOMPLETE':issues.length?'MISMATCH':'BOUNDED_MATCH',issues,missing,fixtures,library:currentLibFingerprint,platforms,scope:'Bounded static enumeration values only; no event behavior or ledger promotion. Dart const adaptation is source-bound, not runtime mutation-tested.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=path.resolve(process.argv[2]||path.join(ROOT,'docs/sdk-audit/mobile-validation.json'));
 const output=path.resolve(process.argv[3]||path.join(ROOT,'docs/sdk-audit/reviews/event-names-platform-comparison.json'));
 let mobile;try{mobile=JSON.parse(fs.readFileSync(input,'utf8'));}catch{mobile={};}
 const result=await compareEventNamesPlatforms(mobile);await writeJSON(output,result);
 console.log(JSON.stringify({evidenceStatus:result.evidenceStatus,missing:result.missing,issues:result.issues,output}));if(result.evidenceStatus!=='BOUNDED_MATCH')process.exitCode=1;
}
