import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
import {validSdkBoundsIsEmptyReview} from './sdkbounds_isempty_scope.mjs';
import {compareSdkLatLngBoundsState} from './sdk_latlngbounds_state_compare.mjs';
import {executionBindingsCover} from './getter_binding_coverage.mjs';
import {validNortheastReview} from './northeast_review_scope.mjs';
import {compareLatLngBoundsNorthEast} from './latlngbounds_northeast_compare.mjs';
import {validNorthwestReview} from './northwest_review_scope.mjs';
import {compareLatLngBoundsCorners} from './latlngbounds_corner_compare.mjs';
import {validEqualsReview} from './equals_review_scope.mjs';
import {comparePointSizeEquals} from './point_size_equals_compare.mjs';
import {compareGeographicEquals} from './geographic_equals_compare.mjs';
import {compareLatLngBoundsCenter} from './latlngbounds_center_compare.mjs';
import {validCenterReview} from './center_review_scope.mjs';
import {rowSourceHash} from './scope_reviews.mjs';
import fs from 'node:fs';import path from 'node:path';
import {ROOT,HERE,sha} from './common.mjs';
import {getterExecutionBindings} from './getter_execution_bindings.mjs';
import {dimensions,platforms} from './contracts.mjs';
const reviews=JSON.parse(fs.readFileSync(new URL('./getter_reviews.json',import.meta.url),'utf8'));
const inputs=JSON.parse(fs.readFileSync(new URL('./getter_inputs.json',import.meta.url),'utf8'));
export function compareGetterCases(expected,actual,count) {
 if(expected.length!==count||actual.length!==count||new Set(expected.map(x=>x.id)).size!==count||new Set(actual.map(x=>x.id)).size!==count)return false;
 const expectedById=new Map(expected.map(x=>[x.id,x]));
 return actual.every(row=>row.status==='observed' && (row.numeric===true || (['Point','LatLng','Size','Bounds'].includes(row.resultKind)&&row.returnedSameReceiver===false&&row.repeatIdentity===false)) && row.receiverRetained===true && JSON.stringify(row)===JSON.stringify(expectedById.get(row.id)));
}
export function compareImmutableSetterCases(expected, actual, count) {
 if(expected.length!==count||actual.length!==count||new Set(expected.map(x=>x.id)).size!==count||new Set(actual.map(x=>x.id)).size!==count)return false;
 const byId=new Map(expected.map(x=>[x.id,x]));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 return actual.every(a=>{
  const e=byId.get(a.id);
  return e?.status==='observed'&&a.status==='observed'&&e.contract===a.contract&&e.returnType==='undefined'&&a.returnType==='Bounds'&&
   same(e.input,a.input)&&same(e.before,a.before)&&same(a.after,a.before)&&same(e.after,a.resultState)&&same(a.repeatState,a.resultState)&&
   a.returnedSameReceiver===false&&a.repeatIdentity===false;
 });
}
export function verifyNumericGetters({rows,manifest,ast,dart,runtime,libFingerprint},config=reviews,read=(file,encoding='utf8')=>fs.readFileSync(path.join(ROOT,file),encoding)) {
 const observations=[];
 const owned=new Set([...reviews.items,...config.items].flatMap(r=>[r.contract,r.returnReview?.id].filter(Boolean)));
 const candidates=rows.filter(r=>owned.has(r.id));
 for(const row of candidates){
  if(row.verification){delete row.verification;row.status='candidate-unverified';row.platforms=Object.fromEntries(platforms.map(p=>[p,'unverified']));}
 }
 const reject=reason=>{for(const row of candidates)row.proofProblems=[reason];return observations;};
 const sdk=manifest.sources.find(s=>s.kind==='sdk');
 if(config.baselineId!==manifest.id||config.sdkSha256!==sdk?.sha256||config.inputsSha256!==sha(JSON.stringify(inputs)))return reject('getter-baseline-or-inputs-mismatch');
 const sdkSource=read(path.relative(ROOT,path.join(HERE,'.cache/sources',sdk.sha256)));
 if(sha(sdkSource)!==sdk.sha256)return reject('getter-sdk-bytes-mismatch');
 try {
  if(!runtime.networkScripts?.some(s=>s.pinned===true&&s.status===200&&s.sha256===sdk.sha256))throw Error('native SDK not pinned');
  const evidence=runtime.platformEvidence;
  if(evidence?.libFingerprint?.sha256!==libFingerprint.sha256)throw Error('platform lib fingerprint');
  if(!executionBindingsCover(config.items))throw Error('missing reviewed variant execution binding');
  for(const binding of getterExecutionBindings)if(sha(read(binding.file))!==binding.sha256)throw Error('reviewed execution fixture changed');
  const required=['example/integration_test/getter_contracts.dart','example/integration_test/getter_contract_inputs.dart','example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart'];
  if(required.some(file=>evidence.inputs?.filter(i=>i.file===file).length!==1))throw Error('missing/duplicate runner fixture');
  for(const item of evidence.inputs)if(sha(read(item.file,null))!==item.sha256)throw Error('fixture bytes');
  for(const [file,digest] of Object.entries(libFingerprint.files))if(sha(read(file))!==digest)throw Error('lib bytes');
  const records=evidence.records.filter(r=>r.kind==='integration');
  if(records.length!==3||new Set(records.map(r=>r.file)).size!==3||platforms.some(p=>records.filter(r=>r.platform===p).length!==1))throw Error('independent platform runs');
  for(const rec of records){
   const log=read(rec.file);
   if(!rec.passed||sha(log)!==rec.sha256)throw Error('log status/digest');
   if(!platformLogPassed(log.split('\n'),rec.platform))throw Error('suite completion');
   const rows=parsePlatformMarkerRows(log.split('\n'),'GETTER CONTRACT RESULT:').map(row=>row.data);
   if(JSON.stringify(rows)!==JSON.stringify(rec.getterResults))throw Error('parsed log observations');
   if(config.items.some(r=>r.variant==='equals')){
    for(const [file,marker,key] of [['geometry_equals_contracts.dart','GEOMETRY EQUALS RESULT:','geometryEqualsResults'],['geographic_equals_contracts.dart','GEOGRAPHIC EQUALS RESULT:','geographicEqualsResults']]){
     if(evidence.inputs.filter(i=>i.file==='example/integration_test/'+file).length!==1)throw Error('missing/duplicate equals fixture');
     const parsed=parsePlatformMarkerRows(log.split('\n'),marker).map(row=>row.data);
     if(JSON.stringify(parsed)!==JSON.stringify(rec[key]))throw Error('parsed equals observations');
    }
   }
   if(config.items.some(r=>r.variant==='bounds-is-empty')){
    if(evidence.inputs.filter(i=>i.file==='example/integration_test/sdk_latlngbounds_state_contracts.dart').length!==1)throw Error('missing/duplicate bounds-state fixture');
    const state=parsePlatformMarkerRows(log.split('\n'),'SDK LATLNGBOUNDS STATE RESULT:').map(row=>row.data);
    if(JSON.stringify(state)!==JSON.stringify(rec.sdkLatLngBoundsStateResults))throw Error('parsed bounds-state observations');
   }
   if(config.items.some(r=>r.variant==='northeast')){
    if(evidence.inputs.filter(i=>i.file==='example/integration_test/latlngbounds_northeast_contracts.dart').length!==1)throw Error('missing/duplicate northeast fixture');
    const ne=parsePlatformMarkerRows(log.split('\n'),'LATLNGBOUNDS NORTHEAST RESULT:').map(row=>row.data);
    if(JSON.stringify(ne)!==JSON.stringify(rec.latLngBoundsNorthEastResults))throw Error('parsed northeast observations');
   }
   if(config.items.some(r=>r.variant==='northwest')){
    if(evidence.inputs.filter(i=>i.file==='example/integration_test/latlngbounds_corner_contracts.dart').length!==1)throw Error('missing/duplicate corner fixture');
    const corners=parsePlatformMarkerRows(log.split('\n'),'LATLNGBOUNDS CORNER RESULT:').map(row=>row.data);
    if(JSON.stringify(corners)!==JSON.stringify(rec.latLngBoundsCornerResults))throw Error('parsed corner observations');
   }
   if(config.items.some(r=>r.variant==='center')){
    if(!evidence.inputs.some(i=>i.file==='example/integration_test/latlngbounds_center_contracts.dart'))throw Error('missing center fixture');
    const center=parsePlatformMarkerRows(log.split('\n'),'LATLNGBOUNDS CENTER RESULT:').map(row=>row.data);
    if(JSON.stringify(center)!==JSON.stringify(rec.latLngBoundsCenterResults))throw Error('parsed center observations');
   }
  }
 }catch(error){return reject('getter-execution-evidence-rejected: '+error.message);}

 for(const review of config.items) {
  const row=rows.find(r=>r.id===review.contract);if(!row)continue;
  row.proofProblems=[];
  if(['center','northwest','northeast','bounds-is-empty'].includes(review.variant)){
   try {
   const doc=review.documentation;
   if(!(review.variant==='bounds-is-empty'?validSdkBoundsIsEmptyReview(review):review.variant==='northeast'?validNortheastReview(review):review.variant==='northwest'?validNorthwestReview(review):validCenterReview(review))||row.scope!=='documented'||!row.channels?.includes('docs')||rowSourceHash(row)!==review.rowSourceHash||
    runtime.aliases?.['Tmapv3.LatLngBounds']!=='Tmapv3.base.LatLngBounds'||runtime.aliases?.['Tmapv3.LatLng']!=='Tmapv3.base.LatLng'||
    !manifest.sources.some(s=>s.sha256===doc?.sha256)||sha(read(doc.file))!==doc.sha256||!read(doc.file).includes(doc.excerpt)){
     row.proofProblems=['center-source-scope-or-document-mismatch'];continue;
   }
   }catch{row.proofProblems=['center-document-unavailable'];continue;}
  }
  if(review.variant==='equals'){
   try{
    const doc=review.documentation;
    if(!validEqualsReview(review)||row.scope!=='documented'||!row.channels?.includes('docs')||rowSourceHash(row)!==review.rowSourceHash||
     ['Point','Size','LatLng','LatLngBounds'].some(c=>runtime.aliases?.['Tmapv3.'+c]!=='Tmapv3.base.'+c)||
     !manifest.sources.some(s=>s.sha256===doc?.sha256)||sha(read(doc.file))!==doc.sha256||!read(doc.file).includes(doc.excerpt)||!read(doc.file).includes('id="'+doc.anchor+'"')){
      row.proofProblems=['equals-source-scope-or-document-mismatch'];continue;
    }
   }catch{row.proofProblems=['equals-document-unavailable'];continue;}
  }
  const js=ast.rows.find(r=>r.id===review.contract && r.kind==='method');
  const declaration=dart.rows.find(r=>r.id===review.dartMember && r.kind==='method');
  const dartSource=read(review.dartFile),evidence=review.sdkEvidence;
  const adapted=review.variant==='immutable-setter';
  if(js?.bodySha256!==review.sdkBodySha256||js.parameters?.length!==((adapted||review.variant==='equals')?1:0)||
    sdkSource.slice(evidence.start,evidence.end)!==evidence.excerpt||
    !js.evidence?.some(e=>e.sha256===sdk.sha256&&e.start===evidence.start&&e.end===evidence.end)||
    !declaration||declaration.file!==review.dartFile||declaration.signature!==(review.dartSignature||`double ${review.dartMember.split('.').at(-1)}()`)||
    !dartSource.slice(declaration.start,declaration.end).trim().endsWith(review.dartStatement)||
    libFingerprint.files?.[review.dartFile]!==sha(dartSource)||
    !review.scope||!review.priorReportSearch?.filesSearched?.length||dimensions.some(d=>!review.dimensions[d])||
    (adapted&&(!review.adaptation?.native||!review.adaptation?.dart||!review.adaptation?.rationale))) {
    row.proofProblems.push('source-contract-review-no-longer-matches');continue;
  }
  if((review.sdkDependencies||[]).some(d=>!ast.rows.some(r=>r.id===d.id&&r.evidence?.some(e=>e.sha256===sdk.sha256&&e.start===d.evidence.start&&e.end===d.evidence.end)) || sdkSource.slice(d.evidence.start,d.evidence.end)!==d.evidence.excerpt) ||
     (review.dartDependencies||[]).some(d=>!d.statement || !read(d.file).includes(d.statement) || libFingerprint.files?.[d.file]!==sha(read(d.file)))) {
    row.proofProblems.push('transitive-constructor-review-no-longer-matches');continue;
  }
  if(review.publicAliasOf) {
    const parent=rows.find(r=>r.id===review.publicAliasOf),parentAst=ast.rows.find(r=>r.id===review.publicAliasOf&&r.kind==='method');
    if(parent?.status!=='verified'||parentAst?.bodySha256!==js.bodySha256||parent.owner!==row.owner) {
      row.proofProblems.push('public-alias-source-proof-incomplete');continue;
    }
    if(row.scope==='undocumented-review-required')row.scope='reviewed-public-alias';
  }
  if(!row.dartCandidates?.some(c=>c.id===declaration.id)) row.dartCandidates=[...(row.dartCandidates||[]),{id:declaration.id,file:declaration.file,line:declaration.line,signature:declaration.signature,binding:'source-reviewed adapter'}];
  const equalsGeographic=review.contract.includes('.LatLng');
  const equalsExpected=equalsGeographic?runtime.geographicEqualsObservations||[]:runtime.pointSizeEqualsObservations||[];
  const stateReview=review.variant==='bounds-is-empty';
  const stateRows=all=>all.filter(r=>review.caseIds?.includes(r.id)).map(r=>({...r,contract:review.contract}));
  const expected=stateReview?stateRows(runtime.sdkLatLngBoundsStateObservations||[]):(review.variant==='northeast'?runtime.latLngBoundsNorthEastObservations||[]:review.variant==='northwest'?runtime.latLngBoundsCornerObservations||[]:review.variant==='equals'?equalsExpected:review.variant==='center'?runtime.latLngBoundsCenterObservations||[]:runtime.getterObservations||[]).filter(r=>r.contract===review.contract);
  const proof={baselineId:manifest.id,libSha256:libFingerprint.sha256,scope:review.scope,sourceReview:{...review,dartFileSha256:sha(dartSource)},platforms:{}};
  for(const platform of platforms) {
   const record=runtime.platformEvidence?.records?.find(r=>r.platform===platform && r.kind==='integration');
   const equalsActual=equalsGeographic?record?.geographicEqualsResults||[]:record?.geometryEqualsResults||[];
   const actual=stateReview?stateRows(record?.sdkLatLngBoundsStateResults||[]):(review.variant==='northeast'?record?.latLngBoundsNorthEastResults||[]:review.variant==='northwest'?record?.latLngBoundsCornerResults||[]:review.variant==='equals'?equalsActual:review.variant==='center'?record?.latLngBoundsCenterResults||[]:record?.getterResults||[]).filter(r=>r.contract===review.contract);
   if(!record?.passed||!(stateReview?(compareSdkLatLngBoundsState(runtime.sdkLatLngBoundsStateObservations||[],record?.sdkLatLngBoundsStateResults||[]).status==='bounded-match'&&expected.length===9&&actual.length===9):review.variant==='northeast'?compareLatLngBoundsNorthEast(expected,actual).status==='bounded-match':review.variant==='northwest'?(compareLatLngBoundsCorners(runtime.latLngBoundsCornerObservations||[],record?.latLngBoundsCornerResults||[]).status==='bounded-match'&&expected.length===200&&actual.length===200):review.variant==='equals'?((equalsGeographic?compareGeographicEquals:comparePointSizeEquals)(equalsExpected,equalsActual).status==='bounded-match'&&expected.length===review.casesPerGetter&&actual.length===review.casesPerGetter):review.variant==='center'?compareLatLngBoundsCenter(expected,actual).status==='bounded-match':(adapted?compareImmutableSetterCases:compareGetterCases)(expected,actual,review.casesPerGetter||config.casesPerGetter))) {
    row.proofProblems.push(`${platform}:missing-or-different-getter-execution`);continue;
   }
   const id=`verified-getter:${platform}:${review.contract}`;
   observations.push({id,contract:review.contract,dartMember:review.dartMember,platform,status:adapted?'adaptation-match':'sample-match',dimensions,
    count:actual.length,caseIds:actual.map(r=>r.id),sourceReviewId:review.contract,
    actualSha256:sha(JSON.stringify(actual)),expectedSha256:sha(JSON.stringify(expected)),
    platformLog:{file:record.file,sha256:record.sha256}});
   proof.platforms[platform]=Object.fromEntries(dimensions.map(d=>[d,[id]]));
  }
  row.verification=proof;
  for(const platform of platforms)if(proof.platforms[platform])row.platforms[platform]='verified';
  if(!row.proofProblems.length)row.status=adapted?'reviewed-adaptation':'verified';
 }
 for(const review of config.items) {
  const parent=rows.find(r=>r.id===review.contract),child=rows.find(r=>r.id===review.returnReview?.id);
  if(parent?.status!=='verified'||!child||child.id!==parent.id+'->return'||child.scope!=='documented'||!child.kinds.includes('return-contract')||
    !child.contracts.length||child.contracts.some(c=>review.variant==='bounds-is-empty'?!c.includes('{Boolean}'):['clone','center','northwest','northeast'].includes(review.variant)?!c.includes('{Tmapv3.'+review.returnReview.expectedType+'}'):!/{(?:Number|Float)}/i.test(c))||
    sha(JSON.stringify({id:child.id,kinds:child.kinds,contracts:child.contracts,evidence:child.evidence}))!==review.returnReview.rowSourceHash)continue;
  const proof=structuredClone(parent.verification);proof.parentContract=parent.id;proof.returnReview=review.returnReview;
  for(const platform of platforms) {
   const original=observations.find(o=>o.contract===parent.id&&o.platform===platform);
   const derived={...original,id:original.id+':return',contract:child.id,derivedFrom:original.id};
   observations.push(derived);proof.platforms[platform]=Object.fromEntries(dimensions.map(d=>[d,[derived.id]]));
  }
  child.status='verified';child.platforms={...parent.platforms};child.verification=proof;
  child.dartCandidates=parent.dartCandidates;child.proofProblems=[];
 }
 return observations;
}
