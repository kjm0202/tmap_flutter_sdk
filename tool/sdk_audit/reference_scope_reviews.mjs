import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { HERE, sha } from './common.mjs';
import { rowSourceHash } from './scope_reviews.mjs';

// This digest pins the complete reviewed set, including source spans, routes,
// navigation evidence and all 187 row fingerprints. It is not a pattern rule.
const CONFIG_SHA256 = 'dbc86a7f3ee5db89f4de178ded9dadc5fc7b6e889e527d3b70e42cf46d14618e';
const CONFIG = path.join(HERE, 'reference_scope_reviews.json');
const BASELINE = path.join(HERE, 'baselines/2026-11-17-production.json');
const cacheFile = hash => path.join(HERE, '.cache/sources', hash);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);

function config(read) {
  const bytes = read(CONFIG);
  if (sha(bytes) !== CONFIG_SHA256) return null;
  const value = JSON.parse(bytes.toString());
  if (value.schemaVersion !== 1 || value.documents.length !== 24 ||
      value.methods.length !== 28 || value.documents.reduce((n,d)=>n+d.rows.length,0)!==187 ||
      value.proof.scope !== 'outside-named-js-sdk' || value.proof.restVerification !== 'UNVERIFIED') return null;
  return value;
}
function baseline(c, supplied, read) {
  const bytes=read(BASELINE);
  if (sha(bytes)!==c.baselineManifestSha256) return null;
  const manifest=JSON.parse(bytes.toString());
  if (manifest.id!==c.baselineId || (supplied && !same(supplied,manifest))) return null;
  if (!manifest.sources.some(s=>s.kind==='sdk'&&s.sha256===c.sdkSha256) ||
      !manifest.sources.some(s=>s.kind==='index'&&s.sha256===c.mainSha256)) return null;
  return manifest;
}
function bytesFor(hash, read) {
  const bytes=read(cacheFile(hash));
  return sha(bytes)===hash ? bytes.toString('utf8') : null;
}
function documentProof(c,manifest,doc,main,read) {
  if (!manifest.sources.some(s=>s.kind==='reference'&&s.url===doc.url&&s.sha256===doc.sha256) ||
      !manifest.links.some(l=>l.url===doc.url&&l.discoveredAt===doc.navigation.source)) return false;
  const source=bytesFor(doc.sha256,read), n=doc.navigation;
  return source!==null && n.sourceSha256===c.mainSha256 &&
    Number.isInteger(n.start)&&Number.isInteger(n.end)&&n.end>n.start&&
    main.slice(n.start,n.end)===n.excerpt && n.excerpt.includes('href=') &&
    doc.endpoints.every(endpoint=>source.includes('/tmap'+endpoint)) &&
    doc.rows.length===doc.tableCount &&
    same(doc.rows.map(r=>r.tableIndex),Array.from({length:doc.tableCount},(_,i)=>i));
}
function sdkProof(c,sdk) {
  if (sha(sdk)!==c.sdkSha256 || sha(sdk.slice(c.namespace.start,c.namespace.end))!==c.namespace.sha256) return false;
  const tree=parse(sdk.slice(c.namespace.start,c.namespace.end),{ecmaVersion:'latest'});
  const registered=[];
  let dynamic=false;
  walk.simple(tree,{AssignmentExpression(n){
    const left=n.left;
    if(left.type!=='MemberExpression'||left.object.type!=='MemberExpression'||
       left.object.object.type!=='Identifier'||left.object.object.name!=='A'||
       left.object.property.name!=='prototype') return;
    const name=left.computed?(left.property.type==='Literal'?left.property.value:null):left.property.name;
    if(typeof name!=='string'){dynamic=true;return;}
    registered.push({name,start:c.namespace.start+n.start,end:c.namespace.start+n.end});
  }});
  if(dynamic || registered.length!==28 || new Set(registered.map(x=>x.name)).size!==28) return false;
  for(const m of c.methods) {
    const entry=registered.find(x=>'Tmapv3.extension.TData#'+x.name===m.api);
    if(!entry||entry.start!==m.start||entry.end!==m.end||sha(sdk.slice(m.start,m.end))!==m.sha256 ||
       sdk.slice(m.open.start,m.open.end)!==m.open.excerpt || !m.open.excerpt.includes('"'+m.route)) return false;
    const method=parse(sdk.slice(m.start,m.end),{ecmaVersion:'latest'});let opens=0;
    walk.simple(method,{CallExpression(n){if(n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.property.name==='open')opens++;}});
    if(opens!==1)return false;
  }
  const endpoints=c.documents.flatMap(d=>d.endpoints);
  const whole=parse(sdk,{ecmaVersion:'latest'});let matched=false;
  walk.simple(whole,{
    Literal(n){if(typeof n.value==='string'&&endpoints.some(e=>n.value.includes(e)))matched=true;},
    TemplateElement(n){const value=n.value.cooked??n.value.raw;if(endpoints.some(e=>value.includes(e)))matched=true;},
  });
  return !matched;
}
function extractionProof(c,ast,runtime) {
  if(!Array.isArray(ast?.rows)||!Array.isArray(runtime?.rows))return false;
  const methods=ast.rows.filter(r=>r.kind==='method'&&r.id.startsWith('Tmapv3.extension.TData#'));
  if(methods.length!==28 || new Set(methods.map(r=>r.id)).size!==28)return false;
  const loaded=runtime.rows.filter(r=>r.kind==='method'&&r.phase==='loaded'&&r.id.startsWith('Tmapv3.extension.TData#'));
  if(loaded.length!==28 || new Set(loaded.map(r=>r.id)).size!==28)return false;
  return c.methods.every(m=>methods.some(r=>r.id===m.api&&r.evidence?.some(e=>e.channel==='ast'&&e.sha256===c.sdkSha256&&e.start===m.start&&e.end===m.end))&&
    loaded.some(r=>r.id===m.api&&r.valueType==='function'&&r.evidence?.some(e=>e.channel==='runtime'&&e.sha256===c.sdkSha256&&e.phase==='loaded')));
}
function reportMethodsProof(c,report) {
  if(!Array.isArray(report?.rows))return false;
  const loaded=report.rows.filter(r=>r.id.startsWith('Tmapv3.extension.TData#')&&
    r.kinds?.includes('method')&&r.evidence?.some(e=>e.channel==='runtime'&&e.phase==='loaded'));
  const statics=report.rows.filter(r=>r.id.startsWith('Tmapv3.extension.TData#')&&
    r.kinds?.includes('method')&&r.evidence?.some(e=>e.channel==='ast'));
  if(loaded.length!==28||statics.length!==28)return false;
  return c.methods.every(m=>report.rows.some(r=>r.id===m.api&&r.kinds?.includes('method')&&
    r.evidence?.some(e=>e.channel==='ast'&&e.sha256===c.sdkSha256&&e.start===m.start&&e.end===m.end)&&
    r.evidence?.some(e=>e.channel==='runtime'&&e.sha256===c.sdkSha256&&e.phase==='loaded')));
}
function getEntry(c,id) {
  for(const doc of c.documents) for(const entry of doc.rows)
    if(id===`rest-reference:${doc.url}:table-${entry.tableIndex}`) return {doc,entry};
  return null;
}
function proof(c,doc,entry) {
  return {reviewType:'navigation-reference-only',baselineId:c.baselineId,sdkSha256:c.sdkSha256,
    configSha256:CONFIG_SHA256,rowSourceHash:entry.rowSourceHash,documentUrl:doc.url,
    documentSha256:doc.sha256,tableIndex:entry.tableIndex,restVerification:'UNVERIFIED',
    scope:'outside-named-js-sdk'};
}
function eligible(row,entry) {
  return row?.scope==='linked-rest-reference'&&row.kinds?.includes('reference-table')&&
    row.owner===null&&same(row.sourceNames,[row.id])&&
    ['contracts','observations','dartCandidates','bridgeObservations','boundedPlatformObservations']
      .every(key=>Array.isArray(row[key])&&row[key].length===0)&&
    rowSourceHash(row)===entry.rowSourceHash;
}

