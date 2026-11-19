// Bounded state comparison only. This neither authenticates capture provenance
// nor promotes any SDK method or return contract.
import fs from 'node:fs';import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';import {pathToFileURL} from 'node:url';
const sdkSha='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
// Hash of the 53 source-reviewed native observations after recursive key sort
// and ID ordering. Agreement between two identically changed inputs is rejected.
const nativeCasesSha256='d2bda75e47822765e4d5ec04658df3c660eef872826987193d0c2cf86c9e45f9';
export const unsupportedCases=Object.freeze([]);
export const unverifiedScopes=Object.freeze(['Arbitrary JS values, user getters, prototype modifications and live corner aliases are outside the typed model.','The SDK intersects Boolean return documentation conflicts with observed undefined and corner-only behavior.']);
const allIds=Object.freeze([
 'clone-empty','containment','crossing-no-corner','disjoint','empty-contains-null','empty-contains-point','empty-contains-undefined','empty-equals-empty','empty-get-center','empty-get-northeast','empty-get-northwest','empty-get-southeast','empty-get-southwest','empty-intersects-valid',
 'extend-empty','extend-empty-nonfinite','extend-only-ne','extend-only-sw','extend-valid-contained','extend-valid-ne-expand','extend-valid-sw-expand','isEmpty-null-undefined','isEmpty-null-value','isEmpty-reversed-raw','isEmpty-undefined-null','isEmpty-value-null','null-empty','omitted-empty','only-ne','only-sw','overlap','partial-equals-sw-match','partial-equals-sw-mismatch','partial-other-sw-inside','partial-other-sw-outside','touching-corner',
 'union-empty-valid','union-self','union-valid-empty','union-valid-only-sw','union-valid-valid','valid-contains-boundary','valid-contains-null','valid-contains-outside','valid-contains-point','valid-contains-undefined','valid-equals-empty','valid-get-center','valid-get-northeast','valid-get-northwest','valid-get-southeast','valid-get-southwest','valid-intersects-empty',
]);
const allSet=new Set(allIds),invalidArgumentIds=new Set(['valid-contains-null','valid-contains-undefined']);
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const ordered=rows=>[...rows].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);

