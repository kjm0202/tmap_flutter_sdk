// Integrator opt-in. Exact 17 rows are promoted atomically only after the
// source- and fresh-run-bound Html adaptation verifier succeeds.
import {isDeepStrictEqual as same,types} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,sha} from './common.mjs';
import {verifySdkHtmlNativeAdaptations} from './sdk_html_native_adaptation_verification.mjs';
const methods=['getElement','getElementLeft','getElementTop','getElementWidth','getElementHeight','getElementBounds','getElementPosition','getVisible','onMoveHandler'];
export const htmlNativeAdaptationContracts=Object.freeze(methods.flatMap(n=>n==='onMoveHandler'?[`Tmapv3.base.Html#${n}`]:[`Tmapv3.base.Html#${n}`,`Tmapv3.base.Html#${n}->return`]));
const platforms=['web','android','ios'],dimensions=['inputs-defaults','returns-types','mutation-identity','errors','lifecycle-events','dispatch'];
const member='SdkHtmlNative.callNative',file='lib/src/models/sdk_html_native.dart',signature='Future<Object?> callNative(String method, [List<Object?> args = const []])';
function candidate(row){
 const c=row.dartCandidates;
 return Array.isArray(c)&&c.length===1&&c[0].id===member&&c[0].file===file&&c[0].signature===signature&&Number.isInteger(c[0].line)&&c[0].line>0;
}
function writable(row,key){const d=Object.getOwnPropertyDescriptor(row,key);return d?Object.hasOwn(d,'value')&&d.writable===true:Object.isExtensible(row);}
function write(row,key,value){if(Object.hasOwn(row,key))row[key]=value;else Object.defineProperty(row,key,{value,writable:true,configurable:true,enumerable:true});}
function prepare(input){
 const strict=verifySdkHtmlNativeAdaptations(input);if(strict.issues.length||!same(Object.keys(strict.byContract),htmlNativeAdaptationContracts))return null;
 if(!htmlNativeAdaptationContracts.every(id=>strict.byContract[id]?.status==='reviewed-adaptation'&&platforms.every(p=>strict.byContract[id].platforms?.[p])))return null;
 const result={};for(const id of htmlNativeAdaptationContracts){const entry=strict.byContract[id],observations={};
  for(const p of platforms){const platform=entry.platforms[p];observations[p]={id:`sdk-html-native-adaptation:${p}:${id}`,contract:id,dartMember:member,platform:p,status:'adaptation-match',dimensions:[...dimensions],count:1,actualSha256:sha(JSON.stringify(platform)),platformLog:platform.log};}
  result[id]={observations,verification:{baselineId:entry.baselineId,libSha256:entry.libFingerprintSha256,scope:entry.scope,sourceReview:{variant:'sdk-html-native-call',contract:id,dartMember:member,scope:entry.scope,strictReview:entry.sourceReview,adaptation:entry.adaptation,limitations:entry.adaptation.limitations},platforms:Object.fromEntries(platforms.map(p=>[p,Object.fromEntries(dimensions.map(d=>[d,[observations[p].id]]))]))}};
 }return result;
}
export function applySdkHtmlNativeContractProof({rows,manifest,runtime,libFingerprint,root=ROOT}){
 try{const prepared=prepare({rows,manifest,runtime,libFingerprint,root});if(!prepared)return [];
  const targets=htmlNativeAdaptationContracts.map(id=>rows.find(r=>r.id===id));
  if(targets.some(r=>types.isProxy(r)||!candidate(r)||r.status!=='candidate-unverified'||r.verification!=null||r.proofProblems?.length||!same(r.platforms,Object.fromEntries(platforms.map(p=>[p,'candidate-unverified'])))||!['status','proofProblems','platforms','verification'].every(k=>writable(r,k))))return [];
  for(const row of targets){write(row,'status','reviewed-adaptation');write(row,'proofProblems',[]);write(row,'platforms',Object.fromEntries(platforms.map(p=>[p,'verified'])));write(row,'verification',prepared[row.id].verification);}
  return htmlNativeAdaptationContracts.flatMap(id=>platforms.map(p=>prepared[id].observations[p]));
 }catch{return [];}
}
export function validSdkHtmlNativeContractProofs(report,{root=ROOT}={}){
 try {
  if(report?.baselineId!=='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714'||report.sdkSha256!=='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e')return Object.freeze({});
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tool/sdk_audit/baselines/2026-11-17-production.json'),'utf8'));
  const prepared=prepare({rows:report.rows,manifest,runtime:{platformEvidence:report.platformEvidence},libFingerprint:report.libFingerprint,root});
  if(!prepared)return Object.freeze({});
  const seen=new Map();for(const item of report.observations||[]){if(seen.has(item.id))seen.set(item.id,null);else seen.set(item.id,item);}
  for(const id of htmlNativeAdaptationContracts){const row=report.rows.find(r=>r.id===id),p=prepared[id];
   if(!candidate(row)||row.status!=='reviewed-adaptation'||!same(row.proofProblems,[])||!same(row.verification,p.verification)||!same(row.platforms,Object.fromEntries(platforms.map(q=>[q,'verified'])))||!platforms.every(q=>same(seen.get(p.observations[q].id),p.observations[q])))return Object.freeze({});
  }
  return Object.freeze(Object.fromEntries(htmlNativeAdaptationContracts.map(id=>[id,true])));
 }catch{return Object.freeze({});}
}
