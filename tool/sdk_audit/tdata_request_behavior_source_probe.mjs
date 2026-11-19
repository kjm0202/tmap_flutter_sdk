import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {parseExpressionAt} from 'acorn';
import {ROOT, sha} from './common.mjs';
import {observeTDataCallbackRelations} from './tdata_callback_relation_source_probe.mjs';

const SDK = '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const pointA = {_lng: 126.1, _lat: 37.1}, pointB = {_lng: 127.2, _lat: 38.2};
const cases = [
  ['getGeoFromAddress', ['city','district','dong','12'], '/geo/geocoding', 'xml', {city_do:'city',gu_gun:'district',dong:'dong',bunji:'12'}],
  ['getGeoFromAddressJson', ['city','district','dong','12'], '/geo/geocoding', 'json', {city_do:'city',gu_gun:'district',dong:'dong',bunji:'12'}],
  ['getAddressFromGeo', [37.1,126.1], '/geo/reversegeocoding', 'xml', {lat:'37.1',lon:'126.1'}],
  ['getAddressFromGeoJson', [37.1,126.1], '/geo/reversegeocoding', 'json', {lat:'37.1',lon:'126.1'}],
  ['getRoutePlan', [pointA,pointB], '/routes', 'xml', {startX:'126.1',startY:'37.1',endX:'127.2',endY:'38.2'}],
  ['getRoutePlanJson', [pointA,pointB], '/routes', 'json', {startX:'126.1',startY:'37.1',endX:'127.2',endY:'38.2'}],
  ['getRoutePlanForPeople', [pointA,pointB,'start','end'], '/routes/pedestrian', 'xml', {startX:'126.1',startY:'37.1',endX:'127.2',endY:'38.2',startName:'start',endName:'end'}],
  ['getRoutePlanForPeopleJson', [pointA,pointB,'start','end'], '/routes/pedestrian', 'json', {startX:'126.1',startY:'37.1',endX:'127.2',endY:'38.2',startName:'start',endName:'end'}],
  ['getRealTimeTraffic', [37.1,126.1,38.2,127.2,10], '/traffic', 'xml', {minLat:'37.1',minLon:'126.1',maxLat:'38.2',maxLon:'127.2',zoomLevel:'10'}],
  ['getRealTimeTrafficJson', [37.1,126.1,38.2,127.2,10], '/traffic', 'json', {minLat:'37.1',minLon:'126.1',maxLat:'38.2',maxLon:'127.2',zoomLevel:'10'}],
  ['getAutoTraffic', [], '/traffic', 'json', {reqCoordType:'WGS84GEO',resCoordType:'WGS84GEO',trafficType:'AUTO'}],
  ['getPOIDataFromSearch', ['needle'], '/pois', 'xml', {searchKeyword:'needle'}],
  ['getPOIDataFromSearchJson', ['needle'], '/pois', 'json', {searchKeyword:'needle'}],
  ['getPOICategory', [], '/pois/categories', 'xml', {}],
  ['getPOICategoryJson', [], '/pois/categories', 'json', {}],
  ['getPOIDataFromLonLat', [37.1,126.1,'food'], '/pois/search/around', 'xml', {centerLat:'37.1',centerLon:'126.1',categories:'food'}],
  ['getPOIDataFromLonLatJson', [37.1,126.1,'food'], '/pois/search/around', 'json', {centerLat:'37.1',centerLon:'126.1',categories:'food'}],
  ['getPOIDataFromId', ['fixture-id'], '/pois/fixture-id', 'xml', {}],
  ['getPOIDataFromIdJson', ['fixture-id'], '/pois/fixture-id', 'json', {}],
  ['transform', [37.1,126.1,'WGS84GEO','KATECH'], '/geo/coordconvert', 'xml', {lat:'37.1',lon:'126.1',fromCoord:'WGS84GEO',toCoord:'KATECH'}],
  ['transformJson', [37.1,126.1,'WGS84GEO','KATECH'], '/geo/coordconvert', 'json', {lat:'37.1',lon:'126.1',fromCoord:'WGS84GEO',toCoord:'KATECH'}],
  ['getGeofencingFromSearch', ['city','KEYWORD','place',3], '/geofencing/regions', 'xml', {categories:'city',searchType:'KEYWORD',searchKeyword:'place',count:'3'}],
  ['getGeofencingFromSearchJson', ['city','KEYWORD','place',3], '/geofencing/regions', 'json', {categories:'city',searchType:'KEYWORD',searchKeyword:'place',count:'3'}],
  ['getGeofencingFromId', ['fixture-id'], '/geofencing/regions/fixture-id', 'xml', {}],
  ['getGeofencingFromIdJson', ['fixture-id'], '/geofencing/regions/fixture-id', 'json', {}],
  ['getAutoCompleteSearch', ['  needle  '], '/poi/autoComplete', 'xml', {searchKeyword:'needle'}],
  ['getAutoCompleteSearchJson', ['  needle  '], '/poi/autoComplete', 'json', {searchKeyword:'needle'}],
  ['getAutoCompleteSearchV2Json', ['  needle  '], '/poi/V2autoComplete', 'json', {searchKeyword:'needle'}],
];
const requireThat = (ok, why) => { if (!ok) throw Error(why); };
/** Execute the actual pinned TData namespace with no-network fake XHR.
 * This is a bounded source behavior fixture, not an exhaustive domain proof. */
