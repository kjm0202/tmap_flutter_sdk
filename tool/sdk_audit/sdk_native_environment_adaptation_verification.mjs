// Strict evidence gate only; this module never modifies audit rows.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {nativeEnvironmentRelationContracts,verifySdkNativeEnvironmentRelationCandidates} from './sdk_native_environment_relation_verification.mjs';
import {collectSdkNativeEnvironmentObservations} from './sdk_native_environment_observations.mjs';
import {verifySdkHtmlNativeAdaptations} from './sdk_html_native_adaptation_verification.mjs';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714',SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW='docs/sdk-audit/reviews/sdk-native-environment-adaptation-review.json',REVIEW_SHA='59715298d906fd1866da2f1358d01ff45fe2618938129758b7e6ea7249b57de8';
const fail=x=>{throw Error(x);};
function load(root,file,digest){if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid path');const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('digest '+file);return b;}
const file='lib/src/models/sdk_native_environment.dart',handleFile='lib/src/models/sdk_native_events.dart';
const entry=(id,signature,composedPath,extra={})=>({id,file,signature,composedPath,...extra});
function binding(id){
 if(id.startsWith('Tmapv3.base.Config.getResolution'))return entry('SdkNativeEnvironment.resolution','Future<Object?> resolution([List<Object?> args = const []])',['Tmapv3','base','Config','getResolution','call']);
 if(id.startsWith('Tmapv3.base.Config.getMaxExtent'))return entry('SdkNativeEnvironment.maxExtent','Future<Object?> maxExtent([List<Object?> args = const []])',['Tmapv3','base','Config','getMaxExtent','call']);
 if(id.startsWith('Vsm.Extensions.TmapUtils.POI_SCALE')){const parts=id.split('.').slice(4),base=['Vsm','Extensions','TmapUtils','POI_SCALE'];if(!parts.length)return entry('SdkNativeEnvironment.poiScales','Future<Object?> poiScales',base);if(parts.length===1)return entry('SdkNativeEnvironment.poiPreset','Future<Object?> poiPreset(SdkNativePoiPreset preset)',[...base,...parts]);return {id:'SdkNativeEnvironment.poiField',file,signature:'Future<Object?> poiField(String preset, Object field)',composedPath:[...base,...parts],via:{id:'SdkNativeEvents.getValueProperty',file:handleFile,signature:'Future<Object?> getValueProperty(Object? value, Object property)',preset:parts[0],property:parts[1]}};}
 if(id.startsWith('Vsm.Map.AdditionalFuncNames')){const v=id.split('.').slice(3);return v.length?entry('SdkNativeEnvironment.debugName','Future<Object?> debugName(SdkNativeDebugFeature feature)',['Vsm','Map','AdditionalFuncNames',...v]):entry('SdkNativeEnvironment.debugFeatures','Future<Object?> debugFeatures',['Vsm','Map','AdditionalFuncNames']);}
 if(id.startsWith('Vsm.Map.ControlDockNames')){const v=id.split('.').slice(3);return v.length?entry('SdkNativeEnvironment.dockName','Future<Object?> dockName(SdkNativeControlDock dock)',['Vsm','Map','ControlDockNames',...v]):entry('SdkNativeEnvironment.controlDocks','Future<Object?> controlDocks',['Vsm','Map','ControlDockNames']);}
 fail('unknown contract');
}
export const nativeEnvironmentAdaptationExcludedContracts=Object.freeze([]);
export const nativeEnvironmentAdaptationContracts=Object.freeze([...nativeEnvironmentRelationContracts]);
export const nativeEnvironmentAdaptationBindings=Object.freeze(Object.fromEntries(nativeEnvironmentRelationContracts.map(id=>[id,binding(id)])));
function references(root){
 const r=JSON.parse(load(root,REVIEW,REVIEW_SHA));
 if(r.status!=='NATIVE_ENVIRONMENT_ADAPTATION_PENDING_INDEPENDENT_REVIEW_AND_FRESH_RUNS'||r.baselineId!==BASE||r.sdkSha256!==SDK||r.offsetUnit!=='UTF-16'||!same(r.bindings,nativeEnvironmentAdaptationBindings)||!same(r.eligible,nativeEnvironmentAdaptationContracts)||!same(r.excluded.map(x=>x.id),nativeEnvironmentAdaptationExcludedContracts)||!r.adaptation?.native||!r.adaptation?.dart||!r.adaptation?.rationale||!Array.isArray(r.adaptation.limitations)||r.adaptation.limitations.length<8)fail('review metadata');
 if(r.valuePropertyBoundary?.test!=='test/sdk_native_environment_value_property_test.dart'||r.valuePropertyBoundary?.regression!=='test/sdk_native_environment_primitive_field_test.dart')fail('value property tests');
 load(root,r.valuePropertyBoundary.test,r.valuePropertyBoundary.testSha256);load(root,r.valuePropertyBoundary.regression,r.valuePropertyBoundary.regressionSha256);if(r.valuePropertyBoundary.configMethodTest!=='test/sdk_native_environment_config_primitive_call_test.dart')fail('config method test');load(root,r.valuePropertyBoundary.configMethodTest,r.valuePropertyBoundary.configMethodTestSha256);
 const deps={relationVerifier:'tool/sdk_audit/sdk_native_environment_relation_verification.mjs',relationReview:'docs/sdk-audit/reviews/sdk-native-environment-relation-review.json',readonlyCollector:'tool/sdk_audit/sdk_native_environment_observations.mjs',readonlyReview:'docs/sdk-audit/reviews/sdk-native-environment-source-review.json',htmlVerifier:'tool/sdk_audit/sdk_html_native_adaptation_verification.mjs',htmlReview:'docs/sdk-audit/reviews/sdk-html-native-adaptation-review.json',bridgeJs:'lib/src/js/js_native_events.dart',bridgeDart:'lib/src/models/sdk_native_events.dart',valueGetNodeTest:'test/sdk_value_property_bridge_test.mjs',valueGetDartTest:'test/sdk_value_property_test.dart',valuePropertyReview:'docs/sdk-audit/reviews/sdk-native-environment-value-property-review.json'};
 for(const [key,path] of Object.entries(deps)){if(r.dependencies?.[key]!==path)fail('dependency path');load(root,path,r.dependencies[key+'Sha256']);}
 const valueReview=JSON.parse(load(root,deps.valuePropertyReview,r.dependencies.valuePropertyReviewSha256));
 if(valueReview.status!=='OPEN'||valueReview.baselineId!==BASE||valueReview.sdkSha256!==SDK||valueReview.offsetUnit!=='UTF-16'||!same(valueReview.bridgeSources?.map(x=>x.id),['valueGet','valueCall']))fail('value-property review');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8'),span=valueReview.sdkSource;
 if(span?.start!==725895||span.end!==727915||sha(sdk.slice(span.start,span.end))!==span.sha256)fail('value-property SDK span');
 const bridge=load(root,deps.bridgeJs,r.dependencies.bridgeJsSha256).toString('utf8');
 for(const x of valueReview.bridgeSources)if(x.file!==deps.bridgeJs||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||bridge.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sha256)fail('value-property bridge span');
 const expectedFiles=['lib/src/models/sdk_native_environment.dart','lib/src/models/sdk_native_events.dart','lib/src/js/js_native_events.dart','example/integration_test/sdk_native_environment_relation_fixture.dart','example/integration_test/sdk_native_environment_relation_contracts.dart','test/sdk_native_environment_value_property_test.dart','test/sdk_native_environment_config_primitive_call_test.dart','test/sdk_native_environment_primitive_field_test.dart','test/sdk_value_property_bridge_test.mjs','test/sdk_value_property_test.dart'];
 if(!same(valueReview.files?.map(x=>x.file),expectedFiles))fail('value-property file set');for(const x of valueReview.files)load(root,x.file,x.sha256);
 return r;
}
/** Requires both native-environment observation groups and Html codec evidence. */
export function verifySdkNativeEnvironmentAdaptations({rows,runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline');
  const review=references(root),relation=verifySdkNativeEnvironmentRelationCandidates({rows,runtime,manifest,libFingerprint,root});
  if(relation.issues.length||!same(Object.keys(relation.candidates).sort(),[...nativeEnvironmentRelationContracts].sort())||!nativeEnvironmentRelationContracts.every(id=>relation.candidates[id]?.status==='candidate-not-promoted'))fail('102-row relation gate');
  const readonly=collectSdkNativeEnvironmentObservations({runtime,manifest,libFingerprint,root}),item=readonly.observations?.sdkNativeEnvironment;
  if(readonly.issues.length||item?.status!=='observed-not-verified')fail('three-row readonly gate');
  const html=verifySdkHtmlNativeAdaptations({rows,runtime,manifest,libFingerprint,root});
  if(html.issues.length||Object.keys(html.byContract).length!==17||!Object.values(html.byContract).every(x=>x.status==='reviewed-adaptation'))fail('common Html codec gate');
  const platforms=['web','android','ios'];
  if(!platforms.every(p=>relation.candidates[nativeEnvironmentAdaptationContracts[0]].platforms?.[p]&&item.platforms?.[p]&&html.byContract['Tmapv3.base.Html#getElement']?.platforms?.[p]))fail('missing platform');
  const byContract=Object.fromEntries(nativeEnvironmentAdaptationContracts.map(id=>[id,{
   status:'reviewed-adaptation',contract:id,auditId:relation.candidates[id].auditId,binding:review.bindings[id],baselineId:BASE,libFingerprintSha256:libFingerprint.sha256,
   scope:'Original native Config call or live property lookup through asynchronous handle transport, with explicit timing, exception, copy and lifetime adaptations; no initial-constant freeze or device SDK-byte claim.',
   sourceReview:{file:REVIEW,sha256:REVIEW_SHA},adaptation:review.adaptation,
   platforms:Object.fromEntries(platforms.map(p=>[p,{relation:relation.candidates[id].platforms[p],readonly:item.platforms[p],codec:html.byContract['Tmapv3.base.Html#getElement'].platforms[p]}]))
  }]));
  return {byContract,issues:[]};
 }catch(e){return {byContract:{},issues:[{code:'sdk-native-environment-adaptation-rejected',reason:String(e.message)}]};}
}
