import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same,types} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {verifySdkNativeEnvironmentAdaptations,nativeEnvironmentAdaptationContracts,nativeEnvironmentAdaptationBindings} from './sdk_native_environment_adaptation_verification.mjs';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714',SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const platforms=['web','android','ios'];
const dimensions=['inputs-defaults','returns-types','mutation-identity','errors','lifecycle-events','dispatch'];
function ownData(value,key){const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value');}
export function nativeEnvironmentCandidateMatches(row){
 if(!row||typeof row!=='object'||types.isProxy(row)||!ownData(row,'id')||!ownData(row,'dartCandidates'))return false;
 const c=row.dartCandidates,b=nativeEnvironmentAdaptationBindings[row.id];
 if(!b||!Array.isArray(c)||types.isProxy(c)||c.length!==1||!ownData(c,'0')||!c[0]||types.isProxy(c[0]))return false;
 if(!['file','id','line','signature'].every(key=>ownData(c[0],key)))return false;
 const keys=Object.keys(c[0]).sort();
 if(!same(keys,['file','id','line','signature'])&&!same(keys,['file','id','inheritedFrom','line','signature']))return false;
 if(Object.hasOwn(c[0],'inheritedFrom')&&(!ownData(c[0],'inheritedFrom')||c[0].inheritedFrom!==undefined))return false;
 return c[0].id===b.id&&c[0].file===b.file&&c[0].signature===b.signature&&Number.isSafeInteger(c[0].line)&&c[0].line>0;
}
function writable(row,key){const d=Object.getOwnPropertyDescriptor(row,key);return d?Object.hasOwn(d,'value')&&d.writable===true:Object.isExtensible(row);}
function write(row,key,value){if(Object.hasOwn(row,key))row[key]=value;else Object.defineProperty(row,key,{value,writable:true,configurable:true,enumerable:true});}
function prepare(input){
 const gate=verifySdkNativeEnvironmentAdaptations(input);
 if(gate.issues.length||!same(Object.keys(gate.byContract).sort(),[...nativeEnvironmentAdaptationContracts].sort()))return null;
 const prepared={};for(const id of nativeEnvironmentAdaptationContracts){
  const entry=gate.byContract[id],member=nativeEnvironmentAdaptationBindings[id].id;
  if(entry?.status!=='reviewed-adaptation'||!same(entry.binding,nativeEnvironmentAdaptationBindings[id])||!platforms.every(p=>entry.platforms?.[p]))return null;
  const observations=Object.fromEntries(platforms.map(platform=>[platform,{
   id:`sdk-native-environment-adaptation:${platform}:${id}`,contract:id,dartMember:member,platform,status:'adaptation-match',dimensions:[...dimensions],count:1,
   actualSha256:sha(JSON.stringify(entry.platforms[platform])),platformLog:entry.platforms[platform].relation.log
  }]));
  prepared[id]={observations,verification:{baselineId:BASE,libSha256:entry.libFingerprintSha256,scope:entry.scope,
   sourceReview:{variant:'sdk-native-environment-live-relation',contract:id,dartMember:member,scope:entry.scope,strictReview:entry.sourceReview,
    binding:entry.binding,adaptation:entry.adaptation,limitations:entry.adaptation.limitations},
   platforms:Object.fromEntries(platforms.map(p=>[p,Object.fromEntries(dimensions.map(d=>[d,[observations[p].id]]))]))}};
 }
 return prepared;
}
function targetRows(rows){
 if(!Array.isArray(rows)||types.isProxy(rows))return null;
 for(let i=0;i<rows.length;i++){const d=Object.getOwnPropertyDescriptor(rows,String(i)),row=d?.value;if(!d||!Object.hasOwn(d,'value')||!row||typeof row!=='object'||types.isProxy(row)||!ownData(row,'id'))return null;}
 if(new Set(rows.map(row=>row.id)).size!==rows.length)return null;
 const targets=nativeEnvironmentAdaptationContracts.map(id=>rows.find(row=>row.id===id));
 if(targets.some(row=>!row||!['status','platforms'].every(key=>ownData(row,key))||(Object.hasOwn(row,'proofProblems')&&!ownData(row,'proofProblems'))||(Object.hasOwn(row,'verification')&&!ownData(row,'verification'))||!nativeEnvironmentCandidateMatches(row)||row.status!=='candidate-unverified'||row.verification!=null||(row.proofProblems!==undefined&&(!Array.isArray(row.proofProblems)||types.isProxy(row.proofProblems)||row.proofProblems.length!==0))||!row.platforms||typeof row.platforms!=='object'||types.isProxy(row.platforms)||!same(Object.keys(row.platforms).sort(),['android','ios','web'])||!platforms.every(key=>ownData(row.platforms,key))||!same(row.platforms,Object.fromEntries(platforms.map(p=>[p,'candidate-unverified'])))||!['status','proofProblems','platforms','verification'].every(key=>writable(row,key))))return null;
 return targets;
}
/** Validates mutable target shape only; this does not establish evidence. */
export function nativeEnvironmentProofTargetsReady(rows){try{return targetRows(rows)!==null;}catch{return false;}}
/** All 29 rows are validated before any write. No parent API is promoted. */
export function applySdkNativeEnvironmentContractProof(input){
 try{
  const targets=targetRows(input?.rows);if(!targets)return [];
  const prepared=prepare(input);if(!prepared)return [];
  // Recheck after the gate reads all upstream source and row metadata.
  if(targetRows(input.rows)===null)return [];
  const keys=['status','proofProblems','platforms','verification'];
  const snapshots=targets.map(row=>({row,descriptors:Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(row,k)]))}));
  try {
   for(const row of targets){write(row,'status','reviewed-adaptation');write(row,'proofProblems',[]);write(row,'platforms',Object.fromEntries(platforms.map(p=>[p,'verified'])));write(row,'verification',prepared[row.id].verification);}
  } catch (error) {
   for(const {row,descriptors} of snapshots.reverse())for(const key of keys){const descriptor=descriptors[key];if(descriptor)Object.defineProperty(row,key,descriptor);else Reflect.deleteProperty(row,key);}
   throw error;
  }
  return nativeEnvironmentAdaptationContracts.flatMap(id=>platforms.map(p=>prepared[id].observations[p]));
 }catch{return [];}
}
/** Revalidate all source, runtime records and every observation before trust. */
export function validSdkNativeEnvironmentContractProofs(report,{root=ROOT}={}){
 try{
  if(report?.baselineId!==BASE||report.sdkSha256!==SDK)return Object.freeze({});
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tool/sdk_audit/baselines/2026-11-17-production.json')));
  const prepared=prepare({rows:report.rows,manifest,runtime:{platformEvidence:report.platformEvidence},libFingerprint:report.libFingerprint,root});if(!prepared)return Object.freeze({});
  const seen=new Map();for(const item of report.observations||[])seen.set(item.id,seen.has(item.id)?null:item);
  for(const id of nativeEnvironmentAdaptationContracts){
   const row=report.rows.find(r=>r.id===id),p=prepared[id];
   if(!nativeEnvironmentCandidateMatches(row)||row.status!=='reviewed-adaptation'||!same(row.proofProblems,[])||!same(row.verification,p.verification)||!same(row.platforms,Object.fromEntries(platforms.map(x=>[x,'verified'])))||!platforms.every(x=>same(seen.get(p.observations[x].id),p.observations[x])))return Object.freeze({});
  }
  return Object.freeze(Object.fromEntries(nativeEnvironmentAdaptationContracts.map(id=>[id,true])));
 }catch{return Object.freeze({});}
}