export function compareSdkLatLngBoundsState(native,actual){
 const issues=[];
 const index=(rows,label)=>{const map=new Map();if(!Array.isArray(rows)){issues.push(`${label}: not an array`);return map;}if(rows.length!==allIds.length)issues.push(`${label}: incorrect case count ${rows.length}`);
  for(const row of rows){if(!row||typeof row!=='object'||Array.isArray(row)||!allSet.has(row.id)){issues.push(`${label}: unexpected ID ${row?.id}`);continue;}if(map.has(row.id))issues.push(`${label}: duplicate ID ${row.id}`);else map.set(row.id,row);}
  for(const id of allIds)if(!map.has(id))issues.push(`${label}: missing ID ${id}`);return map;};
 const source=index(native,'native'),dart=index(actual,'dart');
 if(source.size===allIds.length&&sha(JSON.stringify(stable(ordered([...source.values()]))))!==nativeCasesSha256)issues.push('native: recorded observations contradict the pinned source-reviewed snapshot');
 let compared=0;
 for(const id of allIds){const n=source.get(id),d=dart.get(id);if(!n||!d)continue;const mapped={...d};
  if(n.returnKind==='undefined'){
   const expected=id.startsWith('extend-')?'void':'null';if(d.returnKind!==expected)issues.push(`${id}: expected Dart ${expected} adaptation`);
   if(d.returnKind===expected)mapped.returnKind='undefined';
  }
  if(n.errorType==='TypeError'){
   const expected=invalidArgumentIds.has(id)?'SdkBoundsInvalidArgumentException':'SdkBoundsMissingCornerException';if(d.errorType!==expected)issues.push(`${id}: expected Dart ${expected} adaptation`);
   if(d.errorType===expected)mapped.errorType='TypeError';
  }
  if(!isDeepStrictEqual(n,mapped))issues.push(`${id}: state, result, error or identity mismatch`);compared++;
 }
 return {status:issues.length?'mismatch':'bounded-match',expectedNativeCases:allIds.length,expectedCases:allIds.length,comparedCases:compared,unsupportedCases,unverifiedScopes,issues};
}
// Reconstruct only the explicitly admitted representation differences, then
// validate against the immutable native snapshot digest above. This lets the
// final ledger reject fabricated or incomplete Dart records independently.
export function validateSdkLatLngBoundsStateDart(actual){
 if(!Array.isArray(actual))return false;
 const native=actual.map(row=>{
  const r={...row};
  if((r.id?.startsWith('extend-')&&r.returnKind==='void')||(!r.id?.startsWith('extend-')&&r.returnKind==='null'))r.returnKind='undefined';
  if((invalidArgumentIds.has(r.id)&&r.errorType==='SdkBoundsInvalidArgumentException')||(!invalidArgumentIds.has(r.id)&&r.errorType==='SdkBoundsMissingCornerException'))r.errorType='TypeError';
  return r;
 });
 return compareSdkLatLngBoundsState(native,actual).status==='bounded-match';
}
export function mergeSdkLatLngBoundsStateNative(primary,extra,branches){
 for(const [label,e] of [['primary',primary],['extra',extra],['branches',branches]])if(e?.sdkSha256!==sdkSha||e?.status!=='OPEN'||!Array.isArray(e.observations))throw Error(`${label} native evidence metadata mismatch`);
 if(primary.observations.length!==32||extra.observations.length!==13||branches.observations.length!==11)throw Error('native evidence case count mismatch');
 const byId=new Map();for(const row of primary.observations){if(!row||byId.has(row.id))throw Error('duplicate primary case');byId.set(row.id,row);}
 let duplicates=0;for(const row of extra.observations){if(!row)throw Error('invalid extra case');if(byId.has(row.id)){duplicates++;if(!isDeepStrictEqual(byId.get(row.id),row))throw Error(`conflicting native case ${row.id}`);}else byId.set(row.id,row);}
 if(duplicates!==3||byId.size!==42)throw Error('unexpected native overlap');
 for(const row of branches.observations){if(!row||byId.has(row.id))throw Error('unexpected branch overlap');byId.set(row.id,row);}
 if(byId.size!==53)throw Error('unexpected native total');return [...byId.values()];
}
export function compareSdkLatLngBoundsStateLogs(nativeEvidence,logs){
 const platforms={};for(const platform of ['web','android','ios']){const {file,body}=logs[platform]||{};if(typeof file!=='string'||typeof body!=='string')throw Error(`missing ${platform} log`);
  const complete=platform==='web'?body.includes('LIVE RESULT: PASS')&&!body.includes('LIVE RESULT: FAIL'):body.includes('All tests passed!')&&!body.includes('Some tests failed.'),rows=[],parseIssues=[];
  for(const line of body.split('\n'))if(line.includes('SDK LATLNGBOUNDS STATE RESULT:')){try{rows.push(JSON.parse(line.split('SDK LATLNGBOUNDS STATE RESULT:')[1].trim()));}catch{parseIssues.push('malformed bounds-state observation');}}
  const comparison=compareSdkLatLngBoundsState(nativeEvidence?.observations,rows);if(nativeEvidence?.sdkSha256!==sdkSha||nativeEvidence?.status!=='OPEN')comparison.issues.push('native evidence metadata mismatch');if(!complete)comparison.issues.push('platform success marker missing or failure marker present');comparison.issues.push(...parseIssues);if(comparison.issues.length)comparison.status='mismatch';platforms[platform]={file,sha256:sha(body),...comparison};
 }
 return {status:'OPEN',scope:'Compare 53 typed numeric-state cases against source-reviewed pinned native observations. Explicitly maps Dart void/null to JS undefined and Dart typed exceptions to JS TypeError; this does not prove capture provenance or the complete JS contract.',nativeObservationCount:nativeEvidence?.observations?.length,unsupportedCases,unverifiedScopes,platforms};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [nativeFile,extraFile,branchFile,web,android,ios,out]=process.argv.slice(2);if(!out)throw Error('Usage: node sdk_latlngbounds_state_compare.mjs native32.json native13.json native11.json web.log android.log ios.log output.json');
 const bytes=fs.readFileSync(nativeFile),extraBytes=fs.readFileSync(extraFile),branchBytes=fs.readFileSync(branchFile),primary=JSON.parse(bytes),extra=JSON.parse(extraBytes),branches=JSON.parse(branchBytes),native={status:'OPEN',sdkSha256:sdkSha,observations:mergeSdkLatLngBoundsStateNative(primary,extra,branches)},files={web,android,ios},logs=Object.fromEntries(Object.entries(files).map(([p,file])=>[p,{file,body:fs.readFileSync(file,'utf8')}]));
 const result=compareSdkLatLngBoundsStateLogs(native,logs);result.nativeEvidence=[{file:nativeFile,sha256:sha(bytes),sdkSha256:primary.sdkSha256},{file:extraFile,sha256:sha(extraBytes),sdkSha256:extra.sdkSha256},{file:branchFile,sha256:sha(branchBytes),sdkSha256:branches.sdkSha256}];fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,platforms:Object.fromEntries(Object.entries(result.platforms).map(([k,v])=>[k,{status:v.status,comparedCases:v.comparedCases,issues:v.issues.length}]))}));if(Object.values(result.platforms).some(r=>r.status!=='bounded-match'))process.exitCode=1;
}
