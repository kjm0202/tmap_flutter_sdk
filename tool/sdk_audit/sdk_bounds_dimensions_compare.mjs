import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, fingerprint, sha, writeJSON } from './common.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const NATIVE='docs/sdk-audit/reviews/sdk-bounds-dimensions-native-evidence.json';
const NATIVE_SHA='d8fd37315bf658d4df683f3e4efecb58096d71c19e17d5abbddaf6acc38a648c';
const PROBE='docs/sdk-audit/reviews/sdk-bounds-dimensions-native-probe.mjs';
const PROBE_SHA='a64f5b76ae3cc008853e9f363d08a15eb44db97420c24c012fedf745778d10ed';
const HELPER='example/integration_test/sdk_bounds_dimensions_contracts.dart';
const HELPER_SHA='ffbc7d44e4c290db0e1672860fe9b8949dc07a8e6dd198e3b3d593d3fad10fb8';
const marker='SDK BOUNDS DIMENSIONS RESULT: ';
const methods=['getWidth','getHeight','getWidthDiff','getHeightDiff','toString'];
const presence=['undefined','null','value'];
const raw=['ordinary','reversed','signed-zero','small-format','large-format','subnormal','nan-sw-lat','nan-ne-lng','positive-infinity','negative-infinity','extreme-latitude','antimeridian','rounding'];
const expectedIds=new Set([...presence.flatMap(a=>presence.map(b=>`presence-${a}-${b}`)),...raw.map(x=>`raw-${x}`)].flatMap(s=>methods.map(m=>`bounds-dimensions:${s}:${m}`)));

// Independent pinned browser sample: the SDK and every recorded source span
// are verified. The device does not load SDK bytes through this probe.
export function loadSdkBoundsDimensionsNative(read=fs.readFileSync){
 const bytes=read(path.join(ROOT,NATIVE));
 if(sha(bytes)!==NATIVE_SHA)throw Error('native fixture hash drift');
 const native=JSON.parse(bytes.toString());
 if(native.status!=='OPEN'||native.sdkSha256!==SDK||native.probe?.file!==PROBE||native.probe.sha256!==PROBE_SHA)throw Error('native fixture metadata');
 if(sha(read(path.join(ROOT,PROBE)))!==PROBE_SHA)throw Error('native probe hash drift');
 const sdk=read(path.join(ROOT,'tool/sdk_audit/.cache/sources',SDK),'utf8');
 if(sha(sdk)!==SDK)throw Error('pinned SDK hash drift');
 const astBytes=read(path.join(ROOT,'docs/sdk-audit/latest/ast.json'),'utf8'), ast=JSON.parse(astBytes);
 if(!Array.isArray(native.sourceEvidence)||native.sourceEvidence.length!==13)throw Error('native source evidence missing');
 for(const e of native.sourceEvidence){
  if(e.sha256!==SDK||e.file!==`tool/sdk_audit/.cache/sources/${SDK}`||sdk.slice(e.start,e.end)!==e.excerpt)throw Error(`native source mismatch: ${e.id}`);
  const rows=ast.rows.filter(x=>x.id===e.id&&(x.kind==='method'||x.kind==='constructor'));
  if(rows.length!==1||rows[0].evidence?.[0]?.start!==e.start||rows[0].evidence?.[0]?.end!==e.end||rows[0].evidence?.[0]?.sha256!==SDK||(rows[0].bodySha256??null)!==e.bodySha256)throw Error(`AST binding mismatch: ${e.id}`);
 }
 if(!Array.isArray(native.observations)||native.observations.length!==expectedIds.size)throw Error('native case count');
 const ids=new Set();for(const row of native.observations){if(!expectedIds.has(row.id)||ids.has(row.id))throw Error('native case ID');ids.add(row.id);}
 return {rows:native.observations,source:{sdkSha256:SDK,nativeFixture:{file:NATIVE,sha256:NATIVE_SHA},probe:{file:PROBE,sha256:PROBE_SHA},astSha256:sha(astBytes)}};
}

// Only distance methods use libm trigonometry. This sample-level absolute +
// relative tolerance is in meters (1e-7 m + 1e-12*|reference|), not a claim
// of bitwise portability or whole-domain equivalence. Every other numeric
// value, all special tags, state, strings and repeated results are exact.
function closeDistance(expected,actual){
 if(typeof expected!=='number'||typeof actual!=='number'||!Number.isFinite(expected)||!Number.isFinite(actual))return false;
 return Math.abs(expected-actual)<=1e-7+1e-12*Math.abs(expected);
}
export function compareSdkBoundsDimensions(rows,{read=fs.readFileSync}={}){
 const issues=[],missing=[],differences=[];let native;
 try{native=loadSdkBoundsDimensionsNative(read);}catch(e){issues.push(`native/source: ${e.message}`);}
 if(!Array.isArray(rows))return {status:'INCOMPLETE',count:0,missing:['observation rows'],issues};
 const seen=new Map();
 for(const row of rows){if(!row||typeof row.id!=='string'){issues.push('row has no ID');continue;}if(seen.has(row.id))issues.push(`duplicate ID: ${row.id}`);else seen.set(row.id,row);if(!expectedIds.has(row.id))issues.push(`unexpected ID: ${row.id}`);}
 for(const id of expectedIds)if(!seen.has(id))missing.push(id);
 if(native)for(const n of native.rows){
  const d=seen.get(n.id);if(!d)continue;
  const check=(ok,field)=>{if(!ok)issues.push(`${n.id}: ${field}`);};
  for(const field of ['scenario','mode','method','before','after','status'])check(isDeepStrictEqual(d[field],n[field]),field);
  if(n.status==='threw'){
   check(n.errorType==='TypeError'&&d.errorType==='SdkBoundsMissingCornerException','exception adaptation');
   check(!Object.hasOwn(d,'value')&&!Object.hasOwn(d,'repeat')&&!Object.hasOwn(d,'returnKind'),'unexpected return on exception');
  }else{
   check(n.status==='observed'&&d.returnKind===n.returnKind&&!Object.hasOwn(d,'errorType'),'return kind/error');
   check(isDeepStrictEqual(d.value,d.repeat),'repeat result differs');
   if(!isDeepStrictEqual(n.value,d.value)){
    if((n.method==='getWidth'||n.method==='getHeight')&&closeDistance(n.value,d.value))differences.push({id:n.id,reference:n.value,actual:d.value,absoluteMeters:Math.abs(n.value-d.value)});
    else issues.push(`${n.id}: result`);
   }
  }
 }
 return {status:issues.length?'MISMATCH':missing.length?'INCOMPLETE':'BOUNDED_MATCH',count:rows.length,missing,issues,distanceDifferences:differences,source:native?.source,scope:'Selected pinned browser vs typed Dart samples. Native TypeError maps to SdkBoundsMissingCornerException; raw states are injected. No device SDK-byte measurement or contract promotion.'};
}

