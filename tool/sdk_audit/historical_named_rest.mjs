import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {parse} from 'acorn';
import * as walk from 'acorn-walk';
import {load} from 'cheerio';
import {HERE, sha} from './common.mjs';
import {verifiedDocumentSources} from './current_rest_document_sources.mjs';
import {releasedHistoricalNamedProof} from './release_rest_named_adapters.mjs';

// These exact byte witnesses are a historical source mapping, not wire tests.
const coreHash = '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const manifestHash = '49db8bbc0a8bc8c824974a6f38f86473281ad9597fba81de2c616a1ec947e4cd';
const urlBase = 'https://tmapapi.tmapmobility.com/webservice/docs/';
const methods = [
 ['transform',1006612,1007389,'8d454a0b2b1267e9bc58b13b00c8b1ea15f61f9bcc9d2f6d39a92dce69b0e789'],
 ['transformJson',1007390,1008196,'56567af15baece25bf435620758a1d98b6761540328e5cfd9e5ce4cf9f3f4ec6'],
 ['getGeofencingFromSearch',1008197,1009081,'ad6323a76f40c9595622daa014aef11e4eed004d457359144411c2b7882a8cba'],
 ['getGeofencingFromSearchJson',1009082,1009995,'a9792a856e1907b415c5a800daa559ed3b8faba1ef218b4514a665a9824ebb79'],
 ['getGeofencingFromId',1009996,1010751,'8ec1b8c98c8f04fdad861d1a4edbb89611da71338270a6e1a783df3e74ca8133'],
 ['getGeofencingFromIdJson',1010752,1011536,'531b89afe5dee4f76ff724d227733420df2f4007789b6e3a2891b75000841ace']
];
const helpers = [
 ['cbFunc',987289,988116,'6c448903ea2e5798ddeffdacd8a793866b8e8fc4d2f1a6e07e2fe8f0da3b5444'],
 ['cbFuncJson',988117,988441,'bfe98b31b90c2c0d46d04b85dc11b26224fa8cb8f9ddbb6030977e0287ba48ed'],
 ['cbFuncIE',988442,988889,'1545eeefbcf12279811b5e3f81d00eecc11e90bb12f2610b519f8aa6fa0e4c0b'],
 ['cbFuncIEJson',988890,989171,'1956483c3c835280fb0656164d4aede390d8405bbf52de0ea83846faedad0cbb']
];
const configs = {
 'convertCoord.html': {hash:'ed8ea4fec91f2d4e92c14458b476d082efb7405f7e868a4d8551c19aff20db5d',tables:6,fields:10,request:7,response:3,endpoint:'/geo/coordconvert',resources:[0],methodIndexes:[0,1],query:'version={version}&lat={lat}&lon={lon}&fromCoord={fromCoord}&toCoord={toCoord}&callback={callback}&appKey={appKey}'},
 'tmapGeofencingRegionsDoc.html': {hash:'c8f6b3c31fe4c6752e4880bf2ddf3a6f65f83f8688767c107a0e4e83c9341fd8',tables:6,fields:23,request:12,response:11,endpoint:'/geofencing/regions',resources:[0],methodIndexes:[2,3],query:'version={version}&page={page}&count={count}&categories={categories}&searchType={searchType}&searchKeyword={searchKeyword}&resCoordType={resCoordType}&reqCoordType={reqCoordType}&reqLon={reqLon}&reqLat={reqLat}&callback={callback}&appKey={appKey}'},
 'tmapGeofencingRegionsDetailDoc.html': {hash:'617004fe41eb7c3349b086d1e230d3d6782183f6e4561ace2772764e9f6a2689',tables:11,fields:47,request:10,response:37,endpoint:'/geofencing/regions/{regionId}',resources:[0,6],methodIndexes:[4,5],query:'version={version}&resCoordType={resCoordType}&callback={callback}&appKey={appKey}'}
};
const endpoints = Object.values(configs).map(x=>x.endpoint);
const emptyKeys = ['contracts','observations','dartCandidates','bridgeObservations','boundedPlatformObservations'];

export function historicalCoreWitness(bytes) {
 try {
  if (sha(bytes)!==coreHash) return null;
  const text=bytes.toString('utf8'), tree=parse(text,{ecmaVersion:'latest'}), assignments=[], properties=[];
  walk.simple(tree,{AssignmentExpression(n){if(methods.some(m=>m[1]===n.start&&m[2]===n.end)) assignments.push(n);}, Property(n){if(helpers.some(m=>m[1]===n.start&&m[2]===n.end)) properties.push(n);}});
  if(assignments.length!==6 || properties.length!==4) return null;
  for(const [name,start,end,digest] of methods){
   const n=assignments.find(x=>x.start===start&&x.end===end), raw=text.slice(start,end);
   if(!n || sha(raw)!==digest || n.left.type!=='MemberExpression' || n.left.computed || n.left.property.name!==name || n.left.object?.property?.name!=='prototype' || n.left.object?.object?.name!=='A' || n.right.type!=='FunctionExpression') return null;
   const i=methods.findIndex(m=>m[0]===name), format=i%2?'json':'xml', helper=i%2?'cbFuncJson':'cbFunc', route=i<2?'/geo/coordconvert':i<4?'/geofencing/regions':'/geofencing/regions/';
   const receiver=i<4?'s':'r', xhr=i<4?'o':'n';
   const urlWitness = `${xhr}.open("GET",A.protocol+"//"+this._requestUrl+"${route}` + (i<4 ? '?"' : '"+t+"?"');
   if (!raw.includes(`format:"${format}"`) || !raw.includes(urlWitness) || !raw.includes(`${xhr}.onreadystatechange=function(){b.${helper}.apply(${receiver},[this])}`) || !raw.includes(`${receiver}.onError.apply(${receiver})`) || !raw.includes(`var ${receiver}=this;`)) return null;
   if(i>=4 && (n.right.params[0]?.name!=='t' || !raw.includes('"/geofencing/regions/"+t+"?"'))) return null;
  }
  for(const [name,start,end,digest] of helpers){const n=properties.find(x=>x.start===start&&x.end===end);if(!n || n.key.name!==name || n.value.type!=='FunctionExpression' || sha(text.slice(start,end))!==digest)return null;}
  return {coreSha256:coreHash, methods:methods.map(([name,start,end,sha256])=>({name,start,end,sha256})), callbackHelpers:helpers.map(([name,start,end,sha256])=>({name,start,end,sha256})), callbackScope:'Exact source witnesses: XML cbFunc and JSON cbFuncJson process readyState, response and onComplete/onError with the TData receiver; XDomainRequest uses separate IE helpers.', wireStatus:'UNVERIFIED'};
 } catch { return null; }
}

