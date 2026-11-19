import {comparePointSizeEquals} from './point_size_equals_compare.mjs';
import {compareGeographicEquals} from './geographic_equals_compare.mjs';
import fs from 'node:fs';import path from 'node:path';
import {ROOT,sha} from './common.mjs';
import {rowSourceHash} from './scope_reviews.mjs';
import {validEqualsReview,equalsContracts} from './equals_review_scope.mjs';
import {documentationMismatchReviewSha} from './documentation_mismatch_binding.mjs';
const reviews=JSON.parse(fs.readFileSync(new URL('./documentation_mismatch_reviews.json',import.meta.url),'utf8'));
const dimensions=['inputs-defaults','returns-types','mutation-identity','errors','lifecycle-events','dispatch'];
const platforms=['web','android','ios'];
const readDefault=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
function parentProven(parent,report){
 try {
 const proof=parent?.verification,review=proof?.sourceReview;
 return parent?.status==='verified'&&!parent.proofProblems?.length&&validEqualsReview(review)&&parent.id===review.contract&&proof.scope===review.scope&&
  proof.baselineId===report.baselineId&&proof.libSha256===report.libFingerprint?.sha256&&
  platforms.every(p=>parent.platforms?.[p]==='verified'&&dimensions.every(d=>{
   const rec=report.platformEvidence?.records?.find(r=>r.platform===p&&r.kind==='integration');
   const geographic=parent.id.includes('.LatLng'),all=geographic?rec?.geographicEqualsResults:rec?.geometryEqualsResults;
   if(!rec?.passed||(geographic?compareGeographicEquals:comparePointSizeEquals)(all,all).status!=='bounded-match')return false;
   const actual=all.filter(r=>r.contract===parent.id),ids=actual.map(r=>r.id);
   const refs=proof.platforms?.[p]?.[d];return Array.isArray(refs)&&refs.length>0&&refs.every(id=>report.observations?.some(o=>o.id===id&&o.contract===parent.id&&o.platform===p&&o.status==='sample-match'&&o.dimensions?.includes(d)&&o.count===review.casesPerGetter&&Array.isArray(o.caseIds)&&JSON.stringify(o.caseIds)===JSON.stringify(ids)&&o.actualSha256===sha(JSON.stringify(actual))&&o.platformLog?.file===rec.file&&o.platformLog?.sha256===rec.sha256));
  }));
 }catch{return false;}
}
export function validDocumentationMismatch(row,report){
 const proof=row.documentationMismatch,item=reviews.items.find(i=>i.return.api===row.id);
 if(!proof||!item||sha(JSON.stringify(reviews))!==documentationMismatchReviewSha||!equalsContracts.includes(item.api)||row.scope!=='documented'||
  proof.classification!=='confirmed-docs-code-conflict'||proof.noVerificationCredit!==true||proof.returnDeclarationVerified!==false||
  proof.reviewSha256!==documentationMismatchReviewSha||proof.baselineId!==report.baselineId||proof.libSha256!==report.libFingerprint?.sha256||
  rowSourceHash(row)!==item.return.rowSourceHash||sha(JSON.stringify(row.contracts))!==sha(JSON.stringify(item.return.contracts)))return false;
 const parent=report.rows.find(r=>r.id===item.api);
 return parentProven(parent,report)&&sha(JSON.stringify(proof))===sha(JSON.stringify(expectedMismatch(item,parent,report)));
}
export function attachDocumentationMismatches(report,{manifest,ast},config=reviews,read=readDefault){
 for(const row of report.rows)delete row.documentationMismatch;
 if(sha(JSON.stringify(config))!==documentationMismatchReviewSha||config.baselineId!==manifest.id||report.baselineId!==manifest.id||
  !manifest.sources.some(s=>s.kind==='sdk'&&s.sha256===config.sdkSha256)||!manifest.sources.some(s=>s.sha256===config.docsSource.sha256))return;
 let sdk,doc;try{sdk=read('tool/sdk_audit/.cache/sources/'+config.sdkSha256);doc=read(config.docsSource.file);if(sha(sdk)!==config.sdkSha256||sha(doc)!==config.docsSource.sha256)return;}catch{return;}
 for(const item of config.items){
  const row=report.rows.find(r=>r.id===item.return.api),parent=report.rows.find(r=>r.id===item.api),method=ast.rows.find(r=>r.id===item.api&&r.kind==='method');
  if(!row||row.scope!=='documented'||rowSourceHash(row)!==item.return.rowSourceHash||!parentProven(parent,report)||
   !doc.includes(item.description.excerpt)||!doc.includes(item.return.excerpt)||sdk.slice(item.sdk.start,item.sdk.end)!==item.sdk.excerpt||
   method?.bodySha256!==item.sdk.bodySha256||!method.evidence?.some(e=>e.sha256===config.sdkSha256&&e.start===item.sdk.start&&e.end===item.sdk.end))continue;
  row.documentationMismatch=expectedMismatch(item,parent,report);
 }
}

function expectedMismatch(item,parent,report){return {classification:'confirmed-docs-code-conflict',noVerificationCredit:true,returnDeclarationVerified:false,
   baselineId:report.baselineId,libSha256:report.libFingerprint.sha256,reviewSha256:documentationMismatchReviewSha,
   parentContract:parent.id,parentObservationSha256:sha(JSON.stringify(report.observations.filter(o=>o.contract===parent.id).sort((a,b)=>a.id.localeCompare(b.id)))),parentVerificationSha256:sha(JSON.stringify(parent.verification)),behaviorScope:parent.verification.scope,
   originalDeclaration:item.return.contracts,documentSource:reviews.docsSource,documentExcerpt:item.return.excerpt,
   conflict:item.return.problem,notClaiming:'Upstream intent or an officially corrected specification. The original return declaration remains OPEN.'};}
