import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {parseExpressionAt} from 'acorn';
import {ROOT,sha} from './common.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
/** Execute only pinned functions with fake XHR and timers; no network or credential. */
export function observeTDataScalarCompatibility(root=ROOT){
 const bytes=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',SDK));
 if(sha(bytes)!==SDK)throw Error('pinned SDK digest mismatch');
 const source=bytes.toString('utf8'),spans={};
 function extract(prefix){const start=source.indexOf(prefix),at=source.indexOf('function',start);if(start<0)throw Error('missing '+prefix);
  const node=parseExpressionAt(source,at,{ecmaVersion:'latest'}),end=node.type==='SequenceExpression'?node.expressions[0].end:node.end,text=source.slice(at,end);
  spans[prefix]={start:at,end,sha256:sha(text)};return text;}
 const ctx={URL,encodeURIComponent,decodeURIComponent,console:{log(){}},$:{parseJSON:JSON.parse},Tmapv3:{}};
 ctx.window=ctx;ctx.A=function(){};Object.assign(ctx.A,{version:1,protocol:'https:',cache:[]});ctx.b={getCache:()=>null,removeKey(){},setKey(){}};
 ctx.calls=[];ctx.requests=[];ctx.xhrs=[];ctx.timers=new Map();ctx.counter=0;
 ctx.setTimeout=(fn,ms)=>{const id=++ctx.counter;ctx.timers.set(id,{fn,ms});return id;};ctx.clearTimeout=id=>ctx.timers.delete(id);
 ctx.b.getXMLHttpRequest=()=>{const xhr={open(method,url){const u=new URL(url);ctx.requests.push({path:u.pathname,query:Object.fromEntries(u.searchParams)});},send(){}};ctx.xhrs.push(xhr);return xhr;};
 vm.createContext(ctx);
 for(const name of ['setKeyValueFromObjectJson','cbFuncJson'])ctx.b[name]=vm.runInContext('('+extract(name+':function')+')',ctx);
 for(const name of ['getGeoFromAddressJson','getAutoCompleteSearchJson'])ctx.A.prototype[name]=vm.runInContext('('+extract('A.prototype.'+name+'=function')+')',ctx);
 const instance=new ctx.A();instance._requestUrl='fixture.invalid/tmap';instance._appKey='';
 const callback=label=>({onComplete(){ctx.calls.push(label+':complete');},onProgress(){ctx.calls.push(label+':progress');},onError(){ctx.calls.push(label+':error');}});
 const options={city_do:'override',City_do:'separate',gu_gun:'',dong:0,bunji:false,zero:0,empty:'',flag:false,keep:'yes'};
 instance.getGeoFromAddressJson('Seoul','District','Street','1',options,callback('first'));
 const immediate={options:JSON.parse(JSON.stringify(options)),query:ctx.requests.at(-1).query};
 const first=ctx.xhrs.at(-1);instance.getGeoFromAddressJson('Seoul','District','Street','1',{},callback('second'));
 Object.assign(first,{readyState:3});first.onreadystatechange();Object.assign(first,{readyState:4,status:200,responseText:'{}'});first.onreadystatechange();
 const overlap=ctx.calls.splice(0);
 instance.getGeoFromAddressJson('', '', '', '', {}, callback('falsey'));
 const fixedFalseyQuery=ctx.requests.at(-1).query;
 const delayed={timeout:20,searchKeyword:'before',zero:0,keep:'first'};
 instance.getAutoCompleteSearchJson(' keyword ',delayed,callback('auto'));
 const afterCall=JSON.parse(JSON.stringify(delayed));delayed.keep='changed';delayed.searchKeyword='after';
 for(const timer of [...ctx.timers.values()])timer.fn();
 return {sdkSha256:SDK,spans,immediate,overlap,fixedFalseyQuery,delayed:{afterCall,afterTimer:JSON.parse(JSON.stringify(delayed)),query:ctx.requests.at(-1).query}};
}