export function verifiedHistoricalNamedRest({manifest,source,docs,rows,docProof,validateNamedMethods},read=fs.readFileSync){
 try {
  const key=source?.url?.slice(urlBase.length), c=configs[key];
  if(!c || source.url!==urlBase+key || source.sha256!==c.hash || !Array.isArray(rows) || !Array.isArray(docs?.restReferenceFields) || typeof validateNamedMethods!=='function') return null;
  const mb=read(path.join(HERE,'baselines/production-2026-11-19-46fa62a7bb27.json'));
  if(sha(mb)!==manifestHash || !same(manifest,JSON.parse(mb)) || manifest.sources.filter(x=>x.url===source.url).length!==1 || !same(manifest.sources.find(x=>x.url===source.url),source)) return null;
  const sdk=manifest.sources.filter(s=>s.kind==='sdk'&&s.sha256===coreHash);
  if(sdk.length!==1 || sdk[0].role!=='flutter-web-fixed-cdn-versioned-core') return null;
  const names=c.methodIndexes.map(i=>methods[i][0]), route=key==='tmapGeofencingRegionsDetailDoc.html'?'/geofencing/regions/':c.endpoint;
  const runtime=validateNamedMethods(names,route);
  if(!runtime || !same(runtime.names,names) || runtime.httpMethod!=='GET' || runtime.routeLiteral!==route || runtime.wireStatus!=='UNVERIFIED' || runtime.activeCoreSha256!==coreHash || runtime.cores?.length!==2 || !runtime.cores.some(x=>x.sha256===coreHash && x.methodCount===28)) return null;
  const core=read(path.join(HERE,'.cache/sources',coreHash));
  if(core.length!==sdk[0].bytes) return null;
  const coreProof=historicalCoreWitness(core); if(!coreProof)return null;
  const fields=docs.restReferenceFields.filter(f=>f.source===source.url);
  if(fields.length!==c.fields || fields.filter(f=>f.direction==='request').length!==c.request || fields.filter(f=>f.direction==='response').length!==c.response || !fields.every(f=>f.status==='unverified'&&f.sourceSha256===source.sha256&&f.ambiguity===null)) return null;
  const proof=verifiedDocumentSources(source,fields,read);
  if(!proof || !same(proof,docProof) || proof.fieldCount!==c.fields || proof.tableIds.length!==c.tables) return null;
  const bytes=read(path.join(HERE,'.cache/sources',source.sha256));
  if(sha(bytes)!==source.sha256 || bytes.length!==source.bytes)return null;
  const $=load(bytes.toString('utf8'),{sourceCodeLocationInfo:true}), tables=$('table').toArray(), prefix=`rest-reference:${source.url}:`;
  if(tables.length!==c.tables || rows.filter(r=>typeof r?.id==='string'&&r.id.startsWith(prefix)).length!==c.tables)return null;
  const tableProof=[];
  for(let i=0;i<c.tables;i++){
   const id=`${prefix}table-${i}`, found=rows.filter(r=>r.id===id), el=tables[i], line=el.sourceCodeLocation?.startLine, anchor=$(el).attr('id')||null;
   if(found.length!==1 || !Number.isInteger(line))return null;
   const row=found[0], evidence={channel:'docs',source:source.url,sha256:source.sha256,anchor,line};
   if(row.status!=='unmapped'||row.scope!=='linked-rest-reference'||row.owner!==null||'referenceScopeReview' in row || !same(row.platforms,{web:'unmapped',android:'unmapped',ios:'unmapped'}) || !same(row.kinds,['reference-table'])||!same(row.channels,['docs'])||!same(row.sourceNames,[id])||!same(row.evidence,[evidence])||!emptyKeys.every(k=>Array.isArray(row[k])&&row[k].length===0))return null;
   tableProof.push({id,line,anchor,status:row.status});
  }
  const fullUrl=`https://apis.openapi.sk.com/tmap${c.endpoint}?${c.query}`;
  for(const i of c.resources){const text=$(tables[i]).text().replace(/\s+/g,' ').trim();if(!text.includes(`Resource URI ${fullUrl} `)||!text.includes('REST / Get Method'))return null;}
  const release=releasedHistoricalNamedProof(endpoints,methods.map(m=>m[0]),read);if(!release)return null;
  return {scope:'historical-named-js-schema-adapter-source-only',wireStatus:'UNVERIFIED', source:source.url, endpointTemplate:fullUrl, httpMethod:'GET', fieldCount:c.fields, directions:{request:c.request,response:c.response}, docProof:proof, tables:tableProof, methods:c.methodIndexes.map(i=>coreProof.methods[i]), callbackHelpers:coreProof.callbackHelpers, callbackScope:coreProof.callbackScope, runtimeIdentity:runtime, releasedAdapters:release};
 } catch {return null;}
}
