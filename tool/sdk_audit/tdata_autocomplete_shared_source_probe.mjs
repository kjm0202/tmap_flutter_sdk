import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {parseExpressionAt} from 'acorn';
import {ROOT, sha} from './common.mjs';

// Executes the pinned functions with synthetic timers, XHR and empty cache.
// This is an isolated source experiment, not a browser or network observation.
export function observeSharedAutocompleteSource(root=ROOT) {
 const sdk='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
 const bytes=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',sdk));
 if(sha(bytes)!==sdk)throw Error('pinned SDK hash mismatch');
 const source=bytes.toString('utf8'), spans={};
 const ctx={URL,encodeURIComponent,decodeURIComponent,console:{log(){}},$:{parseJSON:JSON.parse},Tmapv3:{},timers:new Map(),requests:[],calls:[],next:0,aborts:0};
 ctx.window=ctx;ctx.A=function(){};ctx.A.version=1;ctx.A.protocol='https:';ctx.A.cache=[];ctx.A.keywordForAutocomplete='';ctx.b={};
 ctx.setTimeout=(fn,ms)=>{const id=++ctx.next;ctx.timers.set(id,{fn,ms});return id;};
 ctx.clearTimeout=id=>ctx.timers.delete(id);
 ctx.b.getXMLHttpRequest=()=>ctx.lastXhr={open(method,url){const u=new URL(url);this.keyword=u.searchParams.get('searchKeyword');ctx.requests.push(this.keyword);},send(){},abort(){ctx.aborts++;}};
 vm.createContext(ctx);
 function install(name,prefix,target){const start=source.indexOf(prefix);if(start<0)throw Error('missing '+prefix);const begin=source.indexOf('function',start),parsed=parseExpressionAt(source,begin,{ecmaVersion:'latest'}),end=parsed.type==='SequenceExpression'?parsed.expressions[0].end:parsed.end,text=source.slice(begin,end);spans[name]={start:begin,end,sha256:sha(text)};target[name]=vm.runInContext(`(${text})`,ctx);}
 for(const name of ['cbFunc','cbFuncJson','setKeyValueFromObject','setKeyValueFromObjectJson','getCache','getKey','setKey','removeKey'])install(name,`${name}:function`,ctx.b);
 for(const name of ['getAutoCompleteSearch','getAutoCompleteSearchJson','getAutoCompleteSearchV2Json'])install(name,`A.prototype.${name}=function`,ctx.A.prototype);
 const make=label=>{const instance=new ctx.A();instance._appKey='';instance._requestUrl='fixture.invalid/tmap';return {instance,callbacks:{onComplete(){ctx.calls.push(label+':complete');},onError(){ctx.calls.push(label+':error');},onProgress(){ctx.calls.push(label+':progress');}}};};
 const first=make('old'),second=make('first'),v2=make('v2'),later=make('later'),immediate=make('immediate');
 const oldOptions={timeout:11}, firstOptions={timeout:22},v2Options={timeout:33};
 first.instance.getAutoCompleteSearch('old',oldOptions,first.callbacks);
 second.instance.getAutoCompleteSearchJson('first',firstOptions,second.callbacks);
 v2.instance.getAutoCompleteSearchV2Json('v2',v2Options,v2.callbacks);
 const pendingAfterSupersede=[...ctx.timers.values()].map(t=>t.ms).sort((a,b)=>a-b);
 function fire(ms){const entry=[...ctx.timers].find(([,t])=>t.ms===ms);if(!entry)throw Error('missing timer '+ms);ctx.timers.delete(entry[0]);entry[1].fn();}
 fire(22);
 // Save the real fake-XHR created by the first dispatched SDK request.
 // Each instance stores its own request in the SDK; intercept the factory below.
 const firstXhr=ctx.lastXhr;
 later.instance.getAutoCompleteSearchJson('later',{timeout:44},later.callbacks);
 immediate.instance.getAutoCompleteSearchJson('immediate',{},immediate.callbacks);
 Object.assign(firstXhr,{readyState:4,status:200,responseText:'{}'});firstXhr.onreadystatechange();
 const pendingAfterCompletion=[...ctx.timers.values()].map(t=>t.ms).sort((a,b)=>a-b);
 fire(44);fire(33);
 return {sdkSha256:sdk,spans,pendingAfterSupersede,pendingAfterCompletion,timeoutRemoved:![oldOptions,firstOptions,v2Options].some(x=>Object.hasOwn(x,'timeout')),requests:ctx.requests,calls:ctx.calls,aborts:ctx.aborts};
}
