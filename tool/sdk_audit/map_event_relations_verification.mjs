import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {collectNativeEventInvocationObservations} from './native_event_invocation_verification.mjs';
import {collectNativeSdkEventsObservations} from './native_sdk_events_verification.mjs';
import {collectSdkNativeStartupInvocationObservations} from './sdk_native_startup_invocation_verification.mjs';
import {collectTrustedInputObservations} from './trusted_input_verification.mjs';
import {collectSdkDefaultPolicyTrustedObservations} from './sdk_default_policy_trusted_verification.mjs';
import {verifySdkEventGetterDomainAdaptations} from './sdk_event_getter_domain_strict_verification.mjs';
import {collectSdkRawThrownValueObservations} from './sdk_raw_thrown_value_verification.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW='docs/sdk-audit/reviews/map-event-relations-source-review.json';
const REVIEW_SHA='04735f1977104eba88dc44d92dd52e3381d7473307b1bf6ebd51a46995719976';
const ids={'Tmapv3.Map#on':'U111-5ab3d1cbc9c081a8','Tmapv3.Map#on:argument[0]':'U111-17c99ab19eef294e','Tmapv3.Map#on:argument[1]':'U111-d87e38779e48eebb','Vsm.Map#on':'U111-bc9102aa09f6a537','Vsm.Event':'U111-55bb12f2e7fa09aa','Vsm.Event#name':'U111-b2970a75a65c1412','Vsm.Event#data':'U111-31755177069aea60'};
const fail=x=>{throw Error(x);};
function read(root,file,digest){const full=path.resolve(root,file),base=fs.realpathSync(root)+path.sep;if(path.isAbsolute(file)||!full.startsWith(path.resolve(root)+path.sep)||!fs.realpathSync(full).startsWith(base))fail('reference path');const b=fs.readFileSync(full);if(sha(b)!==digest)fail('reference digest: '+file);return b;}
/** Validates source identities and the 29 inventory entries, without changing a ledger row. */
export function verifyMapEventRelationSources({root=ROOT,manifest}={}){
 const review=JSON.parse(read(root,REVIEW,REVIEW_SHA));
 if(manifest?.id!==BASE||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||review.status!=='SOURCE_REVIEW_ONLY_OBSERVATIONS_PENDING_OPEN')fail('source review baseline');
 const sdkFile=`tool/sdk_audit/.cache/sources/${SDK}`;if(!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===SDK))fail('SDK absent from baseline');const sdk=read(root,sdkFile,SDK).toString('utf8');
 const spans=[['emitter',41190,43817],['emitterExport',344207,344215],['engineOnEmit',708798,709007],['wrapperOn',1261195,1261703],['wrapperOff',1261704,1261994],['wrapperSpecialDispatch',1278792,1279173]];
 if(!Array.isArray(review.sdkSources)||review.sdkSources.length!==spans.length)fail('SDK spans');for(const [i,[name,start,end]] of spans.entries()){const x=review.sdkSources[i];if(x.name!==name||x.file!==sdkFile||x.start!==start||x.end!==end||sha(sdk.slice(start,end))!==x.sha256)fail('SDK span: '+name);}
 const examples=review.officialExamples,rows=JSON.parse(fs.readFileSync(path.join(root,'docs/sdk-audit/latest/docs.json'))).rows.filter(r=>r.id==='Tmapv3.Map#on');
 if(examples.count!==29||!Array.isArray(examples.rows)||examples.rows.length!==29||!same(rows,examples.rows))fail('29 documentation evidence entries');
 const sources=[...new Set(rows.flatMap(r=>r.evidence.map(e=>e.sha256)))];if(sources.length!==8||!same(sources,examples.sourceDigests))fail('example source set');
 for(const row of rows){if(row.kind!=='method'||row.owner!=='Tmapv3.Map'||row.name!=='on'||row.evidence?.length!==1)fail('example row');const e=row.evidence[0];if(e.channel!=='example'||!Number.isInteger(e.line)||e.line<1||!Number.isInteger(e.codeStart)||!Number.isInteger(e.codeEnd)||e.codeStart<0||e.codeEnd<=e.codeStart||!manifest.sources.some(s=>s.sha256===e.sha256&&(s.url===e.source||s.finalURL===e.source)))fail('example evidence');}
 for(const digest of sources)read(root,`tool/sdk_audit/.cache/sources/${digest}`,digest);
 if(!same(review.ledgerRelations.map(x=>[x.contract,x.rowId]),Object.entries(ids).slice(0,5)))fail('ledger mapping');
 return {review:{file:REVIEW,sha256:REVIEW_SHA},exampleEntries:29,exampleSources:8};
}
/** Group evidence only after each existing collector verifies its own current run.
 * This function cannot alter rows or promote any contract. Missing proof produces
 * an issue and does not lend another facet its scope. */
export function collectMapEventRelations({runtime,manifest,libFingerprint,root=ROOT}={}){
 let source;try{source=verifyMapEventRelationSources({root,manifest});}catch(error){return {byContract:{},issues:[{code:'map-event-relation-source-rejected',reason:String(error.message)}]};}
 const args={runtime,manifest,libFingerprint,root},byContract={},issues=[];
 const groups=[
  ['native-invocation',collectNativeEventInvocationObservations,['Tmapv3.Map#on','Vsm.Map#on']],
  ['native-event-identity',collectNativeSdkEventsObservations,['Tmapv3.Map#on','Vsm.Event']],
  ['startup-invocation',collectSdkNativeStartupInvocationObservations,['Vsm.Map#on']],
  ['trusted-map-drag',collectTrustedInputObservations,['Tmapv3.Map#on']],
  ['trusted-default-policy',collectSdkDefaultPolicyTrustedObservations,['Vsm.Map#on']],
  ['raw-thrown-value',collectSdkRawThrownValueObservations,['Tmapv3.Map#on']],
  ['getter-domain-adaptation',verifySdkEventGetterDomainAdaptations,['Vsm.Event#name','Vsm.Event#data']],
 ];
 for(const [name,collect,contracts] of groups){
  let result;try{result=collect(args);}catch(error){issues.push({code:'map-event-relation-dependency-rejected',dependency:name,reason:String(error.message)});continue;}
  if(result.issues?.length||!result.byContract){issues.push({code:'map-event-relation-dependency-rejected',dependency:name,details:result.issues});continue;}
  for(const contract of contracts){const evidence=result.byContract[contract],expected=name==='getter-domain-adaptation'?'reviewed-adaptation':'observed-not-verified';
   if(evidence?.status!==expected||!['android','ios','web'].every(p=>evidence.platforms?.[p])){issues.push({code:'map-event-relation-dependency-missing',dependency:name,contract});continue;}
   const entry=byContract[contract]??={rowId:ids[contract],status:'observed-not-verified',sourceReview:source.review,groups:{}};entry.groups[name]=evidence;
  }
 }
 return {byContract,issues,sourceContext:source,limitations:['Each group retains its own scope and validated three-platform current-run provenance. These groups are not a proof of complete API parity or a status promotion.','The 29 documentation entries belong to one Map.on contract; input and callback argument rows remain separate and no claim is made that they are complete.','Native synchronous callback behavior differs from asynchronous Dart delivery; selected trusted automated input is not human physical input.','Getter name/data reviewed adaptation remains strictly limited to those accessors. No evt.target ledger row is invented.']};
}
