import fs from 'node:fs';
import vm from 'node:vm';
import {parseExpressionAt} from 'acorn';
import {ROOT,sha} from './common.mjs';
import path from 'node:path';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';

// Execute exact pinned functions in a fake XHR/timer environment. No network,
// credentials, SDK bundle instrumentation, or real browser XML parser is used.
export function observeTDataOriginal(root=ROOT) {
 const bytes=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',SDK));
 if(sha(bytes)!==SDK)throw Error('pinned SDK hash mismatch');
 const source=bytes.toString('utf8');
 function extract(prefix){
  const start=source.indexOf(prefix);if(start<0)throw Error('missing '+prefix);
  const fn=source.indexOf('function',start),parsed=parseExpressionAt(source,fn,{ecmaVersion:'latest'});
  const end=parsed.type==='SequenceExpression'?parsed.expressions[0].end:parsed.end;
  return {start:fn,end,text:source.slice(fn,end)};
 }
 const names=['cbFunc','cbFuncJson','setKeyValueFromObject','setKeyValueFromObjectJson','getCache','getKey','setKey','removeKey'];
 const methods=['getGeoFromAddressJson','getAutoCompleteSearch','getAutoCompleteSearchJson','getAutoCompleteSearchV2Json'];
 const spans={},ctx={URL,encodeURIComponent,decodeURIComponent,console:{log(){}},$:{parseJSON:JSON.parse},Tmapv3:{}};
 ctx.window=ctx;ctx.A=function(){};ctx.A.version=1;ctx.A.protocol='https:';ctx.A.cache=[];
 ctx.A.keywordForAutocomplete='';ctx.b={};ctx.calls=[];ctx.requests=[];ctx.xhrs=[];ctx.timers=new Map();ctx.nextTimer=0;
 ctx.setTimeout=(fn,ms)=>{const id=++ctx.nextTimer;ctx.timers.set(id,{fn,ms});return id;};
 ctx.clearTimeout=id=>ctx.timers.delete(id);
 ctx.b.getXMLHttpRequest=()=>{const xhr={open(method,url){const parsed=new URL(url);ctx.requests.push({method,path:parsed.pathname,keys:[...parsed.searchParams.keys()]});},send(){}};ctx.xhrs.push(xhr);return xhr;};
 vm.createContext(ctx);
 for(const name of names){const item=extract(`${name}:function`);spans[name]={start:item.start,end:item.end,sha256:sha(item.text)};ctx.b[name]=vm.runInContext(`(${item.text})`,ctx);}
 for(const name of methods){const item=extract(`A.prototype.${name}=function`);spans[name]={start:item.start,end:item.end,sha256:sha(item.text)};ctx.A.prototype[name]=vm.runInContext(`(${item.text})`,ctx);}
 const make=label=>{const instance=new ctx.A();instance._appKey='';instance._requestUrl='fixture.invalid/tmap';
  const callbacks={onComplete(){ctx.calls.push(label+':complete');},onError(){ctx.calls.push(label+':error');},onProgress(){ctx.calls.push(label+':progress');}};
  return {instance,callbacks};};
 const x=make('json');Object.assign(x.instance,x.callbacks);
 for(const readyState of [2,3])ctx.b.cbFuncJson.call(x.instance,{readyState});
 ctx.b.cbFuncJson.call(x.instance,{readyState:4,status:400,responseText:'{"error":{"code":"fixture"}}'});
 ctx.b.cbFuncJson.call(x.instance,{readyState:4,status:200,responseText:'{"error":"error"}'});
 const jsonCallbacks=ctx.calls.splice(0);
 const y=make('xml');Object.assign(y.instance,y.callbacks);
 ctx.b.cbFunc.call(y.instance,{readyState:4,status:400,responseXML:{firstChild:{nodeName:'error'}},responseText:'<error/>'});
 const xmlCallbacks=ctx.calls.splice(0);
 const z=make('options'),options={city_do:'override',gu_gun:'',dong:'override',extra:0,flag:false,keep:'x'};
 z.instance.getGeoFromAddressJson('Seoul','District','Street','1',options,z.callbacks);
 const mutation={options:JSON.parse(JSON.stringify(options)),queryKeys:ctx.requests.at(-1).keys};ctx.requests.length=0;
 const shared=make('old'),newCallbacks={onComplete(){ctx.calls.push('new:complete');},onError(){ctx.calls.push('new:error');},onProgress(){ctx.calls.push('new:progress');}};
 shared.instance.getGeoFromAddressJson('Seoul','District','Street','1',{},shared.callbacks);
 const prior=ctx.xhrs.at(-1);
 shared.instance.getGeoFromAddressJson('Seoul','District','Street','1',{},newCallbacks);
 Object.assign(prior,{readyState:4,status:200,responseText:'{}'});prior.onreadystatechange();
 const overlappingCallbacks=ctx.calls.splice(0);ctx.requests.length=0;
 const a=make('first'),b=make('second'),v=make('v2'),first={timeout:20},second={timeout:30},third={timeout:40};
 a.instance.getAutoCompleteSearch(' first ',first,a.callbacks);
 b.instance.getAutoCompleteSearchJson(' second ',second,b.callbacks);
 v.instance.getAutoCompleteSearchV2Json(' third ',third,v.callbacks);
 const debounce={pending:[...ctx.timers.values()].map(x=>x.ms).sort((x,y)=>x-y),
  timeoutRemoved:![first,second,third].some(x=>Object.hasOwn(x,'timeout')),requestsBeforeTimers:ctx.requests.length};
 for(const timer of [...ctx.timers.values()])timer.fn();
 debounce.requestPaths=ctx.requests.map(x=>x.path).sort();
 ctx.A.cache=[['x',{readyState:4,responseText:'{}'}]];
 let cacheLookup;try{ctx.b.getCache('x');cacheLookup='returned';}catch(e){cacheLookup=e.name;}
 ctx.A.cache=[];ctx.b.getCache=()=>({readyState:4,responseText:'{}'});
 let cacheHit;try{b.instance.getAutoCompleteSearchJson('x',{},b.callbacks);cacheHit='returned';}catch(e){cacheHit=e.name;}
 return {sdkSha256:SDK,spans,jsonCallbacks,xmlCallbacks,mutation,overlappingCallbacks,debounce,cache:{lookupWithNonemptyCache:cacheLookup,hitWithMissingScope:cacheHit}};
}
