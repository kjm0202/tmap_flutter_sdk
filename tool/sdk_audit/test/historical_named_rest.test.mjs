import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {HERE} from '../common.mjs';
import {currentReferenceValidator} from '../current_reference_scope.mjs';
import {verifiedDocumentSources} from '../current_rest_document_sources.mjs';
import {historicalCoreWitness, verifiedHistoricalNamedRest} from '../historical_named_rest.mjs';
import {releasedHistoricalNamedProof} from '../release_rest_named_adapters.mjs';
import {reviewRestDocuments} from '../rest_document_review.mjs';

const code='rest-reference-schema-review-required';
const status='DOCUMENT_HISTORICAL_NAMED_SCHEMA_ADAPTER_SCOPE_RESOLVED';
const names=['transform','transformJson','getGeofencingFromSearch','getGeofencingFromSearchJson','getGeofencingFromId','getGeofencingFromIdJson'];
const endpoints=['/geo/coordconvert','/geofencing/regions','/geofencing/regions/{regionId}'];
const specs=[['convertCoord.html',6,10,7,3],['tmapGeofencingRegionsDoc.html',6,23,12,11],['tmapGeofencingRegionsDetailDoc.html',11,47,10,37]];
const manifest=JSON.parse(fs.readFileSync(path.join(HERE,'baselines/production-2026-11-19-46fa62a7bb27.json')));
const readReport=()=>({report:JSON.parse(fs.readFileSync(path.join(process.env.TMAP_AUDIT_REST_REPORT_DIR,'report.json'))),docs:JSON.parse(fs.readFileSync(path.join(process.env.TMAP_AUDIT_REST_REPORT_DIR,'docs.json')))});
const clone=x=>structuredClone(x);
const original=(report,suffix)=>{
 const open=report.issues.filter(x=>x.code===code&&x.source.endsWith('/'+suffix));
 const resolved=report.resolvedIssues.filter(x=>x.original?.code===code&&x.original.source.endsWith('/'+suffix));
 assert.equal(open.length+resolved.length,1,`one original for ${suffix}`);
 if(resolved.length) assert.equal(resolved[0].status,status);
 return {issue:open[0]||resolved[0].original, previous:resolved[0]};
};
const replaceRead=name=>p=>String(p).endsWith(name)?Buffer.from('corrupt'):fs.readFileSync(p);
const pairs=[
 {route:'/geo/coordconvert', names:names.slice(0,2), suffix:null, hashes:[['8d454a0b2b1267e9bc58b13b00c8b1ea15f61f9bcc9d2f6d39a92dce69b0e789','56567af15baece25bf435620758a1d98b6761540328e5cfd9e5ce4cf9f3f4ec6'],['4ed1f05340769900968599c549043a094d7512f6f0daa24716f6b8c9ff2dd9fc','9223cddecc0f3ee67f2f164e1daf0cc15353bfbb12a80356717861a019a5c208']]},
 {route:'/geofencing/regions', names:names.slice(2,4), suffix:null, hashes:[['ad6323a76f40c9595622daa014aef11e4eed004d457359144411c2b7882a8cba','a9792a856e1907b415c5a800daa559ed3b8faba1ef218b4514a665a9824ebb79'],['20dfbf61772b1d8ca4561e7a0418931fd2a9deb4f4575112c1e53e4600e464ed','7c946f40b84c7b18e3a7671b27e599bed1250eab3277b1e806dde2f0bbd805b0']]},
 {route:'/geofencing/regions/', names:names.slice(4,6), suffix:'t', hashes:[['8ec1b8c98c8f04fdad861d1a4edbb89611da71338270a6e1a783df3e74ca8133','531b89afe5dee4f76ff724d227733420df2f4007789b6e3a2891b75000841ace'],['abc5a2fde839dcf30442d57533903e671480f161a635afa5d3edd21b8e2bbdea','b985ead619c3c58dd07372fbf85c6cf022e96e6324591f303c571c171c3e8c43']]}
];
const coreHashes=['5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e','09557bf8f7cfd14ff4ea9cca226962469fa14208ef4af1ee6b2d3567798296f1'];
const documentHashes=['ed8ea4fec91f2d4e92c14458b476d082efb7405f7e868a4d8551c19aff20db5d','c8f6b3c31fe4c6752e4880bf2ddf3a6f65f83f8688767c107a0e4e83c9341fd8','617004fe41eb7c3349b086d1e230d3d6782183f6e4561ace2772764e9f6a2689'];
const digest=x=>createHash('sha256').update(x).digest('hex');

