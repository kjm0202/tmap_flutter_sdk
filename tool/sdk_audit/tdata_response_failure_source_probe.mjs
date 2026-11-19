import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {parseExpressionAt} from 'acorn';import {ROOT,sha} from './common.mjs';
// Executes the pinned SDK JSON callback with fake XHR, without HTTP or keys.
export function observeTDataResponseFailure(root=ROOT){
 const digest='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',bytes=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',digest));if(sha(bytes)!==digest)throw Error('SDK digest mismatch');
 const source=bytes.toString('utf8'),p=source.indexOf('cbFuncJson:function'),start=source.indexOf('function',p);if(p<0)throw Error('missing callback');const parsed=parseExpressionAt(source,start,{ecmaVersion:'latest'}),end=parsed.type==='SequenceExpression'?parsed.expressions[0].end:parsed.end,code=source.slice(start,end);const context={$:{parseJSON:JSON.parse}};vm.createContext(context);const callback=vm.runInContext('('+code+')',context);
 const cases=[['object200',200,{error:{code:'fixture'},response:{suggestions:['result']}}],['object400',400,{error:{code:'fixture'}}],['string200',200,{error:'error'}],['plain400',400,{response:{suggestions:['result']}}]];
 const observations={};for(const [id,status,value] of cases){const calls=[],owner={};for(const event of ['Complete','Error','Progress'])owner['on'+event]=function(arg){calls.push({event:event.toLowerCase(),receiver:this===owner,argument:arg===owner});};callback.call(owner,{readyState:4,status,responseText:JSON.stringify(value)});observations[id]={calls,stored:JSON.stringify(owner._responseData)===JSON.stringify(value)};}
 return {sdkSha256:digest,span:{start,end,sha256:sha(code)},observations};
}
