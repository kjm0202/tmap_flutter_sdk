// Compare bounded recorded numeric cases. This does not authenticate capture
// provenance or promote the LatLngBounds#getNorthEast contract.
import fs from 'node:fs';import crypto from 'node:crypto';import {isDeepStrictEqual} from 'node:util';import {pathToFileURL} from 'node:url';
const fields=['contract','mode','setupInput','before','after','repeatAfter','status','result','repeat','resultKind','returnDistinctFromReceiver','repeatResultDistinct','resultDistinctFromCorners','repeatDistinctFromCorners'];
const ids=new Set();for(const mode of ['raw','sdk-constructor'])for(let a=0;a<10;a++)for(let b=0;b<10;b++)ids.add(`latlngbounds-northeast:${mode}:${a}:${b}`);
// Pinned getter_inputs.json SHA256 a37a06e7c0d7b2a51efc0853f73751f9b9c5aa2b1b128bfe5ce4a3f9603304ba.
// Reconstruct source semantics independently of either captured observation:
// LatLng constructor isFinite/parseFloat normalization, bounds constructor
// clone + independent coordinate sorting, then getNorthEast clones the NE corner through a new
// LatLng normalization. Offsets and source hash are recorded in native evidence.
const values=[0,-0,1,-1,0.125,Number.MAX_VALUE,Number.MIN_VALUE,NaN,Infinity,-Infinity];
const encode=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
const normalize=v=>Number.isFinite(v)?parseFloat(v):0;
function sourceExpected(id){
 const [,mode,ai,bi]=id.split(':'),a=Number(ai),b=Number(bi);
 let swLat=values[a],swLng=values[(a+3)%10],neLat=values[b],neLng=values[(b+7)%10];
 const setupInput=[swLat,swLng,neLat,neLng].map(encode);
 if(mode==='sdk-constructor'){
  [swLat,swLng,neLat,neLng]=[swLat,swLng,neLat,neLng].map(normalize);
  if(swLng>neLng)[swLng,neLng]=[neLng,swLng];if(swLat>neLat)[swLat,neLat]=[neLat,swLat];
 }
 const before=[swLat,swLng,neLat,neLng].map(encode),result=[normalize(neLat),normalize(neLng)].map(encode);
 return {contract:'Tmapv3.base.LatLngBounds#getNorthEast',mode,setupInput,before,after:before,repeatAfter:before,status:'observed',result,repeat:result,resultKind:'LatLng',returnDistinctFromReceiver:true,repeatResultDistinct:true,resultDistinctFromCorners:true,repeatDistinctFromCorners:true};
}
export function compareLatLngBoundsNorthEast(native,actual){
 const issues=[],index=(rows,label)=>{const m=new Map();if(!Array.isArray(rows)){issues.push(`${label}: not an array`);return m;}for(const row of rows){if(!row||!ids.has(row.id)){issues.push(`${label}: unexpected ID ${row?.id}`);continue;}if(m.has(row.id))issues.push(`${label}: duplicate ID ${row.id}`);else m.set(row.id,row);}for(const id of ids)if(!m.has(id))issues.push(`${label}: missing ID ${id}`);return m;};
 const source=index(native,'native'),port=index(actual,'dart');let compared=0;
 for(const id of ids){const n=source.get(id),d=port.get(id);if(!n||!d)continue;
  const expected=sourceExpected(id);
  for(const field of fields){
   if(!isDeepStrictEqual(n[field],expected[field]))issues.push(`${id}: native ${field} contradicts source-bound expectation`);
   if(!isDeepStrictEqual(d[field],expected[field]))issues.push(`${id}: dart ${field} contradicts source-bound expectation`);
   if(!isDeepStrictEqual(n[field],d[field]))issues.push(`${id}: ${field} mismatch`);
  }
  for(const [label,row] of [['native',n],['dart',d]])for(const field of ['phase','error','errorType'])if(Object.hasOwn(row,field))issues.push(`${id}: ${label} unexpected ${field}`);
  compared++;
 }
 return {status:issues.length?'mismatch':'bounded-match',expectedCases:ids.size,comparedCases:compared,issues};
}
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function compareLatLngBoundsNorthEastLogs(nativeEvidence,logs){
 const results={};for(const platform of ['web','android','ios']){const {file,body}=logs[platform]||{};if(typeof file!=='string'||typeof body!=='string')throw Error(`missing ${platform} log`);
  const complete=platform==='web'?body.includes('LIVE RESULT: PASS')&&!body.includes('LIVE RESULT: FAIL'):body.includes('All tests passed!')&&!body.includes('Some tests failed.');
  const rows=body.split('\n').filter(line=>line.includes('LATLNGBOUNDS NORTHEAST RESULT:')).map(line=>JSON.parse(line.split('LATLNGBOUNDS NORTHEAST RESULT:')[1].trim()));
  const comparison=compareLatLngBoundsNorthEast(nativeEvidence.observations,rows);if(!complete)comparison.issues.push('platform success marker missing or failure marker present');if(comparison.issues.length)comparison.status='mismatch';results[platform]={file,sha256:sha(body),...comparison};
 }
 return {status:'OPEN',scope:'Comparison of 200 recorded raw and constructor numeric cases per platform against recorded pinned Chrome native cases; not full contract verification or independent capture provenance validation.',nativeObservationCount:nativeEvidence.observations?.length,platforms:results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [nativeFile,web,android,ios,out]=process.argv.slice(2);if(!out)throw Error('Usage: node latlngbounds_northeast_compare.mjs native.json web.log android.log ios.log output.json');
 const bytes=fs.readFileSync(nativeFile),native=JSON.parse(bytes),files={web,android,ios},logs=Object.fromEntries(Object.entries(files).map(([p,file])=>[p,{file,body:fs.readFileSync(file,'utf8')}]));
 const result=compareLatLngBoundsNorthEastLogs(native,logs);result.nativeEvidence={file:nativeFile,sha256:sha(bytes),sdkSha256:native.sdkSha256,probe:native.probe,inputs:native.inputs,browserVersion:native.browserVersion};fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,platforms:Object.fromEntries(Object.entries(result.platforms).map(([k,v])=>[k,{status:v.status,comparedCases:v.comparedCases,issues:v.issues.length}]))}));if(Object.values(result.platforms).some(r=>r.status!=='bounded-match'))process.exitCode=1;
}
