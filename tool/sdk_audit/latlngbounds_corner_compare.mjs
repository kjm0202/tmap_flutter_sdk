// Bounded recorded-case comparison only. This does not establish capture
// provenance, verify the entire SDK contract, or promote any audit status.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';

const sdkSha='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const values=[0,-0,1,-1,0.125,Number.MAX_VALUE,Number.MIN_VALUE,NaN,Infinity,-Infinity];
const encode=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
const normalize=v=>Number.isFinite(v)?parseFloat(v):0;

// Constructor clones LatLng values and sorts each axis; each method then
// constructs a new LatLng from the appropriate two stored coordinates.
export function latLngBoundsCornerExpectedCases(){
 const rows=[];
 for(const method of ['getNorthWest','getSouthEast'])for(const mode of ['raw','sdk-constructor'])for(let a=0;a<10;a++)for(let b=0;b<10;b++){
  let swLat=values[a],swLng=values[(a+3)%10],neLat=values[b],neLng=values[(b+7)%10];
  const setupInput=[swLat,swLng,neLat,neLng].map(encode);
  if(mode==='sdk-constructor'){
   [swLat,swLng,neLat,neLng]=[swLat,swLng,neLat,neLng].map(normalize);
   if(swLng>neLng)[swLng,neLng]=[neLng,swLng];
   if(swLat>neLat)[swLat,neLat]=[neLat,swLat];
  }
  const before=[swLat,swLng,neLat,neLng].map(encode);
  const result=(method==='getNorthWest'?[neLat,swLng]:[swLat,neLng]).map(normalize).map(encode);
  rows.push({id:`latlngbounds-corner:${method}:${mode}:${a}:${b}`,contract:`Tmapv3.base.LatLngBounds#${method}`,
   mode,setupInput,before,after:before,repeatAfter:before,status:'observed',result,repeat:result,resultKind:'LatLng',
   returnDistinctFromReceiver:true,repeatResultDistinct:true,resultDistinctFromCorners:true,repeatDistinctFromCorners:true});
 }
 return rows;
}
const fixtures=latLngBoundsCornerExpectedCases(),expectedById=new Map(fixtures.map(row=>[row.id,row]));
const fields=['id','contract','mode','setupInput','before','after','repeatAfter','status','result','repeat','resultKind','returnDistinctFromReceiver','repeatResultDistinct','resultDistinctFromCorners','repeatDistinctFromCorners'];
export function compareLatLngBoundsCorners(native,actual){
 const issues=[];
 const index=(rows,label)=>{
  const map=new Map();if(!Array.isArray(rows)){issues.push(`${label}: not an array`);return map;}
  if(rows.length!==fixtures.length)issues.push(`${label}: incorrect case count ${rows.length}`);
  for(const row of rows){
   if(!row||typeof row!=='object'||!expectedById.has(row.id)){issues.push(`${label}: unexpected ID ${row?.id}`);continue;}
   if(map.has(row.id))issues.push(`${label}: duplicate ID ${row.id}`);else map.set(row.id,row);
  }
  for(const {id} of fixtures)if(!map.has(id))issues.push(`${label}: missing ID ${id}`);
  return map;
 };
 const source=index(native,'native'),dart=index(actual,'dart');let compared=0;
 for(const expected of fixtures){
  const n=source.get(expected.id),d=dart.get(expected.id);if(!n||!d)continue;
  for(const field of fields){
   if(!isDeepStrictEqual(n[field],expected[field]))issues.push(`${expected.id}: native ${field} contradicts source-bound expectation`);
   if(!isDeepStrictEqual(d[field],expected[field]))issues.push(`${expected.id}: dart ${field} contradicts source-bound expectation`);
   if(!isDeepStrictEqual(n[field],d[field]))issues.push(`${expected.id}: ${field} mismatch`);
  }
  for(const [label,row] of [['native',n],['dart',d]])for(const field of ['phase','error','errorType'])
   if(Object.hasOwn(row,field))issues.push(`${expected.id}: ${label} unexpected ${field}`);
  compared++;
 }
 return {status:issues.length?'mismatch':'bounded-match',expectedCases:fixtures.length,comparedCases:compared,issues};
}
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function compareLatLngBoundsCornerLogs(nativeEvidence,logs){
 const platforms={};
 for(const platform of ['web','android','ios']){
  const {file,body}=logs[platform]||{};if(typeof file!=='string'||typeof body!=='string')throw Error(`missing ${platform} log`);
  const complete=platform==='web'?body.includes('LIVE RESULT: PASS')&&!body.includes('LIVE RESULT: FAIL'):body.includes('All tests passed!')&&!body.includes('Some tests failed.');
  const rows=[],parseIssues=[];
  for(const line of body.split('\n'))if(line.includes('LATLNGBOUNDS CORNER RESULT:')){
   try{rows.push(JSON.parse(line.split('LATLNGBOUNDS CORNER RESULT:')[1].trim()));}catch{parseIssues.push('malformed corner observation');}
  }
  const comparison=compareLatLngBoundsCorners(nativeEvidence?.observations,rows);
  if(nativeEvidence?.sdkSha256!==sdkSha||nativeEvidence?.status!=='OPEN')comparison.issues.push('native evidence metadata mismatch');
  if(!complete)comparison.issues.push('platform success marker missing or failure marker present');
  comparison.issues.push(...parseIssues);if(comparison.issues.length)comparison.status='mismatch';
  platforms[platform]={file,sha256:sha(body),...comparison};
 }
 return {status:'OPEN',scope:'Comparison of 400 recorded numeric corner cases per platform against pinned-SDK observations; no capture provenance, full JS contract, or resolution of the getSouthEast documentation conflict is established.',nativeObservationCount:nativeEvidence?.observations?.length,platforms};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [nativeFile,web,android,ios,out]=process.argv.slice(2);if(!out)throw Error('Usage: node latlngbounds_corner_compare.mjs native.json web.log android.log ios.log output.json');
 const bytes=fs.readFileSync(nativeFile),native=JSON.parse(bytes),files={web,android,ios},logs=Object.fromEntries(Object.entries(files).map(([platform,file])=>[platform,{file,body:fs.readFileSync(file,'utf8')}]));
 const result=compareLatLngBoundsCornerLogs(native,logs);result.nativeEvidence={file:nativeFile,sha256:sha(bytes),sdkSha256:native.sdkSha256,probe:native.probe,inputs:native.inputs,browserVersion:native.browserVersion};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,platforms:Object.fromEntries(Object.entries(result.platforms).map(([k,v])=>[k,{status:v.status,comparedCases:v.comparedCases,issues:v.issues.length}]))}));
 if(Object.values(result.platforms).some(r=>r.status!=='bounded-match'))process.exitCode=1;
}
