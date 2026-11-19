// Exact, source-reviewed adaptation for the two Vsm.Event accessors only.
// A prevalidated result is a snapshot and must never be cached across mutation.
import fs from 'node:fs';import path from 'node:path';import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';import {rowSourceHash} from './scope_reviews.mjs';
import {verifySdkEventGetterDomainAdaptations} from './sdk_event_getter_domain_strict_verification.mjs';
export const sdkEventGetterContracts=Object.freeze(['Vsm.Event#name','Vsm.Event#data']);
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const ROWS={'Vsm.Event#name':'b81647788c4e4f8b126bc85bdd68514be14a6f3702ea677a4a9e2b929cd65b05','Vsm.Event#data':'54aaf9f51b683c357d47ad3450e5e97b006102726c3f058c30160d6a9d876464'};
const BODIES={'Vsm.Event#name':'911afbf0a3509750730a4db9e8fd86915d86206f40c77a6875b3fe52a840f09d','Vsm.Event#data':'e65f6c1465687b80d1f86ba53bbf4be212c8643a6dba30d90d90c18b0a32ea42'};
const dimensions=['inputs-defaults','returns-types','mutation-identity','errors','lifecycle-events','dispatch'],platforms=['web','android','ios'];
const member='SdkNativeHandle.get',file='lib/src/models/sdk_native_events.dart',signature='Future<Object?> get(Object property)';
function rowMatches(row,id){
 if(!row||row.id!==id||row.owner!==null||row.scope!=='engine-export-review-required'||!same(row.kinds,['accessor'])||!same(row.channels,['runtime-engine'])||!same(row.sourceNames,[id])||!same(row.contracts,[])||rowSourceHash(row)!==ROWS[id])return false;
 const c=row.dartCandidates;if(!Array.isArray(c)||c.length!==1)return false;const d=c[0];return d.id===member&&d.file===file&&d.signature===signature&&Number.isInteger(d.line)&&d.line>0&&(d.inheritedFrom===undefined||d.inheritedFrom===null);
}
function writable(row,key){const d=Object.getOwnPropertyDescriptor(row,key);return d ? Object.hasOwn(d,'value')&&d.writable===true : Object.isExtensible(row);}
function rowsMatch(rows){if(!Array.isArray(rows)||new Set(rows.map(x=>x.id)).size!==rows.length)return false;return sdkEventGetterContracts.every(id=>rows.filter(x=>x.id===id).length===1&&!rows.some(x=>x.id.startsWith(id+'->')||x.id.startsWith(id+':'))&&rowMatches(rows.find(x=>x.id===id),id));}
function observation(id,p,entry){const source=entry.prior,domain=entry.domain;return {id:`sdk-event-getter-adaptation:${p}:${id}`,contract:id,dartMember:member,platform:p,status:'adaptation-match',dimensions:[...dimensions],count:1,actualSha256:sha(JSON.stringify({source,domain})),platformLog:entry.log};}
function build(id,libFingerprint,strict){
 const observations=Object.fromEntries(platforms.map(p=>[p,observation(id,p,strict.platforms[p])]));
 const native='Synchronous JavaScript accessor returns the current backing property or propagates its thrown value; property overrides and proxy traps affect dispatch.';
 const dart='Asynchronous SdkNativeHandle.get delegates Reflect.get, represents native references as bridge-scoped handles, and wraps native thrown values in SdkNativeEventException.';
 const rationale='The getter dispatch uses the same native receiver. Asynchronous timing, explicit release, wrapper type, error metadata side effects and canonical NaN representation are reviewed adaptations; IEEE-754 NaN payload bits are not preserved.';
 const scope=strict.scope;
 const verification={baselineId:BASE,libSha256:libFingerprint.sha256,scope,sourceReview:{variant:'sdk-event-getter-native-handle',contract:id,dartMember:member,scope,rowSourceHash:ROWS[id],sdkBodySha256:BODIES[id],dartFileSha256:libFingerprint.files[file],strictReview:strict.sourceReview,dimensions:[...dimensions],adaptation:{native,dart,rationale},limitations:strict.limitations},platforms:Object.fromEntries(platforms.map(p=>[p,Object.fromEntries(dimensions.map(d=>[d,[observations[p].id]]))]))};
 return {observations,verification};
}
function prepare({rows,manifest,runtime,libFingerprint,root}){
 if(!rowsMatch(rows)||manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK)||!libFingerprint?.files?.[file])return null;
 const strict=verifySdkEventGetterDomainAdaptations({runtime,manifest,libFingerprint,root});if(strict.issues?.length||!same(Object.keys(strict.byContract).sort(),[...sdkEventGetterContracts].sort()))return null;
 if(!sdkEventGetterContracts.every(id=>strict.byContract[id]?.status==='reviewed-adaptation'&&strict.byContract[id].contract===id&&platforms.every(p=>strict.byContract[id].platforms?.[p])))return null;
 return Object.fromEntries(sdkEventGetterContracts.map(id=>[id,build(id,libFingerprint,strict.byContract[id])]));
}
/** Mutates exactly the two eligible rows atomically, only after strict live
 * evidence is validated. Returns new report observations; caller appends them. */
export function applySdkEventGetterContractProof({rows,manifest,runtime,libFingerprint,root=ROOT}){
 try{const prepared=prepare({rows,manifest,runtime,libFingerprint,root});if(!prepared)return [];
  const targets=sdkEventGetterContracts.map(id=>rows.find(r=>r.id===id));if(targets.some(r=>r.status!=='candidate-unverified'||r.verification!=null||r.proofProblems?.length||!same(r.platforms,Object.fromEntries(platforms.map(p=>[p,'candidate-unverified'])))||!['status','proofProblems','platforms','verification'].every(k=>writable(r,k))))return [];
  for(const row of targets){const proof=prepared[row.id];row.status='reviewed-adaptation';row.proofProblems=[];row.platforms=Object.fromEntries(platforms.map(p=>[p,'verified']));row.verification=proof.verification;}
  return sdkEventGetterContracts.flatMap(id=>platforms.map(p=>prepared[id].observations[p]));
 }catch{return [];}
}
/** Call once per synchronous report snapshot. Never retain this result after
 * mutating report, its observations, evidence, or input files. */
export function validSdkEventGetterContractProofs(report,{root=ROOT}={}){
 try{if(report?.baselineId!==BASE||report.sdkSha256!==SDK)return Object.freeze({});
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tool/sdk_audit/baselines/2026-11-17-production.json'),'utf8'));
  const runtime={platformEvidence:report.platformEvidence};const prepared=prepare({rows:report.rows,manifest,runtime,libFingerprint:report.libFingerprint,root});if(!prepared)return Object.freeze({});
  const obs=new Map();for(const item of report.observations||[]){if(obs.has(item.id))obs.set(item.id,null);else obs.set(item.id,item);}
  for(const id of sdkEventGetterContracts){const row=report.rows.find(r=>r.id===id),p=prepared[id];if(row.status!=='reviewed-adaptation'||!same(row.proofProblems,[])||!same(row.verification,p.verification)||!same(row.platforms,Object.fromEntries(platforms.map(q=>[q,'verified'])))||!platforms.every(q=>same(obs.get(p.observations[q].id),p.observations[q])))return Object.freeze({});}
  return Object.freeze(Object.fromEntries(sdkEventGetterContracts.map(id=>[id,true])));
 }catch{return Object.freeze({});}
}
