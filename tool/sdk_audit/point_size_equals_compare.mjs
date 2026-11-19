// Bounded numeric observation comparison only. This does not promote a
// contract or attest the provenance of observations supplied by a caller.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';

const fields=['contract','before','otherBefore','sameReceiver','status','result','repeat','after','otherAfter'];
const values=[0,-0,1,-1,0.125,Number.MAX_VALUE,Number.MIN_VALUE,NaN,Infinity,-Infinity];
const encode=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
const expectedIds=new Set();
for(const type of ['Point','Size'])for(let a=0;a<10;a++){
  for(let b=0;b<10;b++)for(let c=0;c<10;c++)expectedIds.add(`geometry-equals:${type}:distinct:${a}:${b}:${c}`);
  expectedIds.add(`geometry-equals:${type}:identity:${a}`);
}
export function comparePointSizeEquals(native,actual){
  const issues=[],index=(rows,label)=>{
    const m=new Map();
    if(!Array.isArray(rows)){issues.push(`${label}: not an array`);return m;}
    for(const row of rows){
      if(!row||!expectedIds.has(row.id)){issues.push(`${label}: unexpected ID ${row?.id}`);continue;}
      if(m.has(row.id))issues.push(`${label}: duplicate ID ${row.id}`);else m.set(row.id,row);
    }
    for(const id of expectedIds)if(!m.has(id))issues.push(`${label}: missing ID ${id}`);
    return m;
  };
  const source=index(native,'native'),port=index(actual,'dart');let compared=0;
  for(const id of expectedIds){
    const n=source.get(id),d=port.get(id);if(!n||!d)continue;
    const parts=id.split(':'),a=Number(parts[3]),identity=parts[2]==='identity';
    const before=[values[a],values[(a+3)%10]],other=identity?before:[values[Number(parts[4])],values[Number(parts[5])]];
    const truth=before[0]===other[0]&&before[1]===other[1];
    for(const [label,row] of [['native',n],['dart',d]]){
      for(const key of ['before','after'])if(!isDeepStrictEqual(row[key],before.map(encode)))issues.push(`${id}: ${label} receiver state violates reviewed fixture`);
      for(const key of ['otherBefore','otherAfter'])if(!isDeepStrictEqual(row[key],other.map(encode)))issues.push(`${id}: ${label} argument state violates reviewed fixture`);
      if(row.sameReceiver!==identity||row.result!==truth||row.repeat!==truth)issues.push(`${id}: ${label} result/identity violates numeric source semantics`);
    }
    const expectedContract=`Tmapv3.base.${id.split(':')[1]}#equals`;
    if(n.contract!==expectedContract||n.status!=='observed'||typeof n.result!=='boolean'||typeof n.repeat!=='boolean')issues.push(`${id}: invalid native observation`);
    for(const field of fields)if(!isDeepStrictEqual(n[field],d[field]))issues.push(`${id}: ${field} mismatch`);
    if(d.expected!==n.result)issues.push(`${id}: independent Dart numeric expectation mismatch`);
    compared++;
  }
  return {status:issues.length?'mismatch':'bounded-match',expectedCases:expectedIds.size,comparedCases:compared,issues};
}

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function comparePointSizeEqualsLogs(nativeEvidence,logs){
  const results={};
  for(const platform of ['web','android','ios']){
    const {file,body}=logs[platform]||{};
    if(typeof file!=='string'||typeof body!=='string')throw Error(`missing ${platform} log`);
    const complete=platform==='web'?body.includes('LIVE RESULT: PASS')&&!body.includes('LIVE RESULT: FAIL'):body.includes('All tests passed!')&&!body.includes('Some tests failed.');
    const rows=body.split('\n').filter(line=>line.includes('GEOMETRY EQUALS RESULT:')).map(line=>JSON.parse(line.split('GEOMETRY EQUALS RESULT:')[1].trim()));
    const comparison=comparePointSizeEquals(nativeEvidence.numeric,rows);
    if(!complete)comparison.issues.push('platform success marker missing or failure marker present');
    if(comparison.issues.length)comparison.status='mismatch';
    results[platform]={file,sha256:sha(body),...comparison};
  }
  return {status:'OPEN',scope:'Comparison of 2020 recorded same-type numeric cases per platform against recorded pinned Chrome native cases. Does not verify full JS equality behavior, independently validate capture provenance, or promote a contract.',nativeObservationCount:nativeEvidence.numeric?.length,platforms:results};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [nativeFile,web,android,ios,out]=process.argv.slice(2);
  if(!out)throw Error('Usage: node point_size_equals_compare.mjs native.json web.log android.log ios.log output.json');
  const bytes=fs.readFileSync(nativeFile),native=JSON.parse(bytes),files={web,android,ios};
  const logs=Object.fromEntries(Object.entries(files).map(([p,file])=>[p,{file,body:fs.readFileSync(file,'utf8')}]));
  const result=comparePointSizeEqualsLogs(native,logs);
  result.nativeEvidence={file:nativeFile,sha256:sha(bytes),sdkSha256:native.sdkSha256,probe:native.probe,inputs:native.inputs,browserVersion:native.browserVersion};
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,platforms:Object.fromEntries(Object.entries(result.platforms).map(([k,v])=>[k,{status:v.status,comparedCases:v.comparedCases,issues:v.issues.length}]))}));
  if(Object.values(result.platforms).some(r=>r.status!=='bounded-match'))process.exitCode=1;
}
