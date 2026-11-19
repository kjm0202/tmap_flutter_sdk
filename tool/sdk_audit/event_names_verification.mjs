import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
// Only the 43 initial named string reads are adapted; the namespace object,
// mutable JS state, event delivery and listener APIs remain separate contracts.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,HERE,sha} from './common.mjs';
import {rowSourceHash} from './scope_reviews.mjs';
import {reviewedEventNamesAliases} from './event_names_aliases.mjs';
import {compareEventNamesObservations} from './event_names_compare.mjs';

const CONFIG_SHA='83fa143176cca0f80e3080d1f47f308bbce385a54b4a1d09473e614477087048';
const names=Object.freeze(['Click','ConfigLoad','ContextLost','ContextMenu','Data','Destroy','DoubleClick','Drag','DragEnd','DragStart','Error','FirstPaint','Idle','LimitOptionsChanged','LongTap','MouseDown','MouseMove','MouseOut','MouseOver','MouseUp','Move','MoveEnd','MoveStart','Pitch','PitchEnd','PitchStart','Render','RenderComplete','Resize','Rotate','RotateEnd','RotateStart','SourceLoad','SourceUpdate','StyleLoad','TouchCancel','TouchEnd','TouchMove','TouchStart','Wheel','Zoom','ZoomEnd','ZoomStart']);
export const eventNameContracts=Object.freeze(names.map(n=>`Tmapv3.event.EventNames.${n}`));
const configPath=path.join(HERE,'event_names_verification.json');
const dimensions=['inputs-defaults','returns-types','mutation-identity','errors','lifecycle-events','dispatch'];
const platforms=['web','android','ios'];
const marker='EVENT NAMES RESULT:';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const safe=p=>typeof p==='string'&&!path.isAbsolute(p)&&!p.split('/').includes('..');
const local=(read,p)=>{if(!safe(p))throw Error('unsafe path');return read(path.join(ROOT,p));};
function config(read){
 const bytes=read(configPath);if(sha(bytes)!==CONFIG_SHA)throw Error('config');
 const c=JSON.parse(bytes.toString());
 if(c.schemaVersion!==1||c.methods.length!==43||!same(c.methods.map(x=>x.id),eventNameContracts)||dimensions.some(d=>!c.dimensions[d]))throw Error('config structure');
 return c;
}
function eligible(row,m){
 return !!row&&row.id===m.id&&row.owner===null&&row.scope==='undocumented-review-required'&&
  same(row.kinds,['property'])&&same(row.sourceNames,m.sourceNames)&&same(row.contracts,[])&&rowSourceHash(row)===m.rowSourceHash;
}
function validCandidate(row,m,allowMissing=false){
 if(!Array.isArray(row.dartCandidates))return false;
 const matches=row.dartCandidates.filter(d=>d.id===m.dart.id);
 return matches.length===0?allowMissing:matches.length===1&&matches[0].file===m.dart.file&&
  matches[0].line===m.dart.line&&matches[0].signature===m.dart.signature;
}
function libraryMatches(lib,read){
 if(!lib?.sha256||!lib.files||sha(JSON.stringify(lib.files))!==lib.sha256)return false;
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(['node_modules','.dart_tool','.cache'].includes(e.name))return [];
  const p=path.join(dir,e.name);return e.isDirectory()?walk(p):e.isFile()?[path.relative(ROOT,p)]:[];
 });
 const names=walk(path.join(ROOT,'lib'));
 return same(Object.keys(lib.files).sort(),names.sort())&&names.every(f=>sha(local(read,f))===lib.files[f]);
}
function sourceProof(c,manifest,rows,read){
 const base=local(read,'tool/sdk_audit/baselines/2026-11-17-production.json');
 if(sha(base)!==c.baselineSha256||!same(JSON.parse(base),manifest)||manifest.id!==c.baselineId||
    !manifest.sources.some(s=>s.kind==='sdk'&&s.sha256===c.sdkSha256)||
    c.files.some(f=>sha(local(read,f.file))!==f.sha256))return false;
 if(!Array.isArray(rows)||new Set(rows.map(r=>r.id)).size!==rows.length)return false;
 return c.methods.every(m=>eligible(rows.find(r=>r.id===m.id),m));
}
function runtimeProof(c,manifest,ast,runtime,read){
 const aliases=reviewedEventNamesAliases(manifest,ast,runtime,read);
 return Object.keys(aliases).length===44&&c.methods.every(m=>aliases[m.engineId]===m.id)&&
  aliases['Vsm.Map.EventNames']==='Tmapv3.event.EventNames';
}
function dartProof(c,dart){
 if(!Array.isArray(dart?.rows)||!dart.exportedFiles?.includes('lib/src/constants/event_names.dart'))return false;
 return [...c.methods.map(m=>m.dart),c.dartValues].every(expected=>{
  const matches=dart.rows.filter(r=>r.id===expected.id&&r.kind==='field');
  return matches.length===1&&same(matches[0],expected);
 });
}
function platformProof(evidence,lib,read){
 if(!same(evidence?.libFingerprint,lib)||!libraryMatches(lib,read)||!Array.isArray(evidence.inputs))return null;
 const required=['example/integration_test/event_names_contracts.dart','example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart'];
 if(required.some(f=>evidence.inputs.filter(i=>i.file===f).length!==1)||new Set(evidence.inputs.map(i=>i.file)).size!==evidence.inputs.length||
    evidence.inputs.some(i=>!safe(i.file)||sha(local(read,i.file))!==i.sha256))return null;
 const out={};
 for(const p of platforms){
  const found=evidence.records?.filter(r=>r.platform===p&&r.kind==='integration');if(found?.length!==1)return null;
  const r=found[0],expected=`docs/sdk-audit/platform-logs/${p==='web'?'web-final.log':p+'-complete.log'}`;
  if(r.file!==expected||r.passed!==true)return null;
  const body=local(read,r.file).toString();
  if(sha(body)!==r.sha256||!platformLogPassed(body.split('\n'),p))return null;
  const parsed=parsePlatformMarkerRows(body.split('\n'),marker).map(row=>row.data);
  if(!same(parsed,r.eventNamesResults)||compareEventNamesObservations(parsed,{read}).status!=='BOUNDED_MATCH')return null;
  out[p]={file:r.file,sha256:r.sha256,row:parsed[0]};
 }
 return out;
}
function observation(m,p,platform){
 const sample={native:platform.row.native.tmap.descriptors[m.name],dart:platform.row.dart.staticMembers[m.name],valueMap:platform.row.dart.values[m.name]};
 return {id:`event-name-adaptation:${p}:${m.id}`,contract:m.id,dartMember:m.dart.id,platform:p,status:'adaptation-match',dimensions,
  count:1,initialValue:m.value,actualSha256:sha(JSON.stringify(sample)),platformLog:{file:platform.file,sha256:platform.sha256}};
}
function proof(c,m,lib,obs){
 return {baselineId:c.baselineId,libSha256:lib.sha256,scope:c.scope,
  sourceReview:{variant:'event-name-constant',contract:m.id,dartMember:m.dart.id,scope:c.scope,dimensions:c.dimensions,
   initialValue:m.value,engineAlias:m.engineId,rowSourceHash:m.rowSourceHash,configSha256:CONFIG_SHA,adaptation:c.adaptation},
  platforms:Object.fromEntries(platforms.map(p=>[p,Object.fromEntries(dimensions.map(d=>[d,[obs[p].id]]))]))};
}
export function verifyEventNameConstants({rows,manifest,ast,dart,runtime,libFingerprint,read=fs.readFileSync}){
 try{
  const c=config(read);if(!sourceProof(c,manifest,rows,read)||!runtimeProof(c,manifest,ast,runtime,read)||!dartProof(c,dart))return [];
  const actual=platformProof(runtime.platformEvidence,libFingerprint,read);if(!actual)return [];
  const targets=c.methods.map(m=>({m,row:rows.find(r=>r.id===m.id)}));
  if(targets.some(({row,m})=>!['candidate-unverified','unmapped'].includes(row.status)||!validCandidate(row,m,true)))return [];
  const prepared=targets.map(({m,row})=>({m,row,obs:Object.fromEntries(platforms.map(p=>[p,observation(m,p,actual[p])]))}));
  const out=[];
  for(const {m,row,obs} of prepared){
   row.status='reviewed-adaptation';row.proofProblems=[];row.platforms=Object.fromEntries(platforms.map(p=>[p,'verified']));
   row.verification=proof(c,m,libFingerprint,obs);
   if(!row.dartCandidates.some(d=>d.id===m.dart.id))row.dartCandidates.push({id:m.dart.id,file:m.dart.file,line:m.dart.line,signature:m.dart.signature,binding:'source-reviewed static constant'});
   out.push(...platforms.map(p=>obs[p]));
  }
  return out;
 }catch{return [];}
}
export function validEventNameAdaptation(row,report,read=fs.readFileSync){
 if(row?.status!=='reviewed-adaptation'||row?.verification?.sourceReview?.variant!=='event-name-constant')return false;
 try{
  const c=config(read),m=c.methods.find(x=>x.id===row.id);
  if(!m||report.baselineId!==c.baselineId||report.sdkSha256!==c.sdkSha256||!eligible(row,m)||!validCandidate(row,m)||row.proofProblems?.length)return false;
  const manifest=JSON.parse(local(read,'tool/sdk_audit/baselines/2026-11-17-production.json'));
  if(!sourceProof(c,manifest,report.rows,read)||!runtimeProof(c,manifest,null,report.eventNamesRuntimeEvidence,read))return false;
  const actual=platformProof(report.platformEvidence,report.libFingerprint,read);if(!actual)return false;
  const obs=Object.fromEntries(platforms.map(p=>[p,observation(m,p,actual[p])]));
  const inside=report.rows.filter(r=>r.id===row.id);
  if(inside.length!==1||inside[0].status!==row.status||inside[0].proofProblems?.length||!eligible(inside[0],m)||!validCandidate(inside[0],m)||
     !same(inside[0].verification,row.verification)||!same(row.verification,proof(c,m,report.libFingerprint,obs))||
     platforms.some(p=>row.platforms?.[p]!=='verified'||inside[0].platforms?.[p]!=='verified'))return false;
  return platforms.every(p=>report.observations?.filter(o=>o.id===obs[p].id).length===1&&report.observations.some(o=>same(o,obs[p])));
 }catch{return false;}
}
