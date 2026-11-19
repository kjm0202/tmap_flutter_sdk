import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
// Source-bound, method-only adaptations. This does not verify return facets,
// all JS inputs, the other three methods, or the complete LatLngBounds class.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,HERE,sha} from './common.mjs';
import {rowSourceHash} from './scope_reviews.mjs';
import {compareSdkBoundsDimensions} from './sdk_bounds_dimensions_compare.mjs';

const CONFIG_SHA='16bfe9ee519f85de3f66896658f4b52f884a693b21085ecbc7d13b27754dcb9d';
export const boundsDimensionsContracts=Object.freeze(['getWidth','getHeight','getWidthDiff','getHeightDiff','toString'].map(m=>`Tmapv3.base.LatLngBounds#${m}`));
export const boundsDimensionsEligibleContracts=Object.freeze(['getWidthDiff','getHeightDiff'].map(m=>`Tmapv3.base.LatLngBounds#${m}`));
const configPath=path.join(HERE,'bounds_dimensions_reviews.json');
const dimensions=['inputs-defaults','returns-types','mutation-identity','errors','lifecycle-events','dispatch'];
const platforms=['web','android','ios'];
const marker='SDK BOUNDS DIMENSIONS RESULT:';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const safe=p=>typeof p==='string'&&!path.isAbsolute(p)&&!p.split('/').includes('..');
const local=(read,p)=>{if(!safe(p))throw Error('unsafe path');return read(path.join(ROOT,p));};

function config(read){
 const bytes=read(configPath);if(sha(bytes)!==CONFIG_SHA)throw Error('config');
 const c=JSON.parse(bytes.toString());
 if(c.schemaVersion!==1||c.methods.length!==2||new Set(c.methods.map(m=>m.id)).size!==2||
    c.methods.some(m=>m.caseIds.length!==22||new Set(m.caseIds).size!==22)||
    dimensions.some(d=>!c.dimensions[d])||!same(c.methods.map(m=>m.id),boundsDimensionsEligibleContracts))throw Error('config structure');
 return c;
}
function rowEligible(row,m){
 return !!row&&row.id===m.id&&row.owner===m.owner&&same(row.sourceNames,m.sourceNames)&&
  same(row.kinds,m.kinds)&&row.scope===m.scope&&same(row.contracts,m.contracts)&&
  rowSourceHash(row)===m.rowSourceHash;
}
function libraryMatches(lib,read){
 if(!lib?.sha256||!lib.files||sha(JSON.stringify(lib.files))!==lib.sha256)return false;
 // Match the exact current file set, not merely a caller-provided subset.
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
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
    !manifest.sources.some(s=>s.sha256===c.docsSha256))return false;
 const sdk=local(read,`tool/sdk_audit/.cache/sources/${c.sdkSha256}`);
 const doc=local(read,`tool/sdk_audit/.cache/sources/${c.docsSha256}`);
 if(sha(sdk)!==c.sdkSha256||sha(doc)!==c.docsSha256||c.extraSdkSpans.some(s=>sdk.toString('utf8').slice(s.start,s.end)!==s.excerpt)||
    c.files.some(f=>sha(local(read,f.file))!==f.sha256))return false;
 if(!Array.isArray(rows)||new Set(rows.map(r=>r.id)).size!==rows.length)return false;
 return c.methods.every(m=>rowEligible(rows.find(r=>r.id===m.id),m));
}
function runtimeProof(c,runtime){
 return runtime?.aliases?.['Tmapv3.LatLngBounds']==='Tmapv3.base.LatLngBounds'&&
  runtime.aliases['Tmapv3.LatLng']==='Tmapv3.base.LatLng'&&
  runtime.networkScripts?.some(s=>s.pinned===true&&s.status===200&&s.sha256===c.sdkSha256)&&
  c.methods.every(m=>{
   const records=runtime.rows?.filter(r=>r.id===m.id&&r.kind==='method'&&r.phase==='loaded');
   return records?.length===1&&records[0].valueType==='function'&&
    records[0].evidence?.some(e=>e.channel==='runtime'&&e.sha256===c.sdkSha256&&e.phase==='loaded');
  });
}
function platformProof(c,evidence,lib,read){
 if(!same(evidence?.libFingerprint,lib)||!libraryMatches(lib,read)||!Array.isArray(evidence.inputs))return null;
 const required=['example/integration_test/sdk_bounds_dimensions_contracts.dart','example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart'];
 if(required.some(f=>evidence.inputs.filter(i=>i.file===f).length!==1)||
    new Set(evidence.inputs.map(i=>i.file)).size!==evidence.inputs.length||
    evidence.inputs.some(i=>!safe(i.file)||sha(local(read,i.file))!==i.sha256))return null;
 const out={};
 for(const p of platforms){
  const found=evidence.records?.filter(r=>r.platform===p&&r.kind==='integration');
  if(found?.length!==1)return null;
  const r=found[0], expected=`docs/sdk-audit/platform-logs/${p==='web'?'web-final.log':p+'-complete.log'}`;
  if(r.file!==expected||r.passed!==true)return null;
  const body=local(read,r.file).toString();
  if(sha(body)!==r.sha256||!platformLogPassed(body.split('\n'),p))return null;
  const parsed=parsePlatformMarkerRows(body.split('\n'),marker).map(row=>row.data);
  if(!same(parsed,r.sdkBoundsDimensionsResults)||compareSdkBoundsDimensions(parsed,{read}).status!=='BOUNDED_MATCH')return null;
  out[p]={file:r.file,sha256:r.sha256,rows:parsed};
 }
 return out;
}
function observation(m,p,platform){
 const actual=platform.rows.filter(x=>m.caseIds.includes(x.id));
 if(actual.length!==22||!same(actual.map(x=>x.id),m.caseIds))throw Error('method cases');
 return {id:`bounds-dimensions-adaptation:${p}:${m.id}`,contract:m.id,dartMember:m.binding,platform:p,status:'adaptation-match',dimensions,
  count:22,caseIds:m.caseIds,actualSha256:sha(JSON.stringify(actual)),platformLog:{file:platform.file,sha256:platform.sha256}};
}
function proof(c,m,lib,obs){
 return {baselineId:c.baselineId,libSha256:lib.sha256,scope:c.scope,
  sourceReview:{variant:'bounds-dimensions',contract:m.id,dartMember:m.binding,scope:c.scope,review:c.review,dimensions:c.dimensions,
   unit:m.unit,chain:m.chain,limits:m.limits,caseIds:m.caseIds,rowSourceHash:m.rowSourceHash,configSha256:CONFIG_SHA,
   adaptation:{native:'JS instance, primitive result and TypeError on missing corners',dart:'Typed numeric snapshot, primitive result and SdkBoundsMissingCornerException',rationale:m.limits}},
  platforms:Object.fromEntries(platforms.map(p=>[p,Object.fromEntries(dimensions.map(d=>[d,[obs[p].id]]))]))};
}

