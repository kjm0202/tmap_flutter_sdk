import fs from 'node:fs';
import path from 'node:path';
import {sha} from './common.mjs';
import {CACHE} from './sources.mjs';
const reviews=JSON.parse(fs.readFileSync(new URL('./resolutions.json',import.meta.url),'utf8'));
const dispatchReviews=JSON.parse(fs.readFileSync(new URL('./dispatch_reviews.json',import.meta.url),'utf8'));
const dispatchPrototypeObservations=JSON.parse(fs.readFileSync(new URL('./dispatch_prototype_observations.json',import.meta.url),'utf8'));
// Reviews resolve individual extraction diagnostics only; they never certify port parity.
export function adjudicate(issues, manifest, entries=reviews) {
  const resolved=[], open=[];
  for(const issue of issues){
    const fingerprint=sha(JSON.stringify(issue));
    const entry=entries.baselineId===manifest.id && entries.items.find(r=>r.fingerprint===fingerprint);
    if(entry && entry.rationale && entry.scope && entry.priorReportSearch?.filesSearched?.length &&
      manifest.sources.some(s=>s.sha256===entry.evidence?.sha256 && s.url===entry.evidence?.source)) {
      resolved.push({...entry,original:issue,status:'RESOLVED_DIAGNOSTIC'});
    } else open.push(issue);
  }
  return {open,resolved};
}

// Only reviewed spelling defects may merge inventory rows. Both original
// spellings remain in sourceNames; a merge never certifies port parity.
export function reviewedMemberAliases(manifest, docs, ast, runtime, mappings, entries=reviews) {
 const aliases={};
 if(entries.baselineId!==manifest.id)return aliases;
 for(const entry of mappings.reviewedMemberAliases||[]) {
  const review=entries.items.find(r=>r.id===entry.reviewId);
  if(!review || review.category!=='upstream-document-defect' || !review.priorReportSearch?.filesSearched?.length ||
    !manifest.sources.some(s=>s.sha256===review.evidence?.sha256 && s.url===review.evidence?.source))continue;
  const [fromOwner,fromName]=entry.from.split('#'),toName=entry.to.split('#')[1];
  if(!docs.rows.some(r=>r.kind==='method' && r.name===fromName &&
     (mappings.documentAliases?.[r.owner]||r.owner)===fromOwner &&
     r.documentAnchor===review.evidence.anchor && r.documentAnchor.endsWith('_'+toName) &&
     r.evidence.some(e=>e.sha256===review.evidence.sha256 && e.source===review.evidence.source)))continue;
  if(!ast.rows.some(r=>r.id===entry.to && r.kind==='method') ||
     !runtime.rows.some(r=>r.id===entry.to && r.kind==='method') ||
     ast.rows.some(r=>r.id===entry.from) || runtime.rows.some(r=>r.id===entry.from))continue;
  aliases[entry.from]=entry.to;
 }
 return aliases;
}

// The docs extractor stores all method references as #members even when a
// pinned example calls a static property. Apply only explicitly reviewed,
// source-bound pairs; this normalizes identity and never verifies behavior.
export function reviewedStaticDispatchAliases(manifest, docs, ast, runtime, mappings,
 entries=dispatchReviews, readSource=hash=>fs.readFileSync(path.join(CACHE,hash),'utf8'),
 prototypeObservations=dispatchPrototypeObservations) {
 const aliases={}, cache=new Map();
 if(entries.baselineId!==manifest.id)return aliases;
 const source=hash=>{if(!cache.has(hash)){try{const text=readSource(hash);cache.set(hash,sha(text)===hash?text:null)}catch{cache.set(hash,null)}}return cache.get(hash)};
 for(const entry of mappings.reviewedStaticDispatchAliases||[]) {
  const review=entries.items.find(r=>r.id===entry.reviewId);
  if(!review || review.category!=='reviewed-document-dispatch' || review.from!==entry.from || review.to!==entry.to ||
     !review.priorReportSearch?.filesSearched?.length || !review.rationale)continue;
  const match=entry.from.match(/^(.+)#([A-Za-z_$][\w$]*)$/);
  if(!match || entry.to!==match[1]+'.'+match[2])continue;
  const d=review.document,s=review.sdk,proof=review.prototypeProof;
  if(!d || !s || proof?.staticType!=='function' || proof?.prototypeType!=='undefined' || !proof.environment ||
     prototypeObservations?.baselineId!==manifest.id || prototypeObservations.sdkSha256!==s.sha256 ||
     sha(JSON.stringify(prototypeObservations))!==proof.observationsSha256 ||
     !prototypeObservations.observations?.some(o=>o.apis?.includes(entry.from)&&o.staticType==='function'&&o.prototypeType==='undefined') ||
     !manifest.sources.some(x=>x.sha256===d.sha256&&x.url===d.source) ||
     !manifest.sources.some(x=>x.sha256===s.sha256&&x.url===s.source))continue;
  const document=source(d.sha256),sdk=source(s.sha256);
  if(!document || !sdk || !Number.isInteger(d.start) || !Number.isInteger(d.end) || d.start<0 || d.end<=d.start ||
     document.slice(d.start,d.end)!==d.call || !Number.isInteger(s.start) || !Number.isInteger(s.end) ||
     s.start<0 || s.end<=s.start || sha(sdk.slice(s.start,s.end))!==s.sourceTextSha256)continue;
  if(review.ownerAlias && (review.docOwner!==review.ownerAlias.from || review.ownerAlias.to!==match[1] ||
     ast.aliases?.[review.ownerAlias.from]!==review.ownerAlias.to ||
     runtime.aliases?.[review.ownerAlias.from]!==review.ownerAlias.to))continue;
  if(!review.ownerAlias && review.docOwner!==match[1])continue;
  const receiver=review.ownerAlias?review.docOwner.split('.').at(-1):review.docOwner;
  if(!d.call.startsWith(receiver+'.'+match[2]+'('))continue;
  const row=docs.rows.find(r=>r.kind==='method' && r.owner===review.docOwner && r.name===match[2] &&
    (d.anchor===null || r.documentAnchor===d.anchor) &&
    r.evidence?.some(e=>e.channel===d.channel&&e.sha256===d.sha256&&e.source===d.source));
  if(!row)continue;
  if(d.anchor!==null){const anchor=document.indexOf('id="'+d.anchor+'"');if(anchor<0 || anchor>d.start || d.start-anchor>1000)continue;}
  const method=ast.rows.find(r=>r.id===entry.to && r.kind==='method' && r.static===true &&
    r.bodySha256===s.bodySha256 && r.evidence?.some(e=>e.sha256===s.sha256&&e.source===s.source&&e.start===s.start&&e.end===s.end));
  if(!method || !runtime.rows.some(r=>r.id===entry.to&&r.kind==='method'&&r.valueType==='function'&&
    r.evidence?.some(e=>e.sha256===s.sha256&&e.source===s.source)) ||
    ast.rows.some(r=>r.id===entry.from) || runtime.rows.some(r=>r.id===entry.from))continue;
  aliases[entry.from]=entry.to;
 }
 return aliases;
}
