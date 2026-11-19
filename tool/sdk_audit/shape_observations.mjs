import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {ROOT, sha} from './common.mjs';

// These observations are intentionally limited to the exact reviewed fixture.
// Updating the fixture or SDK requires a new source review and test binding.
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASELINE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const FIXTURE='example/integration_test/shape_setter_contracts.dart';
const FIXTURE_SHA='de7f0f45fe96f94ebbadf431ddf0cf18daec8b7e4b5774e7b9017cca282ff731';
const METHODS={
 'Tmapv3.shape.Circle#setRadius':[907460,907607,'3eda379272ef29e0795bcfc451601e8cac9febb83427447d90b223e99423abd1'],
 'Tmapv3.shape.Circle#setCenter':[907262,907329,'cb4f12ab06d26a916fea6b2e688d77e7dc5166cbb713d23518f72851efc7c411'],
 'Tmapv3.shape.Circle#setVisible':[907608,907741,'fd8ff7cabdfec3b20522dd33e0f78e794a4fee9fc5a618bb6f54891d69681fbb'],
 'Tmapv3.shape.Polygon#setVisible':[923006,923160,'d32e1f004e3fad4091dff039350fa24bfc94363d160c4bfdc8e100d3b66f2b61'],
 'Tmapv3.shape.Polyline#setVisible':[918977,919064,'0c72b842484aa7ddd651a3bac941a639c1152bd7ce0cfc3aa90a38d837f3584f'],
 'Tmapv3.shape.Rectangle#setVisible':[911977,912110,'efa29ed742a2252ef423c82bd7bf277ebb371ea5f122d44ac08e077bf2edb2da'],
};
function fixtureCases(){
 const a=[],add=(kind,method,name,input)=>a.push({id:`shape-setter:${kind}.${method}:${name}`,contract:`Tmapv3.shape.${kind}#${method}`,case:name,input});
 for(const [name,radius,negativeZero] of [['forty',40,false],['forty-repeat',40,false],['zero',0,false],['negative',-5,false],['fractional',0.25,false],['negative-zero',-0,true]])add('Circle','setRadius',name,{radius,negativeZero});
 for(const [name,latitude,longitude] of [['different',37.5667,126.9782],['same-value-new-object',37.5667,126.9782],['zero',0,0],['negative',-10,-20]])add('Circle','setCenter',name,{latitude,longitude});
 add('Circle','setCenter','null-dart-type-boundary',null);add('Circle','setRadius','null-dart-type-boundary',null);
 for(const kind of ['Circle','Polygon','Polyline','Rectangle']){
  for(const [name,value] of [['hide',false],['hide-repeat',false],['show',true],['show-repeat',true]])add(kind,'setVisible',name,value);
  add(kind,'setVisible','null-dart-type-boundary',null);
 }
 add('Circle','setCenter','missing-id',{id:'shape-contract-missing'});add('Circle','setRadius','missing-id',{id:'shape-contract-missing'});
 for(const kind of ['Circle','Polygon','Polyline','Rectangle'])add(kind,'setVisible','missing-id',{id:'shape-contract-missing'});
 return a;
}
const CASES=fixtureCases();
const BINDING=Object.freeze({baselineId:BASELINE,sdkSha256:SDK,fixtureFile:FIXTURE,fixtureSha256:FIXTURE_SHA,methods:METHODS,cases:CASES});
const PLATFORMS=['android','ios','web'];
function fail(reason){throw new Error(reason);}
function within(root,file){
 if(typeof file!=='string'||path.isAbsolute(file))fail('invalid relative evidence path');
 const target=path.resolve(root,file),base=path.resolve(root)+path.sep;
 if(!target.startsWith(base))fail('evidence path leaves root');
 const real=fs.realpathSync(target);if(!real.startsWith(fs.realpathSync(root)+path.sep))fail('evidence realpath leaves root');
 return target;
}
function contents(root,file,digest){const b=fs.readFileSync(within(root,file));if(sha(b)!==digest)fail('source or evidence hash mismatch: '+file);return b.toString('utf8');}
function libFiles(root){
 const found=[];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(['node_modules','.dart_tool','.cache'].includes(e.name))continue;
  const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.isFile())found.push(path.relative(root,f));
 }}
 walk(path.join(root,'lib'));return found.sort();
}
function validateSnapshot(snapshot,kind){
 if(!snapshot||typeof snapshot!=='object'||typeof snapshot.redrawTracking!=='boolean')fail('invalid snapshot');
 for(const side of ['port','sdk']){
  const s=snapshot[side];
  if(!s||typeof s.sameReceiver!=='boolean'||typeof s.attached!=='boolean'||!Array.isArray(s.trace)||
    !Object.hasOwn(s,'visible')||!Object.hasOwn(s,'tapCount')||!Object.hasOwn(s,'listenerSetupError')||!Object.hasOwn(s,'redrawCalls'))fail('incomplete '+side+' snapshot');
  if(snapshot.redrawTracking && (!s.redrawCalls||!Number.isInteger(s.redrawCalls.style)||!Number.isInteger(s.redrawCalls.geometry)))fail('incomplete redraw counts');
  if(!snapshot.redrawTracking && s.redrawCalls!==null)fail('unexpected redraw counts');
  if(s.listenerSetupError!==null && (typeof s.listenerSetupError?.name!=='string'||typeof s.listenerSetupError?.message!=='string'||s.tapCount!==null))fail('invalid listener failure observation');
  if(s.listenerSetupError===null && (!Number.isInteger(s.tapCount)||s.tapCount<0))fail('invalid tap count');
  if(kind==='Circle'&&(!Object.hasOwn(s,'center')||typeof s.centerSameReference!=='boolean'||!s.radius||!s.radiusE7))fail('incomplete circle state');
 }
}
const pick=(x,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(x,k)).map(k=>[k,x[k]]));
function summarize(observation,ref){
 const x=observation,p=x.after.port,s=x.after.sdk,bp=x.before.port,bs=x.before.sdk;
 const method=x.contract.split('#')[1],fields=method==='setRadius'?['radius','radiusE7']:method==='setCenter'?['center','centerSameReference']:['visible'];
 const common={id:x.id,case:x.case,input:x.input,ref,portOutcome:x.portOutcome,nativeDirectOutcome:x.after.directOutcome??x.nativeDirect,
  receiverIdentity:{port:p.sameReceiver,sdk:s.sameReceiver},dispatch:{port:p.trace,sdk:s.trace},redraw:{tracking:x.after.redrawTracking,port:p.redrawCalls,sdk:s.redrawCalls},
  eventSetup:{status:p.listenerSetupError&&s.listenerSetupError&&p.tapCount===null&&s.tapCount===null?'listener-registration-failed-tap-unobserved':'see-bounded-listener-observation',port:p.listenerSetupError,sdk:s.listenerSetupError,tapCounts:{port:p.tapCount,sdk:s.tapCount},windowMs:x.eventWindowMs},
  state:{fields,portBefore:pick(bp,fields),portAfter:pick(p,fields),sdkBefore:pick(bs,fields),sdkAfter:pick(s,fields)}};
 if(x.case==='missing-id')return {...common,kind:'lookup-adapter',nativeDirect:'not-applicable: native methods have no ID argument'};
 if(x.case==='null-dart-type-boundary'){
  const nullTypeError=typeof x.portOutcome?.error==='string'&&/type\s+['"]?Null['"]?\s+is\s+not\s+a\s+subtype\b/i.test(x.portOutcome.error);
  const directNull=s.trace.length===1&&s.trace[0]?.input?.type==='null';
  return {...common,kind:'null-input-probe',comparison:x.portOutcome?.outcome==='threw'&&nullTypeError&&p.trace.length===0&&directNull&&x.after.directOutcome?.outcome==='completed'?'observed-type-boundary-difference':'other-recorded-outcome'};
 }
 const differences=fields.filter(k=>!isDeepStrictEqual(p[k],s[k]));
 const transitions=fields.filter(k=>isDeepStrictEqual(bp[k],p[k])!==isDeepStrictEqual(bs[k],s[k]));
 return {...common,kind:'paired-input-sample',comparison:{methodFieldDifferences:differences,transitionDifferences:transitions,
  redrawComparable:x.after.redrawTracking,redrawEqual:x.after.redrawTracking?isDeepStrictEqual(p.redrawCalls,s.redrawCalls):null,
  bothCompleted:x.portOutcome?.outcome==='completed'&&x.after.directOutcome?.outcome==='completed',
  oneNativeDispatchEach:p.trace.length===1&&s.trace.length===1,
  nativeReturnTypes:{port:p.trace[0]?.return?.type??null,sdk:s.trace[0]?.return?.type??null}}};
}

/**
 * Strict source-bound collector for the six reviewed setter methods. `issues`
 * is nonempty and byContract empty on missing, stale or malformed evidence.
 * This never writes verification dimensions or changes contract status.
 */
export function collectShapeSetterObservations(args){return collectShapeSetterObservationsForFixture(args,BINDING);}

// Exported for hermetic tests with synthetic SDK/fixture bytes; production
// reconciliation must call the fixed-binding wrapper above.
export function collectShapeSetterObservationsForFixture({runtime,manifest,libFingerprint,root=ROOT},binding){
 try {
  if(!runtime?.platformEvidence)fail('platform evidence unavailable');
  const evidence=runtime.platformEvidence;
  if(manifest?.id!==binding.baselineId||!manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===binding.sdkSha256))fail('baseline or SDK source mismatch');
  const sdkFile='tool/sdk_audit/.cache/sources/'+binding.sdkSha256,sdk=contents(root,sdkFile,binding.sdkSha256);
  for(const [contract,[start,end,digest]] of Object.entries(binding.methods))if(sha(sdk.slice(start,end))!==digest)fail('SDK method body changed: '+contract);
  if(!libFingerprint?.files||!libFingerprint.sha256||sha(JSON.stringify(libFingerprint.files))!==libFingerprint.sha256||!isDeepStrictEqual(evidence.libFingerprint,libFingerprint))fail('Flutter fingerprint mismatch');
  const recorded=Object.keys(libFingerprint.files).sort(),current=libFiles(root);
  if(!isDeepStrictEqual(recorded,current))fail('Flutter source file set changed');
  for(const [file,digest] of Object.entries(libFingerprint.files))contents(root,file,digest);
  if(!Array.isArray(evidence.inputs))fail('fixture inputs missing');
  const inputs=new Map();for(const input of evidence.inputs){if(inputs.has(input.file))fail('duplicate fixture input');inputs.set(input.file,input);contents(root,input.file,input.sha256);}
  if(inputs.get(binding.fixtureFile)?.sha256!==binding.fixtureSha256)fail('reviewed shape fixture missing or changed');
  for(const file of ['example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart'])if(!inputs.has(file))fail('platform fixture missing: '+file);
  const integration=(evidence.records||[]).filter(r=>r.kind==='integration');
  if(integration.length!==3||new Set(integration.map(r=>r.platform)).size!==3||PLATFORMS.some(p=>!integration.some(r=>r.platform===p))||new Set(integration.map(r=>r.file)).size!==3)fail('missing or duplicate integration platforms');
  const result={};for(const [contract,[start,end,sourceTextSha256]] of Object.entries(binding.methods))result[contract]={
   status:'observed-not-verified',baselineId:binding.baselineId,source:{file:sdkFile,sourceSha256:binding.sdkSha256,start,end,sourceTextSha256},
   fixture:{file:binding.fixtureFile,sha256:binding.fixtureSha256},libFingerprintSha256:libFingerprint.sha256,
   expectedSdkSha256:binding.sdkSha256,sdkDigestMeasurement:'not measured by helper',platforms:{},
   limitations:['Bounded selected inputs only; no contract verification dimensions are marked passed.','The helper uses two controller-created overlays and temporary method/redraw instrumentation.','Native undefined versus Dart Future<void>, typed null and ID lookup are distinct interfaces.','Tap-event behavior is unverified when listener setup fails.','Platform SDK bytes are not measured by this helper.']};
  for(const rec of integration){
   if(rec.passed!==true||!rec.file?.startsWith('docs/sdk-audit/platform-logs/'))fail('integration run not passed or invalid log');
   const log=contents(root,rec.file,rec.sha256),lines=log.split('\n'),observed=[];
   if(rec.platform==='web'?!log.includes('LIVE RESULT: PASS')||log.includes('LIVE RESULT: FAIL'):!log.includes('All tests passed!')||log.includes('Some tests failed.'))fail('integration log has no successful completion');
   for(let i=0;i<lines.length;i++){const p=lines[i].indexOf('SHAPE SETTER OBSERVATION:');if(p>=0){let data;try{data=JSON.parse(lines[i].slice(p+'SHAPE SETTER OBSERVATION:'.length).trim());}catch{fail('malformed shape observation');}observed.push({data,line:i+1});}}
   if(observed.length!==binding.cases.length||!Array.isArray(rec.shapeSetterResults)||rec.shapeSetterResults.length!==binding.cases.length)fail('missing or duplicate shape observation cases');
   for(let i=0;i<binding.cases.length;i++){
    const expected=binding.cases[i],{data:x,line}=observed[i];
    // Re-serialization of platform evidence normalizes JSON -0 to 0; the
    // separately emitted negativeZero flag remains source-bound and checked.
    if(JSON.stringify(x)!==JSON.stringify(rec.shapeSetterResults[i])||x.id!==expected.id||x.contract!==expected.contract||x.case!==expected.case||!isDeepStrictEqual(x.input,expected.input)||
       x.status!=='observed'||x.expectedSdkSha256!==binding.sdkSha256||x.sdkDigestMeasurement!=='not measured by this helper'||x.eventWindowMs!==40)fail('case identity, input, log or digest claim mismatch');
    const kind=expected.contract.split('.')[2].split('#')[0];validateSnapshot(x.before,kind);validateSnapshot(x.after,kind);
    if(!x.portOutcome||!['completed','threw'].includes(x.portOutcome.outcome)||
       (x.portOutcome.outcome==='threw'&&typeof x.portOutcome.error!=='string'))fail('missing port outcome');
    if(expected.case==='missing-id'){if(x.nativeDirect!=='not-applicable: native method has no ID lookup')fail('invalid lookup adapter observation');}
    else if(!x.after.directOutcome||!['completed','threw'].includes(x.after.directOutcome.outcome))fail('missing native outcome');
    const contract=result[x.contract];if(!contract)fail('unexpected shape contract');
    const platform=contract.platforms[rec.platform]??={log:{file:rec.file,sha256:rec.sha256},cases:[]};
    platform.cases.push(summarize(x,{file:rec.file,sha256:rec.sha256,line,logLineSha256:sha(lines[line-1]),observationSha256:sha(JSON.stringify(x))}));
   }
  }
  return {byContract:result,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'shape-observations-rejected',reason:String(error.message)}]};}
}