test('six original JS witnesses and published HTTP classes are pinned',()=>{
 const core=fs.readFileSync(path.join(HERE,'.cache/sources/5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e'));
 const witness=historicalCoreWitness(core);assert.deepEqual(witness.methods.map(x=>x.name),names);
 assert.deepEqual(witness.callbackHelpers.map(x=>x.name),['cbFunc','cbFuncJson','cbFuncIE','cbFuncIEJson']);
 for(const [from,to] of [['"/geofencing/regions/"+t+"?"','"/geofencing/regions/"+"?"'],['b.cbFuncJson.apply(r,[this])','b.cbFunc.apply(r,[this])'],['this.onComplete.apply(this,[this])','this.onComplete.apply(null,[this])'],['format:"xml"','format:"json"']]) {
  const raw=core.toString('utf8');assert.ok(raw.includes(from));assert.equal(historicalCoreWitness(Buffer.from(raw.replace(from,to))),null,from);
 }
 const release=releasedHistoricalNamedProof(endpoints,names);assert.ok(release);
 assert.ok(release.httpClassEntries.TDataService && release.httpClassEntries.TDataResponse && release.httpClassEntries.TMapController);
 assert.equal(release.absentMethodNames.length,6);
 assert.equal(releasedHistoricalNamedProof(['/pois'],names),null,'actual named route');
 assert.equal(releasedHistoricalNamedProof(endpoints,['searchPoi',...names.slice(1)]),null,'published method');
 for(const file of ['actual-pub-0.1.1.tar.gz','published-flutter-api.json.gz']) assert.equal(releasedHistoricalNamedProof(endpoints,names,replaceRead(file)),null,file);
});

