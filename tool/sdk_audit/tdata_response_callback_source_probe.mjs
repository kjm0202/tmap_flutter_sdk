import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {parseExpressionAt} from 'acorn';
import {ROOT,sha} from './common.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
/** Pinned callback bodies run against fake XHR and a deliberately fake DOM parser. */
export function observeTDataResponseCallbacks(root=ROOT){
 const bytes=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',SDK));if(sha(bytes)!==SDK)throw Error('SDK digest mismatch');
 const source=bytes.toString('utf8'),spans={};
 const extract=name=>{const p=source.indexOf(name+':function'),start=source.indexOf('function',p);if(p<0)throw Error('callback not found');const n=parseExpressionAt(source,start,{ecmaVersion:'latest'}),end=n.type==='SequenceExpression'?n.expressions[0].end:n.end,text=source.slice(start,end);spans[name]={start,end,sha256:sha(text)};return text;};
 class FakeParser{parseFromString(text){return {firstChild:{nodeName:text.startsWith('<!--')?'#comment':text.startsWith('<error')?'error':'parsererror'}};}}
 const context={DOMParser:FakeParser,$:{parseJSON:JSON.parse}};context.window=context;vm.createContext(context);
 const json=vm.runInContext('('+extract('cbFuncJson')+')',context),xml=vm.runInContext('('+extract('cbFunc')+')',context);
 function run(fn,response){let calls=[],owner={};for(const event of ['Complete','Error','Progress'])owner['on'+event]=function(arg){calls.push({event:event.toLowerCase(),ownerThis:this===owner,ownerArgument:arg===owner});};let exception=null;try{fn.call(owner,response);}catch(error){exception=error.name;}return {calls,exception};}
 const jsonCases={};for(const [id,status,responseText] of [['object400',400,'{"error":{"code":"fixture"}}'],['string200',200,'{"error":"error"}'],['array200',200,'{"error":[["error"]]}'],['empty503',503,''],['invalid200',200,'invalid'],['null200',200,'null']])jsonCases[id]=run(json,{readyState:4,status,responseText});
 const progress=[0,1,2,3].map(readyState=>({readyState,...run(json,{readyState})}));
 const xmlCases={root:run(xml,{readyState:4,responseText:'<error/>',responseXML:{firstChild:{nodeName:'error'}}}),comment:run(xml,{readyState:4,responseText:'<!--x--><error/>',responseXML:{firstChild:{nodeName:'#comment'}}}),fallback:run(xml,{readyState:4,responseText:'<error/>',responseXML:null}),empty:run(xml,{readyState:4,responseText:'',responseXML:null}),missingFirstChild:run(xml,{readyState:4,responseText:'<x/>',responseXML:{firstChild:null}})};
 return {sdkSha256:SDK,spans,jsonCases,progress,xmlCases};
}
