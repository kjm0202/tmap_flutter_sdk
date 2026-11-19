import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './common.mjs';
import {validateSdkLatLngBoundsStateDart} from './sdk_latlngbounds_state_compare.mjs';
import {sha} from './common.mjs';
export const sdkBoundsIsEmptyContract="Tmapv3.base.LatLngBounds#isEmpty";
const keys=["contract","variant","sdkBodySha256","sdkEvidence","dartFile","dartMember","dartSignature","dartStatement","scope","dimensions","priorReportSearch","casesPerGetter","caseIds","cases","rowSourceHash","documentation","sourceReviewHash","sdkDependencies","dartDependencies","returnReview"];
const digest="ec03a767c5791a7cbf89828207f13d39ee07ae38d6284559737aa054d1d80c7c";
export function validSdkBoundsIsEmptyReview(review){return !!review&&sha(JSON.stringify(Object.fromEntries(keys.map(k=>[k,review[k]]))))===digest;}

// Recheck source facets and the parent-to-return derivation at the final ledger
// boundary; a canonical review alone must not authenticate a changed row.
import {rowSourceHash} from './scope_reviews.mjs';
const dimensions=['inputs-defaults','returns-types','mutation-identity','errors','lifecycle-events','dispatch'];
const platforms=['web','android','ios'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function methodBound(row,report){
 const p=row?.verification,r=p?.sourceReview;
 return row?.id===sdkBoundsIsEmptyContract&&row.status==='verified'&&!row.proofProblems?.length&&
  row.scope==='documented'&&validSdkBoundsIsEmptyReview(r)&&p.scope===r.scope&&rowSourceHash(row)===r.rowSourceHash&&
  p.baselineId===report.baselineId&&p.libSha256===report.libFingerprint?.sha256&&
  report.platformEvidence?.libFingerprint?.sha256===report.libFingerprint.sha256&&
  platforms.every(platform=>{
   const records=report.platformEvidence.records.filter(x=>x.platform===platform&&x.kind==='integration');
   if(records.length!==1)return false;
   const rec=records[0],all=rec.sdkLatLngBoundsStateResults;
   if(!rec.passed||!validateSdkLatLngBoundsStateDart(all)||typeof rec.file!=='string'||!rec.file.startsWith('docs/sdk-audit/platform-logs/')||rec.file.includes('..'))return false;
   const log=fs.readFileSync(path.join(ROOT,rec.file),'utf8');
   if(sha(log)!==rec.sha256||!(platform==='web'?log.includes('LIVE RESULT: PASS')&&!log.includes('LIVE RESULT: FAIL'):log.includes('All tests passed!')&&!log.includes('Some tests failed.')))return false;
   const parsed=log.split('\n').filter(l=>l.includes('SDK LATLNGBOUNDS STATE RESULT:')).map(l=>JSON.parse(l.split('SDK LATLNGBOUNDS STATE RESULT:')[1]));
   if(!same(parsed,all))return false;
   const actual=all.filter(x=>r.caseIds.includes(x.id)).map(x=>({...x,contract:row.id})),ids=actual.map(x=>x.id);
   if(actual.length!==9||!same([...ids].sort(),[...r.caseIds].sort()))return false;
   return row.platforms?.[platform]==='verified'&&dimensions.every(d=>{
    const refs=p.platforms?.[platform]?.[d];
    return Array.isArray(refs)&&refs.length>0&&refs.every(id=>report.observations?.some(o=>o.id===id&&o.contract===row.id&&o.platform===platform&&o.status==='sample-match'&&o.dimensions?.includes(d)&&o.count===9&&same(o.caseIds,ids)&&o.actualSha256===sha(JSON.stringify(actual))&&same(o.platformLog,{file:rec.file,sha256:rec.sha256})));
   });
  });
}
export function validSdkBoundsIsEmptyRow(row,report){
 try{
  if(row.id===sdkBoundsIsEmptyContract)return methodBound(row,report);
  if(row.id!==sdkBoundsIsEmptyContract+'->return')return false;
  const parent=report.rows.find(r=>r.id===sdkBoundsIsEmptyContract),p=row.verification,r=p?.sourceReview;
  if(!methodBound(parent,report)||!validSdkBoundsIsEmptyReview(r)||row.scope!=='documented'||
   !row.kinds?.includes('return-contract')||!row.contracts?.length||row.contracts.some(c=>!c.includes('{Boolean}'))||
   sha(JSON.stringify({id:row.id,kinds:row.kinds,contracts:row.contracts,evidence:row.evidence}))!==r.returnReview.rowSourceHash||
   p.parentContract!==parent.id||!same(p.sourceReview,parent.verification.sourceReview)||!same(p.returnReview,r.returnReview))return false;
  const expected=structuredClone(parent.verification);expected.parentContract=parent.id;expected.returnReview=r.returnReview;
  for(const platform of platforms)for(const dimension of dimensions){
   const parentRefs=parent.verification.platforms[platform][dimension];
   expected.platforms[platform][dimension]=parentRefs.map(id=>id+':return');
   for(const id of parentRefs){
    const original=report.observations.find(o=>o.id===id),child=report.observations.find(o=>o.id===id+':return');
    if(!same(child,{...original,id:id+':return',contract:row.id,derivedFrom:id}))return false;
   }
  }
  return same(p,expected);
 }catch{return false;}
}