test('positive named pairs bind ordered methods, both source cores and authenticated runtime',(t)=>{
 if(process.env.TMAP_AUDIT_REST_REPORT_DIR===undefined){t.skip('TMAP_AUDIT_REST_REPORT_DIR not set');return;}
 const {report,docs}=readReport(), validate=currentReferenceValidator(report).namedMethodsPresent;
 assert.equal(typeof validate,'function');
 for(const [i,pair] of pairs.entries()){
  const proof=validate(pair.names,pair.route);assert.ok(proof,pair.route);
  assert.deepEqual(proof.names,pair.names);assert.equal(proof.routeLiteral,pair.route);
  assert.equal(proof.httpMethod,'GET');assert.equal(proof.dynamicSuffix,pair.suffix);assert.equal(proof.wireStatus,'UNVERIFIED');
  assert.equal(proof.baselineId,manifest.id);assert.equal(proof.activeCoreSha256,coreHashes[0]);
  assert.equal(proof.bootstrapSha256,manifest.auth.sha256);
  assert.equal(proof.comparisonSha256,'a8315b9f6ef46d67448c3e880e0d3dd91a0955ffd5fcc822c317bce15f91e5fb');
  assert.deepEqual(proof.cores.map(c=>c.sha256),coreHashes);
  assert.equal(proof.activeMethods.length,28);
  for(const name of pair.names){
   const id='Tmapv3.extension.TData#'+name;
   assert.deepEqual(proof.activeMethods.filter(m=>m.id===id).map(m=>m.runtimeRow),report.referenceRuntimeEvidence.rows.filter(r=>r.id===id));
   assert.equal(proof.activeMethods.filter(m=>m.id===id).length,1);
  }
  for(const [j,core] of proof.cores.entries()){
   const bytes=fs.readFileSync(path.join(HERE,'.cache/sources',core.sha256)), text=bytes.toString('utf8');
   assert.equal(digest(bytes),coreHashes[j]);assert.equal(core.methodCount,28);assert.equal(core.methods.length,28);
   assert.deepEqual(core.selectedMethods.map(m=>m.name),pair.names);
   assert.deepEqual(core.selectedMethods.map(m=>m.sha256),pair.hashes[j]);
   for(const [k,method] of core.selectedMethods.entries()){
    const raw=text.slice(method.start,method.end);
    assert.equal(digest(raw),pair.hashes[j][k]);assert.equal(method.httpVerb,'GET');
    assert.equal(method.expectedNamedRoute,pair.route);
    assert.ok(raw.includes(`format:"${k?'json':'xml'}"`));
    assert.ok(raw.includes(`.open("GET",${method.requestExpression}`));
    const routeExpression=pair.suffix?`"${pair.route}"+t+"?"`:`"${pair.route}?"`;
    assert.ok(method.requestExpression.includes(routeExpression),method.requestExpression);
   }
  }
  const {issue}=original(report,specs[i][0]),source=manifest.sources.find(s=>s.url===issue.source);
  assert.equal(source.sha256,documentHashes[i]);
  assert.equal(digest(fs.readFileSync(path.join(HERE,'.cache/sources',source.sha256))),documentHashes[i]);
  const docProof=verifiedDocumentSources(source,docs.restReferenceFields.filter(f=>f.source===source.url));
  const historical=verifiedHistoricalNamedRest({manifest,source,docs,rows:report.rows,docProof,validateNamedMethods:validate});
  assert.ok(historical);assert.deepEqual(historical.methods.map(m=>m.name),pair.names);
  assert.deepEqual(historical.methods.map(m=>m.sha256),pair.hashes[0]);
  assert.deepEqual(historical.runtimeIdentity,proof);assert.equal(historical.httpMethod,'GET');
  for(const [wrongNames,wrongRoute] of [
   [[...pair.names].reverse(),pair.route], [names.slice((i+1)%3*2,(i+1)%3*2+2),pair.route],
   [[pair.names[0],pair.names[0]],pair.route], [[pair.names[0],pair.names[1].replace(/Json$/,'')],pair.route],
   [pair.names,pairs[(i+1)%3].route], [pair.names,pair.route.endsWith('/')?pair.route.slice(0,-1):pair.route+'/']
  ]) assert.equal(validate(wrongNames,wrongRoute),null,`${wrongNames} ${wrongRoute}`);
  for(const badProof of [{...proof,names:[...pair.names].reverse()},{...proof,names:[pair.names[0],pair.names[0]]},{...proof,routeLiteral:pairs[(i+1)%3].route},{...proof,routeLiteral:pair.route.endsWith('/')?pair.route.slice(0,-1):pair.route+'/'},{...proof,httpMethod:'POST'}, {...proof,wireStatus:'VERIFIED'},{...proof,activeCoreSha256:coreHashes[1]},null])
   assert.equal(verifiedHistoricalNamedRest({manifest,source,docs,rows:report.rows,docProof,validateNamedMethods:()=>badProof}),null);
 }
});