export function verifyBoundsDimensionsAdaptations({rows,manifest,runtime,libFingerprint,read=fs.readFileSync}){
 try{
  const c=config(read);if(!sourceProof(c,manifest,rows,read)||!runtimeProof(c,runtime))return [];
  const actual=platformProof(c,runtime.platformEvidence,libFingerprint,read);if(!actual)return [];
  const targets=c.methods.map(m=>({m,row:rows.find(r=>r.id===m.id)}));
  if(targets.some(({row})=>!['candidate-unverified','unmapped'].includes(row.status)))return [];
  const prepared=targets.map(({m,row})=>({m,row,obs:Object.fromEntries(platforms.map(p=>[p,observation(m,p,actual[p])]))}));
  const out=[];
  for(const {m,row,obs} of prepared){
   row.status='reviewed-adaptation';row.proofProblems=[];
   row.platforms=Object.fromEntries(platforms.map(p=>[p,'verified']));
   row.verification=proof(c,m,libFingerprint,obs);
   out.push(...platforms.map(p=>obs[p]));
  }
  return out;
 }catch{return [];}
}

export function validBoundsDimensionsAdaptation(row,report,read=fs.readFileSync){
 if(row?.status!=='reviewed-adaptation'||row?.verification?.sourceReview?.variant!=='bounds-dimensions')return false;
 try{
  const c=config(read),m=c.methods.find(x=>x.id===row.id);
  if(!m||report.baselineId!==c.baselineId||report.sdkSha256!==c.sdkSha256||!rowEligible(row,m)||row.proofProblems?.length||
     report.aliases?.['Tmapv3.LatLngBounds']!=='Tmapv3.base.LatLngBounds'||report.aliases?.['Tmapv3.LatLng']!=='Tmapv3.base.LatLng'||
     !runtimeProof(c,report.boundsDimensionsRuntimeEvidence))return false;
  const manifest=JSON.parse(local(read,'tool/sdk_audit/baselines/2026-11-17-production.json'));
  if(!sourceProof(c,manifest,report.rows,read))return false;
  const actual=platformProof(c,report.platformEvidence,report.libFingerprint,read);if(!actual)return false;
  const obs=Object.fromEntries(platforms.map(p=>[p,observation(m,p,actual[p])]));
  const inside=report.rows.filter(r=>r.id===row.id);
  if(inside.length!==1||inside[0].status!==row.status||inside[0].proofProblems?.length||!rowEligible(inside[0],m)||!same(inside[0].verification,row.verification)||
     !same(row.verification,proof(c,m,report.libFingerprint,obs))||platforms.some(p=>row.platforms?.[p]!=='verified'||inside[0].platforms?.[p]!=='verified'))return false;
  return platforms.every(p=>report.observations?.filter(o=>o.id===obs[p].id).length===1&&report.observations.some(o=>same(o,obs[p])));
 }catch{return false;}
}
