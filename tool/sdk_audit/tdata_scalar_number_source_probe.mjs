import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {parseExpressionAt} from 'acorn';
import {ROOT,sha} from './common.mjs';

// Pinned SDK serializer functions and scalar values only; no XHR or key.
export function observeTDataScalarNumbers(root=ROOT){
 const digest='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
 const data=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',digest));
 if(sha(data)!==digest)throw Error('SDK digest mismatch');
 const source=data.toString('utf8'),ctx={A:{protocol:'https:'},decodeURIComponent,encodeURIComponent};vm.createContext(ctx);
 const spans={},result={},edgeCases={};
 const options={one:1.0,negative:-3.0,small:1e-7,threshold:1e-6,large:1e20,largeExponent:1e21,safeBoundary:9007199254740991,roundBoundary:9007199254740993,largeRounded:1000000000000000100,inf:Infinity,nan:NaN,negativeZero:-0,positiveZero:0,missing:null};
 for(const name of ['setKeyValueFromObject','setKeyValueFromObjectJson']){
  const start=source.indexOf(name+':function'),begin=source.indexOf('function',start);if(start<0)throw Error('missing serializer');
  const parsed=parseExpressionAt(source,begin,{ecmaVersion:'latest'}),end=parsed.type==='SequenceExpression'?parsed.expressions[0].end:parsed.end,text=source.slice(begin,end);
  spans[name]={start:begin,end,sha256:sha(text)};
  const fn=vm.runInContext('('+text+')',ctx),rows=[];for(const k of Object.keys(options))fn(rows,options,k);
  result[name]=Object.fromEntries(rows.map(row=>{const at=row.indexOf('=');return [row.slice(0,at),row.slice(at+1)];}));
  const bigintRows=[],nullRows=[],asciiRows=[];fn(bigintRows,{v:9007199254740993n},'v');fn(nullRows,{u:undefined,n:null},'u');fn(nullRows,{u:undefined,n:null},'n');fn(asciiRows,{v:'\ud800'},'v');
  let koreanSurrogateError=null;try{fn([],{v:'가\ud800'},'v');}catch(error){koreanSurrogateError=error.name;}
  edgeCases[name]={bigint:bigintRows[0],nullishOmitted:nullRows.length===0,asciiLoneSurrogateRetained:asciiRows[0].charCodeAt(2)===0xd800,koreanSurrogateError};
 }
 return {sdkSha256:digest,spans,result,edgeCases};
}