test('positive identity rejects missing or altered loaded methods and duplicate candidates',(t)=>{
 if(process.env.TMAP_AUDIT_REST_REPORT_DIR===undefined){t.skip('TMAP_AUDIT_REST_REPORT_DIR not set');return;}
 const {report}=readReport(), pair=pairs[2], id='Tmapv3.extension.TData#'+pair.names[0];
 const loaded=report.referenceRuntimeEvidence.rows.find(r=>r.id===id), row=report.rows.find(r=>r.id===id);
 assert.ok(loaded);assert.ok(row);
 const damaged=[
  {...report,referenceRuntimeEvidence:{...report.referenceRuntimeEvidence,rows:report.referenceRuntimeEvidence.rows.filter(r=>r!==loaded)}},
  {...report,referenceRuntimeEvidence:{...report.referenceRuntimeEvidence,rows:[...report.referenceRuntimeEvidence.rows,clone(loaded)]}},
  {...report,referenceRuntimeEvidence:{...report.referenceRuntimeEvidence,rows:report.referenceRuntimeEvidence.rows.map(r=>r===loaded?{...r,valueType:'object'}:r)}},
  {...report,rows:[...report.rows,clone(row)]},
  {...report,rows:report.rows.map(r=>r===row?{...r,evidence:r.evidence.map(e=>e.channel==='ast'?{...e,start:e.start+1}:e)}:r)}
 ];
 for(const bad of damaged){
  const validator=currentReferenceValidator(bad);
  assert.equal(validator.namedMethodsPresent?.(pair.names,pair.route)??null,null);
  const {issue}=original(report,specs[2][0]);
  assert.deepEqual(reviewRestDocuments({manifest,docs:readReport().docs,rows:bad.rows,referenceRuntimeEvidence:bad.referenceRuntimeEvidence,issues:[issue]}).open,[issue]);
 }
});

test('real baseline and post-audit replay preserve previous receipts and candidates',(t)=>{
 if(process.env.TMAP_AUDIT_REST_REPORT_DIR===undefined){t.skip('TMAP_AUDIT_REST_REPORT_DIR not set');return;}
 const {report,docs}=readReport();
 const prior=report.resolvedIssues.filter(x=>x.original?.code===code && x.status==='DOCUMENT_REFERENCE_SCOPE_RESOLVED');
 const direct=report.resolvedIssues.filter(x=>x.original?.code===code && x.status==='DOCUMENT_DIRECT_REST_EXAMPLE_SCOPE_RESOLVED');
 assert.equal(prior.length,23,'all 23 prior reference receipts are required');assert.equal(direct.length,1,'the prior direct example receipt is required');
 const originals=specs.map(([suffix])=>original(report,suffix));
 const issues=[...report.issues,...originals.filter(x=>x.previous).map(x=>x.issue)];
 const before=JSON.stringify(report.rows.map(r=>[r.id,r.status,r.scope,r.platforms]));
 const fields=JSON.stringify(docs.restReferenceFields);
 const ctx={manifest,docs,rows:report.rows,referenceRuntimeEvidence:report.referenceRuntimeEvidence};
 const result=reviewRestDocuments({...ctx,issues});
 assert.equal(result.resolved.length,3);
 assert.equal(result.open.length,issues.length-3);
 assert.equal(result.open.filter(i=>i.code===code).length,10);
 assert.equal(report.rows.length,4046);
 assert.equal(JSON.stringify(report.rows.map(r=>[r.id,r.status,r.scope,r.platforms])),before);
 assert.equal(JSON.stringify(docs.restReferenceFields),fields);
 for(const [suffix,tables,count,request,response] of specs){
  const r=result.resolved.find(x=>x.original.source.endsWith('/'+suffix));assert.ok(r);assert.equal(r.status,status);
  const p=r.receipt.proof;assert.equal(p.wireStatus,'UNVERIFIED');assert.equal(p.tables.length,tables);assert.equal(p.fieldCount,count);assert.deepEqual(p.directions,{request,response});
  assert.ok(p.tables.every(t=>t.status==='unmapped'));
  assert.ok(docs.restReferenceFields.filter(f=>f.source===r.original.source).every(f=>f.status==='unverified'));
  const previous=originals.find(x=>x.issue.source===r.original.source).previous;
  if(previous) assert.deepEqual(JSON.parse(JSON.stringify(r)),previous,'replay equals recorded receipt');
 }
 const replay=reviewRestDocuments({...ctx,issues:[...prior,...direct].map(x=>x.original)});
 assert.equal(replay.open.length,0);assert.deepEqual(JSON.parse(JSON.stringify(replay.resolved)),[...prior,...direct]);
 const detail=result.resolved.find(x=>x.original.source.endsWith('tmapGeofencingRegionsDetailDoc.html')).receipt.proof;
 assert.ok(detail.endpointTemplate.includes('/regions/{regionId}?'));assert.deepEqual(detail.methods.map(x=>x.name),names.slice(4));
});

