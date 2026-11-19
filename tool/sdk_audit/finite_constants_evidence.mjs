// Shared evidence collection for finite constant batches. This module never
// changes rows or authorizes contract status. A caller must independently pin
// its review configuration and check SDK descriptors, values, Dart bindings,
// adaptations, and each source row against the returned observations.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,sha} from './common.mjs';
import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';

const platforms=['web','android','ios'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const safe=p=>typeof p==='string'&&!path.isAbsolute(p)&&!p.split('/').includes('..');
const local=(read,p)=>{if(!safe(p))throw Error('unsafe path');return read(path.join(ROOT,p));};

function libraryMatches(lib,read){
 if(!lib?.sha256||!lib.files||sha(JSON.stringify(lib.files))!==lib.sha256)return false;
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(['node_modules','.dart_tool','.cache'].includes(e.name))return [];
  const p=path.join(dir,e.name);return e.isDirectory()?walk(p):e.isFile()?[path.relative(ROOT,p)]:[];
 });
 const files=walk(path.join(ROOT,'lib'));
 return same(Object.keys(lib.files).sort(),files.sort())&&files.every(f=>sha(local(read,f))===lib.files[f]);
}

/// Checks pinned input bytes and collects each group's one recorded result on
/// each platform. Expected hashes and markers must come from an independently
/// authenticated review configuration; arbitrary caller input is NOT proof.
/// No cache survives a call: each invocation rereads all pinned sources,
/// library files and platform logs, preventing stale cross-report evidence.
export function collectFiniteConstantEvidence({manifest,runtime,libFingerprint,platformEvidence,requirements,read=fs.readFileSync}){
 try{
  const {baselineId,baselineSha256,sdkSha256,pinnedFiles,sourceSpans,groups}=requirements;
  const baseline=local(read,'tool/sdk_audit/baselines/2026-11-17-production.json');
  if(sha(baseline)!==baselineSha256||!same(JSON.parse(baseline),manifest)||manifest.id!==baselineId||
     !manifest.sources?.some(s=>s.kind==='sdk'&&s.sha256===sdkSha256)||
     !runtime?.networkScripts?.some(s=>s.pinned===true&&s.status===200&&s.sha256===sdkSha256))return null;
  const sdk=local(read,`tool/sdk_audit/.cache/sources/${sdkSha256}`);
  const sdkSource=sdk.toString('utf8');
  if(sha(sdk)!==sdkSha256||!Array.isArray(sourceSpans)||!sourceSpans.length||
     sourceSpans.some(s=>!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.end<=s.start||sdkSource.slice(s.start,s.end)!==s.excerpt))return null;
  if(!Array.isArray(pinnedFiles)||!pinnedFiles.length||new Set(pinnedFiles.map(x=>x.file)).size!==pinnedFiles.length||
     pinnedFiles.some(x=>!safe(x.file)||!/^[a-f0-9]{64}$/.test(x.sha256)||sha(local(read,x.file))!==x.sha256))return null;
  if(!Array.isArray(groups)||!groups.length||new Set(groups.map(g=>g.id)).size!==groups.length||
     new Set(groups.map(g=>g.marker)).size!==groups.length||new Set(groups.map(g=>g.recordKey)).size!==groups.length||
     groups.some((g,i)=>groups.some((h,j)=>i!==j&&g.marker.includes(h.marker)))||groups.some(g=>!g.id||!g.marker||!g.recordKey||
      !pinnedFiles.some(f=>f.file===g.helper)))return null;
  if(!same(platformEvidence?.libFingerprint,libFingerprint)||!libraryMatches(libFingerprint,read)||!Array.isArray(platformEvidence.inputs))return null;
  const required=[...groups.map(g=>g.helper),'example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart'];
  if(required.some(f=>platformEvidence.inputs.filter(i=>i.file===f).length!==1)||
     new Set(platformEvidence.inputs.map(i=>i.file)).size!==platformEvidence.inputs.length||
     platformEvidence.inputs.some(i=>!safe(i.file)||sha(local(read,i.file))!==i.sha256))return null;
  const records={};
  for(const p of platforms){
   const found=platformEvidence.records?.filter(r=>r.platform===p&&r.kind==='integration');if(found?.length!==1)return null;
   const rec=found[0],expected=`docs/sdk-audit/platform-logs/${p==='web'?'web-final.log':p+'-complete.log'}`;
   if(rec.file!==expected||rec.passed!==true)return null;
   const body=local(read,rec.file).toString();
   const lines=body.split('\n');
   if(sha(body)!==rec.sha256||!platformLogPassed(lines,p))return null;
   const parsed=Object.fromEntries(groups.map(g=>[g.id,parsePlatformMarkerRows(lines,g.marker.trimEnd()).map(row=>row.data)]));
   for(const g of groups)if(parsed[g.id].length!==1||!same(parsed[g.id],rec[g.recordKey]))return null;
   records[p]={file:rec.file,sha256:rec.sha256,groups:parsed};
  }
  return {baselineId,sdkSha256,libSha256:libFingerprint.sha256,records};
 }catch{return null;}
}
