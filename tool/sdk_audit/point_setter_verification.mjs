import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,sha} from './common.mjs';
import {dimensions,platforms} from './contracts.mjs';
import {rowSourceHash} from './scope_reviews.mjs';
import {comparePointSizeSetterCases} from './point_size_setter_compare.mjs';
import {pointSetterScope,pointSetterDimensions,pointSetterBindings} from './point_setter_scope.mjs';

const reviews=JSON.parse(fs.readFileSync(new URL('./point_setter_reviews.json',import.meta.url),'utf8'));
const allowed=new Map([
 ['Tmapv3.base.Point#setX',{dart:'Point.withX',arity:1,count:100}],
 ['Tmapv3.base.Point#setY',{dart:'Point.withY',arity:1,count:100}],
 ['Tmapv3.base.Point#setValue',{dart:'Point.withValue',arity:2,count:1000}],
]);
const readDefault=(file,encoding='utf8')=>fs.readFileSync(path.join(ROOT,file),encoding);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// Scope admission is deliberately narrower than the numeric comparison:
// Size methods, parameters, constructors and inherited events are not admitted.
export function pointSetterSourceProblems(review,{row,ast,dart,docs,libFingerprint,sdkSource,sdkSha256},read=readDefault) {
 const rule=allowed.get(review.contract),problems=[];
 if(!rule||review.variant!=='immutable-point-setter'||review.dartMember!==rule.dart||review.arity!==rule.arity||review.casesPerPlatform!==rule.count||
    row?.id!==review.contract||row.scope!=='documented'||rowSourceHash(row)!==review.rowSourceHash||
    review.scope!==pointSetterScope||dimensions.some(d=>review.dimensions?.[d]!==pointSetterDimensions[d])||!review.priorReportSearch?.filesSearched?.length||
    !review.adaptation?.native||!review.adaptation?.dart||!review.adaptation?.rationale) return ['point-setter-scope-review-mismatch'];
 const document=review.document;
 try {
  const raw=docs?.rows?.find(r=>r.id===review.contract.replace('Tmapv3.base.Point','Tmapv3.Point')&&r.kind==='method');
  const source=read(document.file);
  const matches=e=>e.channel==='docs'&&e.sha256===document.sha256&&e.source===document.source;
  if(!row.channels?.includes('docs')||!row.evidence?.some(matches)||!raw||raw.id!==document.id||raw.owner!==document.owner||raw.name!==document.name||raw.documentAnchor!==document.anchor||!raw.evidence?.some(matches)||
   document.file!=='tool/sdk_audit/.cache/sources/'+document.sha256||sha(source)!==document.sha256||source.slice(document.start,document.end)!==document.excerpt||!document.excerpt.startsWith('id="'+document.anchor+'"'))throw Error('document binding');
 }catch{problems.push('point-setter-document-source-mismatch');}
 const method=ast.rows.find(r=>r.id===review.contract&&r.kind==='method');
 const declaration=dart.rows.find(r=>r.id===rule.dart&&r.kind==='method');
 const validSdk=e=>e?.sourceSha256===sdkSha256&&Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end>e.start&&sdkSource.slice(e.start,e.end)===e.excerpt;
 if(!method||method.bodySha256!==review.sdkBodySha256||method.parameters?.length!==rule.arity||!validSdk(review.sdkEvidence)||
    !method.evidence?.some(e=>e.sha256===sdkSha256&&e.start===review.sdkEvidence.start&&e.end===review.sdkEvidence.end))problems.push('point-setter-native-source-mismatch');
 const dep=review.constructorDependencies;
 if(dep?.sdk?.id!=='Tmapv3.base.Point#constructor'||!validSdk(dep?.sdk)||sha(dep.sdk.excerpt)!==dep.sdk.bodySha256||!ast.rows.some(r=>
  r.id===dep.sdk.id&&r.kind==='constructor'&&same(r.parameters,dep.sdk.parameters)&&
  r.evidence?.some(e=>e.sha256===sdkSha256&&e.start===dep.sdk.start&&e.end===dep.sdk.end)))problems.push('point-constructor-source-mismatch');
 try {
  const source=read(review.dartFile),e=review.dartEvidence,c=dep?.dart;
  if(sha(source)!==e?.sourceSha256||libFingerprint.files?.[review.dartFile]!==sha(source)||
     review.dartFile!=='lib/src/models/point.dart'||!declaration||declaration.file!==review.dartFile||declaration.signature!==review.dartSignature||declaration.start!==e.start||declaration.end!==e.end||source.slice(e.start,e.end)!==e.excerpt||
     c?.file!==review.dartFile||c.sourceSha256!==sha(source)||source.slice(c.start,c.end)!==c.excerpt||
     !dart.rows.some(r=>r.id==='Point.new'&&r.kind==='constructor'&&r.file===c.file&&r.start===c.start&&r.end===c.end))problems.push('point-setter-dart-source-mismatch');
 }catch{problems.push('point-setter-dart-source-unavailable');}
 return problems;
}

