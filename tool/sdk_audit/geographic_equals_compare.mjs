// Bounded comparison only. The recorded input is not an authenticated runtime
// capture and this module never promotes a contract or verification dimension.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';

const sdkSha='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const values=[0,-0,1,-1,0.125,Number.MAX_VALUE,Number.MIN_VALUE,NaN,Infinity,-Infinity];
const encode=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
const normalize=v=>Number.isFinite(v)?parseFloat(v):0;
const encodeState=state=>state.map(encode);
const sourceState=(type,i)=>[values[i],values[(i+3)%10],...(type==='LatLngBounds'?[values[(i+5)%10],values[(i+7)%10]]:[])];

// The SDK LatLng constructor normalizes each numeric coordinate. The bounds
// constructor clones both corners and then sorts latitude and longitude.
function constructed(type,mode,input){
 const result=[...input];
 if(mode==='sdk-constructor'){
  for(let i=0;i<result.length;i++)result[i]=normalize(result[i]);
  if(type==='LatLngBounds'){
   if(result[1]>result[3])[result[1],result[3]]=[result[3],result[1]];
   if(result[0]>result[2])[result[0],result[2]]=[result[2],result[0]];
  }
 }
 return result;
}
function fixture(type,mode,suffix,input,otherInput,sameReceiver){
 const first=constructed(type,mode,input),other=sameReceiver?first:constructed(type,mode,otherInput);
 // Bounds.equals compares the receiver's raw stored corners to clones of the
 // other corners. The clone constructor normalizes only the other operand.
 const result=first.every((value,i)=>value===(type==='LatLngBounds'?normalize(other[i]):other[i]));
 const before=encodeState(first),otherBefore=encodeState(other);
 return {id:`geographic-equals:${type}:${mode}:${suffix}`,contract:`Tmapv3.base.${type}#equals`,mode,
  setupInput:[encodeState(input),encodeState(otherInput)],sameReceiver,before,otherBefore,expected:result,
  after:before,otherAfter:otherBefore,status:'observed',result,repeat:result,returnType:'boolean',
  repeatAfter:before,otherRepeatAfter:otherBefore};
}
export function geographicEqualsExpectedCases(){
 const fixtures=[];
 for(const type of ['LatLng','LatLngBounds'])for(const mode of ['raw','sdk-constructor'])for(let a=0;a<10;a++){
  for(let b=0;b<10;b++)fixtures.push(fixture(type,mode,`distinct:${a}:${b}`,sourceState(type,a),sourceState(type,b),false));
  fixtures.push(fixture(type,mode,`identity:${a}`,sourceState(type,a),sourceState(type,a),true));
 }
 fixtures.push(fixture('LatLng','raw','signed-zero',[0,-0],[-0,0],false));
 const normal=[0,0,0,2],nonfinite=[NaN,-0,Infinity,2];
 fixtures.push(fixture('LatLngBounds','raw','asymmetry-forward',normal,nonfinite,false));
 fixtures.push(fixture('LatLngBounds','raw','asymmetry-reverse',nonfinite,normal,false));
 return fixtures;
}
const fixtures=geographicEqualsExpectedCases(),byExpectedId=new Map(fixtures.map(row=>[row.id,row]));
const fields=['id','contract','mode','setupInput','sameReceiver','before','otherBefore','expected','after','otherAfter','status','result','repeat','returnType','repeatAfter','otherRepeatAfter'];

export function compareGeographicEquals(native,actual){
 const issues=[];
 const index=(rows,label)=>{
  const result=new Map();
  if(!Array.isArray(rows)){issues.push(`${label}: not an array`);return result;}
  if(rows.length!==fixtures.length)issues.push(`${label}: incorrect case count ${rows.length}`);
  for(const row of rows){
   if(!row||typeof row!=='object'||!byExpectedId.has(row.id)){issues.push(`${label}: unexpected ID ${row?.id}`);continue;}
   if(result.has(row.id))issues.push(`${label}: duplicate ID ${row.id}`);else result.set(row.id,row);
  }
  for(const {id} of fixtures)if(!result.has(id))issues.push(`${label}: missing ID ${id}`);
  return result;
 };
 const original=index(native,'native'),dart=index(actual,'dart');let compared=0;
 for(const expected of fixtures){
  const n=original.get(expected.id),d=dart.get(expected.id);if(!n||!d)continue;
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
export function compareGeographicEqualsLogs(nativeEvidence,logs){
 const platforms={};
 for(const platform of ['web','android','ios']){
  const {file,body}=logs[platform]||{};if(typeof file!=='string'||typeof body!=='string')throw Error(`missing ${platform} log`);
  const complete=platform==='web'?body.includes('LIVE RESULT: PASS')&&!body.includes('LIVE RESULT: FAIL'):body.includes('All tests passed!')&&!body.includes('Some tests failed.');
  const rows=[],parseIssues=[];
  for(const line of body.split('\n'))if(line.includes('GEOGRAPHIC EQUALS RESULT:')){
   try{rows.push(JSON.parse(line.split('GEOGRAPHIC EQUALS RESULT:')[1].trim()));}
   catch{parseIssues.push('malformed geographic equals observation');}
  }
  const comparison=compareGeographicEquals(nativeEvidence?.observations,rows);
  if(nativeEvidence?.sdkSha256!==sdkSha||nativeEvidence?.status!=='OPEN')comparison.issues.push('native evidence metadata mismatch');
  if(!complete)comparison.issues.push('platform success marker missing or failure marker present');
  comparison.issues.push(...parseIssues);if(comparison.issues.length)comparison.status='mismatch';
  platforms[platform]={file,sha256:sha(body),...comparison};
 }
 return {status:'OPEN',scope:'Comparison of 443 recorded typed numeric cases per platform against pinned-SDK native observations. This does not authenticate capture provenance or verify the full JS contract, including nonnumeric inputs.',nativeObservationCount:nativeEvidence?.observations?.length,platforms};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [nativeFile,web,android,ios,out]=process.argv.slice(2);if(!out)throw Error('Usage: node geographic_equals_compare.mjs native.json web.log android.log ios.log output.json');
 const bytes=fs.readFileSync(nativeFile),native=JSON.parse(bytes),files={web,android,ios},logs=Object.fromEntries(Object.entries(files).map(([platform,file])=>[platform,{file,body:fs.readFileSync(file,'utf8')}]));
 const result=compareGeographicEqualsLogs(native,logs);result.nativeEvidence={file:nativeFile,sha256:sha(bytes),sdkSha256:native.sdkSha256,probe:native.probe,inputs:native.inputs,browserVersion:native.browserVersion};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,platforms:Object.fromEntries(Object.entries(result.platforms).map(([k,v])=>[k,{status:v.status,comparedCases:v.comparedCases,issues:v.issues.length}]))}));
 if(Object.values(result.platforms).some(r=>r.status!=='bounded-match'))process.exitCode=1;
}