export async function compareSdkBoundsDimensionsPlatforms(mobile,{read=fs.readFileSync,currentLibFingerprint}={}){
 const issues=[],missing=[],fixtures={},platforms={};
 const inputs=[HELPER,'example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart'];
 for(const file of inputs){
  const entries=(mobile?.inputs||[]).filter(x=>x.file===file);
  if(entries.length!==1){missing.push(`fixture record: ${file}`);continue;}
  try{const actual=sha(read(path.join(ROOT,file)));fixtures[file]={recorded:entries[0].sha256,actual};if(actual!==entries[0].sha256||(file===HELPER&&actual!==HELPER_SHA))issues.push(`fixture drift: ${file}`);}catch{missing.push(`fixture file: ${file}`);}
 }
 if(!currentLibFingerprint)currentLibFingerprint=await fingerprint(path.join(ROOT,'lib'));
 if(!mobile?.libFingerprint?.sha256||!mobile?.libFingerprint?.files)missing.push('library fingerprint');
 else if(!isDeepStrictEqual(mobile.libFingerprint,currentLibFingerprint))issues.push('library fingerprint drift');
 for(const platform of ['web','android','ios']){
  const records=(mobile?.records||[]).filter(x=>x.platform===platform&&x.kind==='integration');
  if(records.length!==1){missing.push(`${platform}: missing or duplicate record`);continue;}
  const rec=records[0];
  if(!Array.isArray(rec.sdkBoundsDimensionsResults)||!rec.sdkBoundsDimensionsResults.length){missing.push(`${platform}: observations`);continue;}
  const result=compareSdkBoundsDimensions(rec.sdkBoundsDimensionsResults,{read});
  if(result.status==='INCOMPLETE')missing.push(`${platform}: observation cases`);else if(result.status!=='BOUNDED_MATCH')issues.push(`${platform}: observation mismatch`);
  const file=`docs/sdk-audit/platform-logs/${platform==='web'?'web-final.log':platform+'-complete.log'}`;
  if(rec.file!==file||rec.passed!==true)issues.push(`${platform}: run status or log path`);
  try{
   const body=read(path.join(ROOT,file),'utf8'),digest=sha(body);
   if(digest!==rec.sha256)issues.push(`${platform}: log hash`);
   const parsed=body.split('\n').filter(l=>l.includes(marker)).map(l=>JSON.parse(l.split(marker)[1].trim()));
   if(!isDeepStrictEqual(parsed,rec.sdkBoundsDimensionsResults))issues.push(`${platform}: log/record mismatch`);
   if(platform==='web'?(!body.includes('LIVE RESULT: PASS')||body.includes('LIVE RESULT: FAIL')):(!body.includes('All tests passed!')||body.includes('Some tests failed.')))issues.push(`${platform}: completion marker`);
   platforms[platform]={...result,log:{file,sha256:digest},observationsSha256:sha(JSON.stringify(parsed))};
  }catch(e){missing.push(`${platform}: log unavailable or invalid: ${e.message}`);}
 }
 return {contractStatus:'OPEN',evidenceStatus:missing.length?'INCOMPLETE':issues.length?'MISMATCH':'BOUNDED_MATCH',missing,issues,fixtures,library:currentLibFingerprint,platforms,distanceTolerance:'absolute 1e-7 m plus relative 1e-12; only finite getWidth/getHeight; no promotion',scope:'Selected 110 cases per platform against immutable pinned browser observations; no ledger status promotion.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=path.resolve(process.argv[2]||path.join(ROOT,'docs/sdk-audit/mobile-validation.json'));
 const output=path.resolve(process.argv[3]||path.join(ROOT,'docs/sdk-audit/reviews/sdk-bounds-dimensions-platform-comparison.json'));
 let mobile;try{mobile=JSON.parse(fs.readFileSync(input,'utf8'));}catch{mobile={};}
 const result=await compareSdkBoundsDimensionsPlatforms(mobile);await writeJSON(output,result);
 console.log(JSON.stringify({evidenceStatus:result.evidenceStatus,missing:result.missing,issues:result.issues,output}));
 if(result.evidenceStatus!=='BOUNDED_MATCH')process.exitCode=1;
}
