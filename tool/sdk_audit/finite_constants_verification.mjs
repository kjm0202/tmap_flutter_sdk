// Two independently source-reviewed finite sets only: 73 initial unit-table
// values and 24 initial public constants. No namespace/mutation/operational
// behavior is promoted. Batch validation deliberately has no persistent cache.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {ROOT,HERE,sha} from './common.mjs';
import {rowSourceHash} from './scope_reviews.mjs';
import {collectFiniteConstantEvidence} from './finite_constants_evidence.mjs';

const CONFIG_SHA='2623b0f62eb595b38f4fa1f49f413d381511dc65ab4090556d7e8f48a696e3be';
const configPath=path.join(HERE,'finite_constants_reviews.json');
const expectedIds=Object.freeze(["Tmapv3.util.Util.INCHES_PER_UNIT.150kilometers","Tmapv3.util.Util.INCHES_PER_UNIT.50kilometers","Tmapv3.util.Util.INCHES_PER_UNIT.BenoitChain","Tmapv3.util.Util.INCHES_PER_UNIT.BenoitLink","Tmapv3.util.Util.INCHES_PER_UNIT.Brealey","Tmapv3.util.Util.INCHES_PER_UNIT.CaGrid","Tmapv3.util.Util.INCHES_PER_UNIT.CapeFoot","Tmapv3.util.Util.INCHES_PER_UNIT.Centimeter","Tmapv3.util.Util.INCHES_PER_UNIT.ClarkeChain","Tmapv3.util.Util.INCHES_PER_UNIT.ClarkeFoot","Tmapv3.util.Util.INCHES_PER_UNIT.ClarkeLink","Tmapv3.util.Util.INCHES_PER_UNIT.cm","Tmapv3.util.Util.INCHES_PER_UNIT.dd","Tmapv3.util.Util.INCHES_PER_UNIT.Decameter","Tmapv3.util.Util.INCHES_PER_UNIT.Decimeter","Tmapv3.util.Util.INCHES_PER_UNIT.degrees","Tmapv3.util.Util.INCHES_PER_UNIT.Dekameter","Tmapv3.util.Util.INCHES_PER_UNIT.dm","Tmapv3.util.Util.INCHES_PER_UNIT.Fathom","Tmapv3.util.Util.INCHES_PER_UNIT.Foot","Tmapv3.util.Util.INCHES_PER_UNIT.ft","Tmapv3.util.Util.INCHES_PER_UNIT.Furlong","Tmapv3.util.Util.INCHES_PER_UNIT.GermanMeter","Tmapv3.util.Util.INCHES_PER_UNIT.GoldCoastFoot","Tmapv3.util.Util.INCHES_PER_UNIT.GunterChain","Tmapv3.util.Util.INCHES_PER_UNIT.GunterLink","Tmapv3.util.Util.INCHES_PER_UNIT.Hectometer","Tmapv3.util.Util.INCHES_PER_UNIT.IFoot","Tmapv3.util.Util.INCHES_PER_UNIT.IInch","Tmapv3.util.Util.INCHES_PER_UNIT.IMile","Tmapv3.util.Util.INCHES_PER_UNIT.in","Tmapv3.util.Util.INCHES_PER_UNIT.Inch","Tmapv3.util.Util.INCHES_PER_UNIT.inches","Tmapv3.util.Util.INCHES_PER_UNIT.ind-ch","Tmapv3.util.Util.INCHES_PER_UNIT.IndianFoot","Tmapv3.util.Util.INCHES_PER_UNIT.IndianFt37","Tmapv3.util.Util.INCHES_PER_UNIT.IndianFt62","Tmapv3.util.Util.INCHES_PER_UNIT.IndianFt75","Tmapv3.util.Util.INCHES_PER_UNIT.IndianYard","Tmapv3.util.Util.INCHES_PER_UNIT.IndianYd37","Tmapv3.util.Util.INCHES_PER_UNIT.IndianYd62","Tmapv3.util.Util.INCHES_PER_UNIT.IndianYd75","Tmapv3.util.Util.INCHES_PER_UNIT.IntnlChain","Tmapv3.util.Util.INCHES_PER_UNIT.IntnlLink","Tmapv3.util.Util.INCHES_PER_UNIT.IYard","Tmapv3.util.Util.INCHES_PER_UNIT.Kilometer","Tmapv3.util.Util.INCHES_PER_UNIT.km","Tmapv3.util.Util.INCHES_PER_UNIT.kmi","Tmapv3.util.Util.INCHES_PER_UNIT.Lat-66","Tmapv3.util.Util.INCHES_PER_UNIT.Lat-83","Tmapv3.util.Util.INCHES_PER_UNIT.m","Tmapv3.util.Util.INCHES_PER_UNIT.Meter","Tmapv3.util.Util.INCHES_PER_UNIT.mi","Tmapv3.util.Util.INCHES_PER_UNIT.MicroInch","Tmapv3.util.Util.INCHES_PER_UNIT.Mil","Tmapv3.util.Util.INCHES_PER_UNIT.Mile","Tmapv3.util.Util.INCHES_PER_UNIT.Millimeter","Tmapv3.util.Util.INCHES_PER_UNIT.mm","Tmapv3.util.Util.INCHES_PER_UNIT.ModAmFt","Tmapv3.util.Util.INCHES_PER_UNIT.NautM","Tmapv3.util.Util.INCHES_PER_UNIT.NautM-UK","Tmapv3.util.Util.INCHES_PER_UNIT.nmi","Tmapv3.util.Util.INCHES_PER_UNIT.Perch","Tmapv3.util.Util.INCHES_PER_UNIT.Pole","Tmapv3.util.Util.INCHES_PER_UNIT.Rod","Tmapv3.util.Util.INCHES_PER_UNIT.Rood","Tmapv3.util.Util.INCHES_PER_UNIT.SearsChain","Tmapv3.util.Util.INCHES_PER_UNIT.SearsFoot","Tmapv3.util.Util.INCHES_PER_UNIT.SearsLink","Tmapv3.util.Util.INCHES_PER_UNIT.SearsYard","Tmapv3.util.Util.INCHES_PER_UNIT.us-in","Tmapv3.util.Util.INCHES_PER_UNIT.Yard","Tmapv3.util.Util.INCHES_PER_UNIT.yd","Tmapv3.extension.XML.CONTENT_TYPE.COMPLEX","Tmapv3.extension.XML.CONTENT_TYPE.EMPTY","Tmapv3.extension.XML.CONTENT_TYPE.MIXED","Tmapv3.extension.XML.CONTENT_TYPE.SIMPLE","Tmapv3.mapobject.InfoWindowOptions.TYPE_BALLOON","Tmapv3.mapobject.InfoWindowOptions.TYPE_FLAT","Tmapv3.mapobject.LabelOptions.ALIGN_CENTERBOTTOM","Tmapv3.mapobject.LabelOptions.ALIGN_CENTERMIDDLE","Tmapv3.mapobject.LabelOptions.ALIGN_CENTERTOP","Tmapv3.mapobject.LabelOptions.ALIGN_LEFTBOTTOM","Tmapv3.mapobject.LabelOptions.ALIGN_LEFTMIDDLE","Tmapv3.mapobject.LabelOptions.ALIGN_LEFTTOP","Tmapv3.mapobject.LabelOptions.ALIGN_RIGHTBOTTOM","Tmapv3.mapobject.LabelOptions.ALIGN_RIGHTMIDDLE","Tmapv3.mapobject.LabelOptions.ALIGN_RIGHTTOP","Tmapv3.network.HttpRequest.COMPLETED","Tmapv3.network.HttpRequest.INTERACTIVE","Tmapv3.network.HttpRequest.LOADED","Tmapv3.network.HttpRequest.LOADING","Tmapv3.network.HttpRequest.UNINITIALIZED","Tmapv3.util.Util.State.DELETE","Tmapv3.util.Util.State.INSERT","Tmapv3.util.Util.State.UNKNOWN","Tmapv3.util.Util.State.UPDATE"]);
export const finiteConstantContracts=expectedIds;
const dimensions=['inputs-defaults','returns-types','mutation-identity','errors','lifecycle-events','dispatch'];
const platforms=['web','android','ios'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const equal=isDeepStrictEqual;
const local=(read,p)=>read(path.join(ROOT,p));
function config(read){
 const bytes=read(configPath);if(sha(bytes)!==CONFIG_SHA)throw Error('config drift');
 const c=JSON.parse(bytes.toString()),ids=c.groups.flatMap(g=>g.members.map(m=>m.api));
 if(c.schemaVersion!==1||c.groups.length!==2||c.groups[0].id!=='units'||c.groups[1].id!=='public'||
    c.groups[0].members.length!==73||c.groups[1].members.length!==24||!same(ids,expectedIds)||
    dimensions.some(d=>!c.dimensions[d]))throw Error('config structure');
 return c;
}
function eligible(row,m){
 return !!row&&row.id===m.api&&row.owner===m.owner&&row.scope===m.scope&&same(row.kinds,m.kinds)&&
  same(row.sourceNames,m.sourceNames)&&same(row.contracts,m.contracts)&&rowSourceHash(row)===m.rowSourceHash;
}
function candidate(row,m,allowMissing=false){
 if(!Array.isArray(row.dartCandidates))return false;
 const d=row.dartCandidates.filter(c=>c.id===m.dart.id);
 return d.length===0?allowMissing:d.length===1&&d[0].file===m.dart.file&&d[0].line===m.dart.line&&d[0].signature===m.dart.signature;
}
function rowProof(c,rows){
 if(!Array.isArray(rows)||new Set(rows.map(r=>r.id)).size!==rows.length)return false;
 const index=new Map(rows.map(r=>[r.id,r]));
 return c.groups.every(g=>g.members.every(m=>eligible(index.get(m.api),m)));
}
function runtimeProof(c,runtime){
 if(!Array.isArray(runtime?.rows))return false;
 return c.groups.every(g=>g.members.every(m=>{
  const records=runtime.rows.filter(r=>r.id===m.api&&r.kind==='property'&&r.phase==='loaded');
  const type=g.id==='units'?'number':typeof m.value;
  return records.length===1&&records[0].valueType===type&&records[0].writable===true&&records[0].enumerable===true&&
   records[0].evidence?.some(e=>e.channel==='runtime'&&e.sha256===c.sdkSha256&&e.phase==='loaded');
 }));
}
function dartProof(c,dart){
 if(!Array.isArray(dart?.rows)||!dart.exportedFiles?.includes('lib/src/constants/sdk_units.dart')||
    !dart.exportedFiles?.includes('lib/src/constants/public_sdk_constants.dart'))return false;
 const all=[...c.groups.flatMap(g=>g.members.map(m=>m.dart)),c.groups.find(g=>g.id==='public').mapDartField];
 return all.every(expected=>{const matches=dart.rows.filter(r=>r.id===expected.id&&r.kind==='field');return matches.length===1&&same(matches[0],expected);});
}
function groupProof(c,g,record,read){
 const fixture=JSON.parse(local(read,g.fixture));
 if(fixture.status!=='OPEN'||fixture.sdkSha256!==c.sdkSha256)return false;
 if(record?.expectedSdkSha256!==c.sdkSha256||record.sdkDigestMeasurement!=='not measured by this helper')return false;
 if(g.id==='units'){
  const n=fixture.observation,d=record.dart;
  return record.id==='unit-constants:initial-table'&&equal(record.native,{status:'observed',...n})&&
   n.keys.length===73&&new Set(n.keys).size===73&&g.members.every(m=>n.keys.includes(m.method))&&
   g.members.every(m=>equal(n.values[m.method],m.value)&&equal(n.descriptors[m.method],m.descriptor))&&
   equal(d?.keys,n.keys)&&equal(d?.values,n.values)&&equal(d?.missing,n.missing)&&d?.rejectsMutation===true;
 }
 const descriptors=fixture.descriptors,values=Object.fromEntries(g.members.map(m=>[m.api,m.value]));
 return record.id==='public-constants:24'&&equal(record.native,{status:'observed',descriptors})&&
  Object.keys(descriptors).length===24&&g.members.every(m=>equal(descriptors[m.api],m.descriptor))&&
  equal(record.dart?.values,values)&&equal(record.dart?.staticMembers,values)&&
  record.dart?.staticMatchesValues===true&&record.dart?.matchesNative===true;
}
function prepare(c,{rows,manifest,runtime,libFingerprint,platformEvidence,read}){
 if(!rowProof(c,rows)||!runtimeProof(c,runtime))return null;
 const captured=collectFiniteConstantEvidence({manifest,runtime,libFingerprint,platformEvidence,requirements:c,read});
 if(!captured)return null;
 for(const p of platforms)for(const g of c.groups){
  const rows=captured.records[p].groups[g.id];if(rows.length!==1||!groupProof(c,g,rows[0],read))return null;
 }
 return captured;
}
function observation(m,g,p,captured){
 const r=captured.records[p],record=r.groups[g.id][0];
 const sample=g.id==='units'?{native:record.native.values[m.method],dart:record.dart.values[m.method],descriptor:record.native.descriptors[m.method]}:
  {native:record.native.descriptors[m.api],dart:record.dart.staticMembers[m.api],valueMap:record.dart.values[m.api]};
 return{id:`finite-constant-adaptation:${p}:${m.api}`,contract:m.api,dartMember:m.dart.id,platform:p,status:'adaptation-match',dimensions,
  count:1,actualSha256:sha(JSON.stringify(sample)),platformLog:{file:r.file,sha256:r.sha256}};
}
function proof(c,g,m,lib,obs){
 const native='Writable/configurable initial JavaScript property';
 const adapted=g.id==='units'?'Immutable Dart const-map entry; absent key returns null instead of JS undefined.':'Immutable Dart static const member and const-map entry.';
 return{baselineId:c.baselineId,libSha256:lib.sha256,scope:g.scope,sourceReview:{variant:'finite-constant',contract:m.api,dartMember:m.dart.id,
  dartKey:g.id==='units'?m.method:m.api,scope:g.scope,dimensions:c.dimensions,rowSourceHash:m.rowSourceHash,configSha256:CONFIG_SHA,
  adaptation:{native,dart:adapted,rationale:'Source-pinned initial value only; mutable namespace and associated operations remain separate.'}},
  platforms:Object.fromEntries(platforms.map(p=>[p,Object.fromEntries(dimensions.map(d=>[d,[obs[p].id]]))]))};
}
export function verifyFiniteConstantAdaptations({rows,manifest,ast,dart,runtime,libFingerprint,read=fs.readFileSync}){
 try{
  const c=config(read);if(!dartProof(c,dart))return [];
  const captured=prepare(c,{rows,manifest,runtime,libFingerprint,platformEvidence:runtime.platformEvidence,read});if(!captured)return [];
  const index=new Map(rows.map(r=>[r.id,r])),targets=c.groups.flatMap(g=>g.members.map(m=>({g,m,row:index.get(m.api)})));
  if(targets.some(({row,m})=>!['candidate-unverified','unmapped'].includes(row.status)||!candidate(row,m,true)))return [];
  const ready=targets.map(({g,m,row})=>({g,m,row,obs:Object.fromEntries(platforms.map(p=>[p,observation(m,g,p,captured)]))}));
  const out=[];
  for(const {g,m,row,obs} of ready){
   row.status='reviewed-adaptation';row.proofProblems=[];row.platforms=Object.fromEntries(platforms.map(p=>[p,'verified']));
   row.verification=proof(c,g,m,libFingerprint,obs);
   if(!row.dartCandidates.some(d=>d.id===m.dart.id))row.dartCandidates.push({id:m.dart.id,file:m.dart.file,line:m.dart.line,signature:m.dart.signature,binding:'source-reviewed immutable constant'});
   out.push(...platforms.map(p=>obs[p]));
  }
  return out;
 }catch{return [];}
}

// Call once at the start of a synchronous worklist conversion. It performs a
// fresh source/lib/log revalidation on every call; the returned immutable map
// is valid for that report snapshot and must not be persisted across mutations.
export function validFiniteConstantAdaptations(report,read=fs.readFileSync){
 try{
  const c=config(read);if(report?.baselineId!==c.baselineId||report.sdkSha256!==c.sdkSha256)return Object.freeze({});
  const manifest=JSON.parse(local(read,'tool/sdk_audit/baselines/2026-11-17-production.json'));
  const captured=prepare(c,{rows:report.rows,manifest,runtime:report.finiteConstantsRuntimeEvidence,libFingerprint:report.libFingerprint,platformEvidence:report.platformEvidence,read});
  if(!captured)return Object.freeze({});
  const index=new Map(report.rows.map(r=>[r.id,r])),obsIndex=new Map();
  for(const o of report.observations||[]){if(obsIndex.has(o.id))obsIndex.set(o.id,null);else obsIndex.set(o.id,o);}
  const result={};
  for(const g of c.groups)for(const m of g.members){
   const row=index.get(m.api),obs=Object.fromEntries(platforms.map(p=>[p,observation(m,g,p,captured)]));
   if(row?.status==='reviewed-adaptation'&&!row.proofProblems?.length&&candidate(row,m)&&
      same(row.verification,proof(c,g,m,report.libFingerprint,obs))&&platforms.every(p=>row.platforms?.[p]==='verified'&&same(obsIndex.get(obs[p].id),obs[p])))result[m.api]=true;
  }
  return Object.freeze(result);
 }catch{return Object.freeze({});}
}