export function verifyPointSetterAdaptations({rows,manifest,ast,dart,docs,runtime,libFingerprint},config=reviews,read=readDefault) {
 const observations=[],candidates=rows.filter(r=>allowed.has(r.id));
 for(const row of candidates){
  if(row.verification?.sourceReview?.variant==='immutable-point-setter'||row.status==='reviewed-adaptation'){
   delete row.verification;row.status='candidate-unverified';row.platforms=Object.fromEntries(platforms.map(p=>[p,'unverified']));
  }
 }
 const reject=reason=>{for(const row of candidates)row.proofProblems=[...(row.proofProblems||[]),reason];return observations;};
 const sdk=manifest.sources.find(s=>s.kind==='sdk');
 if(config.baselineId!==manifest.id||config.sdkSha256!==sdk?.sha256)return reject('point-setter-baseline-mismatch');
 if(['fixture','probe','inputs'].some(k=>!same(config[k],pointSetterBindings[k])))return reject('point-setter-fixed-binding-mismatch');
 if(!Array.isArray(config.items)||config.items.some(r=>!manifest.sources.some(s=>s.sha256===r.document?.sha256&&s.url===r.document?.source)))return reject('point-setter-document-not-pinned');
 let sdkSource,inputs;
 try {
  sdkSource=read('tool/sdk_audit/.cache/sources/'+sdk.sha256);
  if(sha(sdkSource)!==sdk.sha256)throw Error('SDK digest');
  for(const binding of [config.fixture,config.probe,config.inputs])if(sha(read(binding.file))!==binding.sha256)throw Error('fixture/probe/input digest');
  inputs=JSON.parse(read(config.inputs.file));
 }catch{return reject('point-setter-input-source-mismatch');}
 if(runtime.aliases?.['Tmapv3.Point']!=='Tmapv3.base.Point'||!runtime.networkScripts?.some(s=>s.pinned===true&&s.status===200&&s.sha256===sdk.sha256))return reject('point-setter-native-runtime-not-pinned');
 const evidence=runtime.platformEvidence;
 if(evidence?.libFingerprint?.sha256!==libFingerprint.sha256)return reject('point-setter-platform-source-mismatch');
 const records=(evidence.records||[]).filter(r=>r.kind==='integration');
 if(records.length!==3||new Set(records.map(r=>r.platform)).size!==3||new Set(records.map(r=>r.file)).size!==3||platforms.some(p=>!records.some(r=>r.platform===p)))return reject('point-setter-independent-platform-runs-missing');
 const compared=new Map();
 try {
  for(const entry of evidence.inputs||[])if(sha(read(entry.file,null))!==entry.sha256)throw Error('input digest');
  const required=['example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart','example/integration_test/getter_contract_inputs.dart',config.fixture.file];
  if(required.some(file=>evidence.inputs?.filter(i=>i.file===file).length!==1))throw Error('required runner/input absent or duplicated');
  if(!evidence.inputs?.some(i=>i.file===config.fixture.file&&i.sha256===config.fixture.sha256))throw Error('point fixture absent');
  for(const [file,digest] of Object.entries(libFingerprint.files))if(sha(read(file))!==digest)throw Error('lib digest');
  for(const rec of records) {
   const log=read(rec.file);if(!rec.passed||sha(log)!==rec.sha256)throw Error('log digest/status');
   if(!platformLogPassed(log.split('\n'),rec.platform))throw Error('log completion');
   const logged=parsePlatformMarkerRows(log.split('\n'),'POINT SIZE SETTER RESULT:').map(row=>row.data);
   if(!same(logged,rec.pointSizeSetterResults))throw Error('log observations mismatch');
   const comparison=comparePointSizeSetterCases(runtime.pointSizeSetterObservations||[],logged,inputs);
   if(comparison.status!=='bounded-match'||comparison.expectedCases!==3600||comparison.comparedCases!==3600||comparison.issues.length)throw Error('native/platform comparison');
   compared.set(rec.platform,{rec,actual:logged});
  }
 }catch(error){return reject('point-setter-platform-evidence-rejected: '+error.message);}
 for(const review of config.items) {
  const row=rows.find(r=>r.id===review.contract);if(!row)continue;
  const problems=pointSetterSourceProblems(review,{row,ast,dart,docs,libFingerprint,sdkSource,sdkSha256:sdk.sha256},read);
  if(problems.length){row.proofProblems=[...(row.proofProblems||[]),...problems];continue;}
  const expected=runtime.pointSizeSetterObservations.filter(r=>r.contract===review.contract);
  if(expected.length!==review.casesPerPlatform) {row.proofProblems=['point-setter-case-count-mismatch'];continue;}
  const proof={baselineId:manifest.id,libSha256:libFingerprint.sha256,scope:review.scope,
   sourceReview:{...review,dartFileSha256:review.dartEvidence.sourceSha256,fixture:config.fixture,probe:config.probe,inputs:config.inputs},platforms:{}};
  for(const platform of platforms) {
   const {rec,actual}=compared.get(platform),selected=actual.filter(r=>r.contract===review.contract);
   const id=`point-setter-adaptation:${platform}:${review.contract}`;
   observations.push({id,contract:review.contract,dartMember:review.dartMember,platform,status:'adaptation-match',dimensions,
    scope:review.scope,count:selected.length,caseIds:selected.map(r=>r.id),sourceReviewId:review.contract,
    expectedSha256:sha(JSON.stringify(expected)),actualSha256:sha(JSON.stringify(selected)),platformLog:{file:rec.file,sha256:rec.sha256}});
   proof.platforms[platform]=Object.fromEntries(dimensions.map(d=>[d,[id]]));
  }
  row.verification=proof;row.proofProblems=[];row.status='reviewed-adaptation';
  row.platforms=Object.fromEntries(platforms.map(p=>[p,'verified']));
 }
 return observations;
}
