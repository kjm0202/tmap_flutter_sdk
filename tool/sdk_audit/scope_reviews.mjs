import fs from 'node:fs';import path from 'node:path';
import {HERE,ROOT,sha} from './common.mjs';
const reviews=JSON.parse(fs.readFileSync(new URL('./scope_reviews.json',import.meta.url),'utf8'));
const renderDigests=Object.freeze({
 'shape-render-storage-circle':'e739943c98327e18b995969d120f65a36a380a13a170ae32f1c5442e19d21420',
 'shape-render-storage-polygon':'e13a280ffe577322a22fcb6bac2be792fa2b3f379462b3d2729aab30b0e3ffc0',
 'shape-render-storage-polyline':'1ddcd28791867abca6b661afb38466344da4ab39637917725d451a15980248fa',
 'shape-render-storage-rectangle':'89f391a2434e5c34cb5e8b1dc3971f64f384a0e47896ecb50ffaf339cd4d2f9f',
});
const renderFields=['vsmStyle','vsmStyle.fill','vsmStyle.fill-opacity','vsmStyle.stroke','vsmStyle.stroke-opacity','vsmStyle.stroke-width','layerId','stackId'];
const renderIds=new Set(['Circle','Polygon','Polyline','Rectangle'].flatMap(c=>renderFields.map(f=>`Tmapv3.shape.${c}@_shape_data.${f}`)));
export const rowSourceHash=row=>sha(JSON.stringify({id:row.id,kinds:row.kinds,evidence:row.evidence,channels:row.channels}));
const publicEvidence=row=>row.channels.some(c=>c==='docs'||c.startsWith('example'));
function reviewedRepresentation(id,review) {
 if(/^Tmapv3\.[^@]+@_object_(?:\.|$)/.test(id))return true;
 if(review.reviewType==='shape-render-storage')return renderIds.has(id);
 return review.reviewType==='shape-visibility-storage' &&
  /^Tmapv3\.shape\.(Circle|Polyline|Polygon|Rectangle)@_shape_status(?:\.isVisible)?$/.test(id) &&
  review.associatedPublicContracts?.includes(id.split('@')[0]+'#setVisible') &&
  review.sourceUses?.length>0;
}
const validSpan=(e,source,sdkSha)=>e?.sourceSha256===sdkSha&&Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end>e.start&&typeof e.excerpt==='string'&&e.excerpt.length>0&&source.slice(e.start,e.end)===e.excerpt;
function renderGroupValid(group,source,sdkSha){
 if(!group||group.reviewType!=='shape-render-storage'||!renderDigests[group.id]||sha(JSON.stringify(group))!==renderDigests[group.id]||
    !group.owner||!group.rationale||!group.priorReportSearch?.filesSearched?.length||!group.associatedPublicContracts?.length||
    !Array.isArray(group.items)||group.items.length!==8||!validSpan(group.sourceEvidence,source,sdkSha))return false;
 const expected=renderFields.map(f=>`${group.owner}@_shape_data.${f}`).sort();
 if(JSON.stringify(group.items.map(i=>i.api).sort())!==JSON.stringify(expected))return false;
 return group.items.every(i=>renderIds.has(i.api)&&validSpan(i.initializer,source,sdkSha)&&validSpan(i.nativeUse,source,sdkSha));
}
function renderDocsFresh(group,read=fs.readFileSync){
 try{
  if(!group.priorReportSearch.records.every(record=>sha(read(path.join(ROOT,record.file)))===record.sha256))return false;
  const bytes=read(path.join(HERE,'baselines/2026-11-17-production.json'));
  if(sha(bytes)!==group.documentationAudit.baselineManifestSha256)return false;
  const manifest=JSON.parse(bytes.toString()),sources=manifest.sources.filter(s=>['document','reference'].includes(s.kind));
  const selected=sources.map(s=>({url:s.url,sha256:s.sha256})).sort((a,b)=>a.url.localeCompare(b.url));
  if(manifest.id!==reviews.baselineId||sources.length!==group.documentationAudit.scannedCount||sha(JSON.stringify(selected))!==group.documentationAudit.sourceListDigest)return false;
  return sources.every(s=>{const data=read(path.join(HERE,'.cache/sources',s.sha256));return sha(data)===s.sha256&&!data.toString('utf8').includes(group.documentationAudit.literal);});
 }catch{return false;}
}
function renderProof(group,entry,baselineId,sdkSha){
 return {id:group.id,baselineId,sdkSha256:sdkSha,rowSourceHash:entry.rowSourceHash,rationale:group.rationale,
  sourceEvidence:group.sourceEvidence,priorReportSearch:group.priorReportSearch,reviewType:group.reviewType,
  sourceUses:[entry.initializer,entry.nativeUse],associatedPublicContracts:group.associatedPublicContracts,documentationAudit:group.documentationAudit};
}
export function reviewInternalState(rows,manifest,entries=reviews,sourceOverride,read=fs.readFileSync) {
 if(entries.baselineId!==manifest.id)return;
 const sdk=manifest.sources.find(s=>s.kind==='sdk');
 if(sdk?.sha256!==entries.sdkSha256)return;
 const file=path.join(HERE,'.cache/sources',sdk.sha256);
 const source=sourceOverride ?? (fs.existsSync(file)?fs.readFileSync(file,'utf8'):null);
 if(source===null || sha(source)!==sdk.sha256)return;
 for(const group of entries.groups||[]) {
  const ev=group.sourceEvidence;
  if(!group.rationale || !group.priorReportSearch?.filesSearched?.length || !ev || !Number.isInteger(ev.start) || !Number.isInteger(ev.end) || ev.start<0 || ev.end<=ev.start || source.slice(ev.start,ev.end)!==ev.excerpt)continue;
  if(group.reviewType==='shape-render-storage'){
   if(!renderGroupValid(group,source,sdk.sha256)||!renderDocsFresh(group,read))continue;
   for(const row of rows){
    const entry=group.items.find(i=>i.api===row.id&&i.rowSourceHash===rowSourceHash(row));
    if(!entry||row.owner!==group.owner||!reviewedRepresentation(row.id,group)||row.scope!=='undocumented-review-required'||publicEvidence(row)||!Array.isArray(row.contracts)||row.contracts.length||JSON.stringify(row.sourceNames)!==JSON.stringify([row.id]))continue;
    row.status='reviewed-internal-state';row.scopeReview=renderProof(group,entry,manifest.id,sdk.sha256);
    row.platforms={web:'not-applicable-internal-state',android:'not-applicable-internal-state',ios:'not-applicable-internal-state'};
   }
   continue;
  }
  if(group.reviewType==='shape-visibility-storage' && (!group.sourceUses?.length || group.sourceUses.some(e=>
   e.sourceSha256!==sdk.sha256 || source.slice(e.start,e.end)!==e.excerpt)))continue;
  for(const row of rows) {
   const entry=group.items.find(i=>i.api===row.id && i.rowSourceHash===rowSourceHash(row));
   // Only this reviewed representation is eligible; no broad underscore rule.
   if(!entry || !reviewedRepresentation(row.id,group) || row.scope!=='undocumented-review-required' || publicEvidence(row))continue;
   row.status='reviewed-internal-state';
   row.scopeReview={id:group.id,baselineId:manifest.id,sdkSha256:sdk.sha256,rowSourceHash:entry.rowSourceHash,rationale:group.rationale,sourceEvidence:ev,priorReportSearch:group.priorReportSearch,
    ...(group.reviewType?{reviewType:group.reviewType,sourceUses:group.sourceUses,associatedPublicContracts:group.associatedPublicContracts}:{})};
   row.platforms={web:'not-applicable-internal-state',android:'not-applicable-internal-state',ios:'not-applicable-internal-state'};
  }
 }
}
export function validInternalReview(row,report,sourceOverride,read=fs.readFileSync) {
 const p=row.scopeReview;
 if(!(row.status==='reviewed-internal-state' && p?.baselineId===report.baselineId && p.sdkSha256===report.sdkSha256 && p.rowSourceHash===rowSourceHash(row) && !!p.rationale && !!p.sourceEvidence?.excerpt && !!p.priorReportSearch?.filesSearched?.length && row.scope==='undocumented-review-required' && reviewedRepresentation(row.id,p) && !publicEvidence(row)))return false;
 if(p.reviewType!=='shape-render-storage')return true;
 if(JSON.stringify(row.sourceNames)!==JSON.stringify([row.id])||!Array.isArray(row.contracts)||row.contracts.length||Object.keys(row.platforms||{}).length!==3||
    !['web','android','ios'].every(platform=>row.platforms[platform]==='not-applicable-internal-state'))return false;
 try{
  const group=reviews.groups.find(g=>g.id===p.id),entry=group?.items.find(i=>i.api===row.id),source=sourceOverride??read(path.join(HERE,'.cache/sources',report.sdkSha256),'utf8');
  return !!entry&&row.owner===group.owner&&sha(source)===report.sdkSha256&&renderGroupValid(group,source,report.sdkSha256)&&renderDocsFresh(group,read)&&
   JSON.stringify(p)===JSON.stringify(renderProof(group,entry,report.baselineId,report.sdkSha256));
 }catch{return false;}
}