export function probeTDataRequestBehavior(root=ROOT) {
  const file=path.join(root,'tool/sdk_audit/.cache/sources',SDK), bytes=fs.readFileSync(file);
  requireThat(sha(bytes)===SDK,'SDK hash');
  const source=bytes.toString('utf8'), relation=observeTDataCallbackRelations(root);
  const {start,end}=relation.namespace;
  // Inspect the complete pinned bodies, independent of any fixture path. This
  // establishes syntactic relationships, not that all branches were executed.
  const syntax=relation.methods.map((m,i)=>{
    const fnStart=source.indexOf('function',m.start),parsed=parseExpressionAt(source,fnStart,{ecmaVersion:'latest'}),fn=parsed.type==='SequenceExpression'?parsed.expressions[0]:parsed;
    const members=new Set(),calls=[];
    function visit(node){if(!node||typeof node!=='object')return;
      if(node.type==='MemberExpression'&&!node.computed&&node.property?.type==='Identifier')members.add(node.property.name);
      if(node.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&!node.callee.computed)calls.push(node);
      for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
    }visit(fn);
    const fmt=cases[i][3],serializer=fmt==='json'?'setKeyValueFromObjectJson':'setKeyValueFromObject',dispatcher=fmt==='json'?'cbFuncJson':'cbFunc';
    const hasCall=name=>calls.some(c=>c.callee.property?.name===name);
    const openGet=calls.some(c=>c.callee.property?.name==='open'&&c.arguments[0]?.type==='Literal'&&c.arguments[0].value==='GET');
    requireThat(m.name===cases[i][0]&&hasCall('getXMLHttpRequest')&&hasCall(serializer)&&openGet&&hasCall('send')&&members.has('onreadystatechange')&&members.has(dispatcher),`${m.name} source transport relation`);
    return {name:m.name,sha256:m.sha256,serializer,dispatcher,openGet:true,send:true,readyStateHandler:true};
  });
  const pending=[], timers=new Map(); let nextTimer=0;
  class FakeXHR {
    open(method, url) { const u=new URL(url); this.path=u.pathname;this.query=Object.fromEntries(u.searchParams);this.method=method; }
    send(body) { this.body=body; pending.push(this); }
  }
  const ctx={location:{protocol:'https:'},document:{getElementsByTagName:()=>[]},XMLHttpRequest:FakeXHR,
    DOMParser:class {parseFromString(text){return {firstChild:{nodeName:text.startsWith('<error')?'error':'result'},sourceText:text};}},
    $:{parseJSON:JSON.parse},encodeURIComponent,decodeURIComponent,URL,
    setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}};
  ctx.window=ctx;ctx.Tmapv3={base:{Object:function(){}},inherit(C,P){C.prototype=Object.create(P.prototype);C.prototype.constructor=C;},createNamespace(_name,value){ctx.Constructor=value;}};
  vm.createContext(ctx); vm.runInContext(source.slice(start,end),ctx,{timeout:1000});
  const C=ctx.Constructor;requireThat(typeof C==='function','constructor');
  const records=[];
  for (const [name,args,expectedPath,format,expectedFields] of cases) {
    const instance=new C(); instance._appKey='';instance._requestUrl='fixture.invalid/tmap';
    const calls=[];
    const callbacks=Object.fromEntries(['onProgress','onComplete','onError'].map(k=>[k,function(...a){calls.push({phase:k,receiver:this===instance,argCount:a.length,argIsInstance:a[0]===instance});}]));
    const options={format:'replace',version:0,fixtureOption:'yes',falseFlag:false};
    const ret=instance[name](...args,options,callbacks);
    requireThat(ret===undefined && pending.length===1,`${name} return/request`);
    const xhr=pending.pop();
    requireThat(xhr.method==='GET' && xhr.path===`/tmap${expectedPath}` && xhr.query.format===format && xhr.query.version==='1',`${name} request`);
    requireThat(!('appKey' in xhr.query) && xhr.query.fixtureOption==='yes' && !('falseFlag' in xhr.query),`${name} option query`);
    for(const [k,v] of Object.entries(expectedFields))requireThat(xhr.query[k]===v,`${name} field ${k}`);
    requireThat(!Object.hasOwn(options,'format') && options.version===0 && options.fixtureOption==='yes' && options.falseFlag===false,`${name} mutation`);
    xhr.readyState=2;xhr.onreadystatechange();
    xhr.readyState=4;xhr.status=200;xhr.responseText=format==='json'?'{}':'<result/>';xhr.responseXML=null;xhr.onreadystatechange();
    requireThat(calls.length===2 && calls[0].phase==='onProgress' && calls[1].phase==='onComplete' && calls.every(x=>x.receiver&&x.argCount===1&&x.argIsInstance),`${name} callbacks`);
    records.push({name,path:expectedPath,format,fields:Object.keys(expectedFields).sort(),fixedCollisionDeleted:true,falseyCollisionRetained:true,returnUndefined:true,progressCompleteReceiverAndArgument:true});
  }
  requireThat(records.length===28 && records.every((x,i)=>x.name===relation.methods[i].name),'method coverage');
  // Each scenario uses actual SDK methods and a fresh instance; all XHRs are
  // inert objects. Callback calls remain synchronous JavaScript calls here.
  const fresh=()=>{const x=new C();x._appKey='';x._requestUrl='fixture.invalid/tmap';return x;};
  const phases=[];
  const observe=instance=>Object.fromEntries(['onComplete','onProgress','onError'].map(phase=>[phase,function(...a){phases.push({phase,receiver:this===instance,args:a.length===1&&a[0]===instance,data:this._responseData});}]));
  function takeRequest(){requireThat(pending.length===1,'one request');return pending.pop();}
  for(const name of ['getGeofencingFromSearch','getGeofencingFromSearchJson']){
    const x=fresh(),options={},callbacks=observe(x);x[name]('city','COORDINATES',{lon:126.1,lat:37.1},3,options,callbacks);
    const req=takeRequest();requireThat(req.query.reqLon==='126.1'&&req.query.reqLat==='37.1'&&!('searchKeyword' in req.query),`${name} coordinates`);
  }
  const j=fresh();j.getPOICategoryJson({},observe(j));const jq=takeRequest();
  jq.readyState=0;jq.onreadystatechange();requireThat(phases.length===0,'zero state ignored');
  jq.readyState=3;jq.onreadystatechange();
  jq.readyState=4;jq.status=400;jq.responseText='{"error":{"code":"fixture"}}';jq.onreadystatechange();
  jq.responseText='{"error":"error"}';jq.onreadystatechange();
  jq.responseText='';jq.onreadystatechange();
  requireThat(phases.map(x=>x.phase).join(',')==='onProgress,onComplete,onError,onError'&&phases.every(x=>x.receiver&&x.args),'JSON response classification');
  phases.length=0;
  const thrown=new Error('callback-sentinel'), k=fresh(),handlers=observe(k);handlers.onProgress=function(){throw thrown;};
  k.getPOICategoryJson({},handlers);const kq=takeRequest();kq.readyState=2;let caught;try{kq.onreadystatechange();}catch(e){caught=e;}
  requireThat(caught===thrown,'synchronous callback throw identity');
  const replacement=fresh(),old=observe(replacement),newCalls=[];
  replacement.getPOICategoryJson({},old);const oldReq=takeRequest();
  replacement.getPOICategoryJson({},{onComplete:function(v){newCalls.push(this===replacement&&v===replacement);},onProgress(){},onError(){}});takeRequest();
  oldReq.readyState=4;oldReq.responseText='{}';oldReq.onreadystatechange();
  requireThat(newCalls.length===1&&newCalls[0],'latest callback on old XHR');
  const reentrant=fresh(),nested=[];
  reentrant.getPOICategoryJson({},{onProgress:function(){this.getPOICategoryJson({},{onComplete:function(v){nested.push(this===reentrant&&v===reentrant);},onProgress(){},onError(){}});},onComplete(){throw Error('stale complete');},onError(){}});
  const first=takeRequest();first.readyState=2;first.onreadystatechange();takeRequest();
  first.readyState=4;first.responseText='{}';first.onreadystatechange();requireThat(nested.length===1&&nested[0],'reentrant request replaces callback');
  const liveGetter=fresh(),getterOptions={};let reads=0;
  Object.defineProperty(getterOptions,'fixtureOption',{enumerable:true,get(){reads++;return 'kept';}});
  liveGetter.getPOICategoryJson(getterOptions,observe(liveGetter));const getterRequest=takeRequest();
  requireThat(reads>1&&getterRequest.query.fixtureOption==='kept','live option getter reads');
  const xml=fresh();xml.getPOICategory({},observe(xml));const xq=takeRequest();
  const nativeErrorDoc={firstChild:{nodeName:'error'}};
  xq.readyState=4;xq.responseXML=nativeErrorDoc;xq.responseText='<error/>';xq.onreadystatechange();
  requireThat(phases.at(-1).phase==='onError'&&phases.at(-1).data===nativeErrorDoc,'XML native error identity');
  const nativeOkDoc={firstChild:{nodeName:'result'}};
  xq.responseXML=nativeOkDoc;xq.responseText='<result/>';xq.onreadystatechange();
  requireThat(phases.at(-1).phase==='onComplete'&&phases.at(-1).data!==nativeOkDoc&&phases.at(-1).data.sourceText==='<result/>','XML success reparsed');
  xq.responseXML=null;xq.responseText='<error/>';xq.onreadystatechange();
  requireThat(phases.at(-1).phase==='onError'&&phases.at(-1).data.sourceText==='<error/>','XML text parsed error');
  const g=fresh(),getterError=new Error('getter-sentinel'),bad={};
  Object.defineProperty(bad,'format',{enumerable:true,get(){throw getterError;}});
  const gc=observe(g);caught=null;try{g.getPOICategoryJson(bad,gc);}catch(e){caught=e;}
  requireThat(caught===getterError && g.onComplete===gc.onComplete && pending.length===0,'getter throw and callback assignment order');
  const a=fresh(),b=fresh(),v=fresh(),oa={timeout:11},ob={timeout:22,fixtureOption:'before'},ov={timeout:33};
  a.getAutoCompleteSearch('first',oa,observe(a));b.getAutoCompleteSearchJson('second',ob,observe(b));v.getAutoCompleteSearchV2Json('third',ov,observe(v));
  requireThat(timers.size===2 && !Object.hasOwn(oa,'timeout')&&!Object.hasOwn(ob,'timeout')&&!Object.hasOwn(ov,'timeout')&&pending.length===0,'debounce scope');
  ob.fixtureOption='after';for(const timer of [...timers.values()])timer.fn();timers.clear();
  requireThat(pending.length===2,'debounce timer dispatch');
  const dispatched=pending.splice(0);requireThat(dispatched.some(x=>x.path.endsWith('/poi/autoComplete')&&x.query.fixtureOption==='after')&&dispatched.some(x=>x.path.endsWith('/poi/V2autoComplete')),'debounce shared and delayed options');
  C.cache.push(['needle',{}]);caught=null;try{fresh().getAutoCompleteSearchJson('needle',{},observe(fresh()));}catch(e){caught=e;}
  requireThat(caught?.name==='TypeError','pinned nonempty-cache failure');C.cache.length=0;
  return {sdkSha256:SDK,namespace:relation.namespace,syntax,methods:records,branches:{geofencingCoordinates:true,jsonProgressErrorStatusAndReceiver:true,synchronousCallbackThrowIdentity:true,overlappingCallbacksUseLatest:true,reentrantCallbackUsesLatest:true,optionGetterReadLive:true,xmlDocumentAndTextIdentity:true,throwingGetterIdentity:true,sharedAndV2DebounceAndDelayedOptions:true,nonemptyCacheThrowsTypeError:true}};
}
