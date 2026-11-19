import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {parseExpressionAt} from 'acorn';import {ROOT,sha} from './common.mjs';
// Isolated pinned SDK methods with synthetic throwing XMLHttpRequest constructor.
export function observeTDataXhrFactoryThrow(root=ROOT){
 const digest='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',bytes=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',digest));if(sha(bytes)!==digest)throw Error('SDK hash mismatch');
 const source=bytes.toString('utf8'),spans={},events=[],sentinel={fixture:'constructor'};
 function XMLHttpRequest(){events.push('construct');throw sentinel;}
 const ctx={A:function(){},b:{},window:{XMLHttpRequest},XMLHttpRequest};ctx.A.version=1;ctx.A.protocol='https:';vm.createContext(ctx);
 function install(name,prefix,target){const start=source.indexOf(prefix),begin=source.indexOf('function',start);if(start<0)throw Error('missing method');const node=parseExpressionAt(source,begin,{ecmaVersion:'latest'}),end=node.type==='SequenceExpression'?node.expressions[0].end:node.end,text=source.slice(begin,end);spans[name]={start:begin,end,sha256:sha(text)};target[name]=vm.runInContext('('+text+')',ctx);}
 install('getXMLHttpRequest','getXMLHttpRequest:function',ctx.b);install('getPOICategoryJson','A.prototype.getPOICategoryJson=function',ctx.A.prototype);
 const instance=new ctx.A(),options={format:'collision'},callbacks={onComplete(){events.push('complete')},onProgress(){events.push('progress')},onError(){events.push('error')}};let sameError=false;try{instance.getPOICategoryJson(options,callbacks);}catch(error){sameError=error===sentinel;}
 return {sdkSha256:digest,spans,observation:{sameError,events,callbacksAssigned:instance.onError===callbacks.onError,optionsUnchanged:options.format==='collision',module:ctx.A.httpModule}};
}