/// Marks only the exact source-reviewed navigation references. Independent REST
/// support, response schema and live verification are explicitly unverified.
export function reviewReferenceOnly(rows,{manifest,ast,runtime,read=fs.readFileSync}) {
  try {
    const c=config(read),m=c&&baseline(c,manifest,read);if(!m)return;
    const sdk=bytesFor(c.sdkSha256,read),main=bytesFor(c.mainSha256,read);
    if(!sdk||!main||!sdkProof(c,sdk)||!extractionProof(c,ast,runtime)||
       !c.documents.every(d=>documentProof(c,m,d,main,read)))return;
    const byId=new Map(rows.map(r=>[r.id,r]));
    if(byId.size!==rows.length)return;
    const targets=c.documents.flatMap(doc=>doc.rows.map(entry=>({doc,entry,row:byId.get(`rest-reference:${doc.url}:table-${entry.tableIndex}`)})));
    if(targets.length!==187||!targets.every(({row,doc,entry})=>eligible(row,entry)&&
      (row.status==='unmapped'||(row.status==='reviewed-reference-only'&&same(row.referenceScopeReview,proof(c,doc,entry))))))return;
    for(const {row,doc,entry} of targets){
      row.status='reviewed-reference-only';
      row.referenceScopeReview=proof(c,doc,entry);
    }
  } catch { /* Any missing or changed evidence leaves every row untouched. */ }
}

/// Revalidates the exact reviewed row against immutable configuration and source
/// bytes, plus the SDK method evidence in the report being adjudicated.
export function validReferenceReview(row,report,read=fs.readFileSync) {
  if(row?.status!=='reviewed-reference-only')return false;
  try {
    const c=config(read),m=c&&baseline(c,null,read);
    if(!m||report?.baselineId!==c.baselineId||report?.sdkSha256!==c.sdkSha256 ||
       !reportMethodsProof(c,report))return false;
    const found=getEntry(c,row.id);if(!found||!eligible(row,found.entry))return false;
    if(!report.rows.some(r=>r.id===row.id&&r.status===row.status&&eligible(r,found.entry)&&
       rowSourceHash(r)===found.entry.rowSourceHash&&same(r.referenceScopeReview,row.referenceScopeReview)))return false;
    const sdk=bytesFor(c.sdkSha256,read),main=bytesFor(c.mainSha256,read);
    if(!sdk||!main||sha(sdk.slice(c.namespace.start,c.namespace.end))!==c.namespace.sha256||
       !documentProof(c,m,found.doc,main,read))return false;
    return same(row.referenceScopeReview,proof(c,found.doc,found.entry));
  } catch { return false; }
}