test('historical mapping fails closed for damaged evidence and rows',(t)=>{
 if(process.env.TMAP_AUDIT_REST_REPORT_DIR===undefined){t.skip('TMAP_AUDIT_REST_REPORT_DIR not set');return;}
 const {report,docs}=readReport();const {issue}=original(report,'tmapGeofencingRegionsDetailDoc.html');
 const source=manifest.sources.find(s=>s.url===issue.source), rows=report.rows, fields=docs.restReferenceFields.filter(f=>f.source===source.url);
 const docProof=verifiedDocumentSources(source,fields);assert.ok(docProof);
 const validator=currentReferenceValidator(report);
 const ctx={manifest,source,docs,rows,docProof,validateNamedMethods:validator.namedMethodsPresent};
 const verify=(over={},read)=>verifiedHistoricalNamedRest({...ctx,...over},read);
 assert.ok(verify());
 const row=rows.find(r=>r.id===docProof.tableIds[0]);const alterRow=patch=>rows.map(r=>r===row?{...r,...patch}:r);
 const field=fields[0], alterField=patch=>({...docs,restReferenceFields:docs.restReferenceFields.map(f=>f===field?{...f,...patch}:f)});
 const bad={
  'wrong URL':{source:{...source,url:source.url.replace('Detail','')}},
  'source metadata':{source:{...source,bytes:source.bytes+1}},
  'manifest':{manifest:{...manifest,id:'changed'}},
  'missing row':{rows:rows.filter(r=>r!==row)},
  'duplicate row':{rows:[...rows,row]},
  'extra row':{rows:[...rows,{...row,id:`rest-reference:${source.url}:table-11`}]},
  'promoted row':{rows:alterRow({status:'reviewed-reference-only'})},
  'platform status':{rows:alterRow({platforms:{...row.platforms,web:'implemented'}})},
  'scope':{rows:alterRow({scope:'documented'})},
  'row evidence':{rows:alterRow({evidence:[{...row.evidence[0],line:row.evidence[0].line+1}]})},
  'direction':{docs:alterField({direction:'response'})},
  'hierarchy':{docs:alterField({ambiguity:'unknown'})},
  'changed path':{docs:alterField({displayPath:['wrong']})},
  'field status':{docs:alterField({status:'verified'})},
  'duplicate field':{docs:{...docs,restReferenceFields:[...docs.restReferenceFields,field]}},
  'forged proof':{docProof:{...docProof,fieldCount:46}},
  'runtime absent':{validateNamedMethods:()=>null}
 };
 for(const [label,over] of Object.entries(bad))assert.equal(verify(over),null,label);
 for(const file of [source.sha256,'5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e','rest-field-table-layout.json.gz','actual-pub-0.1.1.tar.gz','published-flutter-api.json.gz','production-2026-11-19-46fa62a7bb27.json']) assert.equal(verify({},replaceRead(file)),null,file);
 const ctxReview={manifest,docs,rows,referenceRuntimeEvidence:report.referenceRuntimeEvidence};
 for(const damaged of [[{...issue,reason:'changed'}],[{...issue,tables:6}],[{...issue,extra:true}],[issue,clone(issue)]])assert.deepEqual(reviewRestDocuments({...ctxReview,issues:damaged}).open,damaged);
 for(const badRuntime of [null,{...report.referenceRuntimeEvidence,auth:'changed'},{...report.referenceRuntimeEvidence,rows:[]}]) assert.deepEqual(reviewRestDocuments({...ctxReview,referenceRuntimeEvidence:badRuntime,issues:[issue]}).open,[issue]);
});
