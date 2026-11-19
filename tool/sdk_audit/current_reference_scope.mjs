import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {parse} from 'acorn';
import * as walk from 'acorn-walk';
import {load} from 'cheerio';
import {HERE,sha} from './common.mjs';
import {rowSourceHash} from './scope_reviews.mjs';

// Independent current review: neither the historic review nor its row hashes
// authorize these decisions. The comparison is a fixed, tracked receipt.
const comparisonPath=path.resolve(HERE,'../../docs/sdk-audit/checkpoints/2026-11-19/release-navigation-source-comparison.json.gz');
const manifestPath=path.join(HERE,'baselines/production-2026-11-19-46fa62a7bb27.json');
const methodRowsPath=path.join(HERE,'current_reference_method_rows.json');
const methodRowsHash='59706ffd978943a435a1b9b9f736369fdb5ba81985ead9df997fdc04d5206b5f';
const comparisonHash='a8315b9f6ef46d67448c3e880e0d3dd91a0955ffd5fcc822c317bce15f91e5fb';
const manifestHash='49db8bbc0a8bc8c824974a6f38f86473281ad9597fba81de2c616a1ec947e4cd';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const prefix='Tmapv3.extension.TData#';
const sourcePath=h=>path.join(HERE,'.cache/sources',h);
const readBytes=(read,h)=>{const b=read(sourcePath(h));if(sha(b)!==h)throw Error('source digest');return b;};
const unique=(xs)=>new Set(xs).size===xs.length;
function endpointPresent(text,endpoint){
 const needle='/tmap'+endpoint;let at=-1;
 while((at=text.indexOf(needle,at+1))!==-1){const next=text[at+needle.length];if(next===undefined||/[?\s\"'<>#]/.test(next))return true;}
 return false;
}

export function referenceRuntimeReceipt(runtime) {
 return {auth:runtime?.auth,verifiedBootstrapDigest:runtime?.verifiedBootstrapDigest,
  networkScripts:runtime?.networkScripts,phases:runtime?.phases,
  rows:(runtime?.rows||[]).filter(r=>r.id?.startsWith(prefix)&&r.kind==='method'&&r.phase==='loaded')};
}
function identity(m,receipt,core) {
 if(receipt?.auth!=='script-executed'||receipt.verifiedBootstrapDigest!==m.auth.sha256||
    !receipt.phases?.some(p=>p.phase==='loaded'&&p.rows>0)||!Array.isArray(receipt.networkScripts))return false;
 return receipt.networkScripts.some(n=>n.sha256===core.sha256&&n.status===200&&n.pinned===true&&
   m.sources.some(s=>s.url===n.url&&s.sha256===n.sha256&&s.bytes===n.bytes&&['sdk','bootstrap-cdn-versioned-core'].includes(s.kind)));
}
function coreProof(source,bytes,endpoints) {
 const text=bytes.toString('utf8'),tree=parse(text,{ecmaVersion:'latest'}), entries=[], literals=[];
 let owner=null;
 walk.fullAncestor(tree,(n,_state,ancestors)=>{
  if(n.type==='AssignmentExpression'&&n.start===source.methods[0].start&&n.end===source.methods[0].end)
   owner=[...ancestors].reverse().find(a=>a.type==='FunctionExpression'||a.type==='FunctionDeclaration');
  if(n.type==='Literal'&&typeof n.value==='string'&&endpoints.some(e=>n.value.includes(e)))literals.push(n.value);
  if(n.type==='TemplateElement'){const v=n.value.cooked??n.value.raw;if(endpoints.some(e=>v.includes(e)))literals.push(v);}
 });
 if(!owner)return false;
 walk.simple(owner,{AssignmentExpression(n){const l=n.left;
  if(l.type==='MemberExpression'&&l.object.type==='MemberExpression'&&l.object.object.type==='Identifier'&&l.object.object.name==='A'&&l.object.property.name==='prototype'){
   const name=l.computed?(l.property.type==='Literal'?l.property.value:null):l.property.name;
   entries.push({name,start:n.start,end:n.end,node:n});
  }
 }});
 if(source.methods.length!==28||entries.length!==28||!unique(entries.map(x=>x.name))||literals.length||source.namedNavigationLiterals!==0)return false;
 return source.methods.every(m=>{const e=entries.find(x=>x.name===m.name&&x.start===m.start&&x.end===m.end);
  if(!e||sha(text.slice(m.start,m.end))!==m.sha256)return false;
  let opens=[];walk.simple(e.node,{CallExpression(n){if(n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.property.name==='open')opens.push(n);}});
  if(opens.length!==1)return false;let args=opens[0].arguments;
  let routes=[];if(args[1])walk.simple(args[1],{Literal(n){if(typeof n.value==='string'&&n.value.startsWith('/')&&!n.value.startsWith('//'))routes.push(n.value.split('?')[0]);}});
  return args.length>=2&&args[0].type==='Literal'&&args[0].value===m.httpVerb&&text.slice(args[1].start,args[1].end)===m.requestExpression&&same(routes,[m.expectedNamedRoute]);
 });
}
function reportMethods(c,report,receipt,m,reviewedRows) {
 const ms=c.sources[0].methods, loaded=receipt?.rows,source=m.sources.find(s=>s.kind==='sdk'&&s.role===c.sources[0].role&&s.sha256===c.sources[0].sha256)?.url;
 if(!source)return false;
 if(!Array.isArray(loaded)||loaded.length!==28||!unique(loaded.map(r=>r.id)))return false;
 const found=report.rows.filter(r=>r.id?.startsWith(prefix)&&r.kinds?.includes('method')&&r.evidence?.some(e=>e.channel==='ast'||e.channel==='runtime'));
 if(found.length!==28||!unique(found.map(r=>r.id))||reviewedRows.baselineId!==c.manifestId||reviewedRows.rows?.length!==28||!unique(reviewedRows.rows.map(r=>r.id)))return false;
 return ms.every(m=>{let id=prefix+m.name,r=found.find(x=>x.id===id),l=loaded.find(x=>x.id===id);
  return reviewedRows.rows.some(x=>x.id===id&&x.rowSourceHash===rowSourceHash(r))&&same(r?.channels,[...new Set((r?.evidence||[]).map(e=>e.channel))])&&r.evidence?.filter(e=>['ast','runtime'].includes(e.channel)).every(e=>e.sha256===c.sources[0].sha256&&e.source===source)&&l?.kind==='method'&&l.valueType==='function'&&l.phase==='loaded'&&l.evidence?.length===1&&l.evidence?.some(e=>e.channel==='runtime'&&e.phase==='loaded'&&e.sha256===c.sources[0].sha256&&e.source===r?.evidence?.find(a=>a.channel==='ast')?.source)&&
   r?.evidence?.some(e=>e.channel==='ast'&&e.sha256===c.sources[0].sha256&&e.start===m.start&&e.end===m.end)&&
   r.evidence.some(e=>e.channel==='runtime'&&e.sha256===c.sources[0].sha256&&e.phase==='loaded'&&e.source===l.evidence[0].source);
 });
}
function eligible(row,d,entry) {
 return row?.scope==='linked-rest-reference'&&same(row.kinds,['reference-table'])&&same(row.channels,['docs'])&&row.owner===null&&same(row.sourceNames,[entry.id])&&
  ['contracts','observations','dartCandidates','bridgeObservations','boundedPlatformObservations'].every(k=>Array.isArray(row[k])&&!row[k].length)&&
  rowSourceHash(row)===entry.sha256&&row.evidence?.length===1&&row.evidence[0].source===d.url&&row.evidence[0].sha256===d.sha256;
}
function review(c,d,e,heading,table) {return {reviewType:'current-navigation-reference-only',baselineId:c.manifestId,sdkSha256:c.sources[0].sha256,
 comparisonSha256:comparisonHash,reviewDocument:'docs/sdk-audit/reviews/current-rest-navigation-scope-2026-11-19.md',documentUrl:d.url,documentSha256:d.sha256,rowSourceHash:e.sha256,
 endpoints:d.endpoints,heading,headingSha256:sha(JSON.stringify(heading)),table,scope:'outside-named-js-sdk',restVerification:'UNVERIFIED',
 rationale:'This exact linked REST table is not a named endpoint-specific JS member in the reviewed production and example cores; REST service and field behavior remain unverified.'};}

// Recompute the global source and authenticated runtime proof once per report.
// The returned predicate only checks the exact occurrence and evidence per row.
export function currentReferenceValidator(report,read=fs.readFileSync) {
 try {
  const mb=read(manifestPath),cb=read(comparisonPath),rb=read(methodRowsPath);if(sha(mb)!==manifestHash||sha(cb)!==comparisonHash||sha(rb)!==methodRowsHash)return ()=>false;
  const m=JSON.parse(mb),c=JSON.parse(gunzipSync(cb)),reviewedRows=JSON.parse(rb);
  if(m.id!==c.manifestId||report.baselineId!==m.id||report.sdkSha256!==c.sources[0].sha256||c.documents.length!==24||c.documents.reduce((n,d)=>n+d.rows.length,0)!==187||c.sources.length!==2||c.sources[0].role!=='flutter-web-fixed-cdn-versioned-core'||c.sources[1].role!=='documentation-host-example-core'||!identity(m,report.referenceRuntimeEvidence,c.sources[0])||!reportMethods(c,report,report.referenceRuntimeEvidence,m,reviewedRows))return ()=>false;
  const bootstrap=readBytes(read,m.auth.sha256),authSources=m.sources.filter(s=>s.kind==='sdk-script'&&s.role==='official-key-authenticated-bootstrap'&&s.sha256===m.auth.sha256);
  if(m.auth.status!=='independently-captured'||authSources.length!==1||authSources[0].bytes!==bootstrap.length)return ()=>false;
  const menu=readBytes(read,c.menuSha256).toString('utf8');
  if(!m.sources.some(s=>s.kind==='index'&&s.role==='official-documentation-index'&&s.sha256===c.menuSha256&&s.bytes===Buffer.byteLength(menu)))return ()=>false;
  const endpoints=c.documents.flatMap(d=>d.endpoints);
  for(const s of c.sources){const match=m.sources.filter(x=>x.role===s.role&&x.sha256===s.sha256);const bytes=readBytes(read,s.sha256);
   if(match.length!==1||match[0].bytes!==bytes.length||!coreProof(s,bytes,endpoints))return ()=>false;}
  const entries=new Map();
  for(const d of c.documents){let src=m.sources.filter(s=>s.url===d.url&&s.kind==='reference'&&s.role==='linked-rest-reference'&&s.sha256===d.sha256),bytes=readBytes(read,d.sha256),text=bytes.toString('utf8');
   if(src.length!==1||src[0].bytes!==bytes.length||!m.links.some(l=>l.url===d.url&&l.discoveredAt===srcIndex(m,c.menuSha256))||!menu.slice(...d.menuNavSpan).includes('href="#'+new URL(d.url).pathname.replace(/^\//,'').replace(/\.html$/,'')+'"')||!d.endpoints.every(e=>endpointPresent(text,e)))return ()=>false;
   const $=load(text,{sourceCodeLocationInfo:true}),tables=$('table').toArray();if(tables.length!==d.rows.length)return ()=>false;
   let lastHeading=null;const headings=new Map();$('h1,h2,h3,h4,h5,h6,table').each((_,el)=>{if(el.tagName==='table')headings.set(el,lastHeading);else lastHeading={text:$(el).text().replace(/\s+/g,' ').trim(),line:el.sourceCodeLocation?.startLine??null};});
   for(let i=0;i<d.rows.length;i++){let e=d.rows[i],id=`rest-reference:${d.url}:table-${i}`,el=tables[i];
    if(e.id!==id||entries.has(id))return ()=>false;
    const evidence={channel:'docs',source:d.url,sha256:d.sha256,anchor:$(el).attr('id')||null,line:el.sourceCodeLocation?.startLine??null};
    if(rowSourceHash({id,kinds:['reference-table'],channels:['docs'],evidence:[evidence]})!==e.sha256)return ()=>false;
    const start=el.sourceCodeLocation?.startOffset,end=el.sourceCodeLocation?.endOffset;
    if(!Number.isInteger(start)||!Number.isInteger(end)||end<=start)return ()=>false;
    entries.set(id,{d,e,proof:review(c,d,e,headings.get(el)??null,{start,end,sha256:sha(text.slice(start,end))})});
   }
  }
  const byId=new Map();for(const row of report.rows){if(byId.has(row.id))byId.set(row.id,null);else byId.set(row.id,row);}
  const valid=row=>{const x=entries.get(row?.id),candidate=byId.get(row?.id);return !!x&&row.status==='reviewed-reference-only'&&eligible(row,x.d,x.e)&&same(row.referenceScopeReview,x.proof)&&!!candidate&&candidate.status==='reviewed-reference-only'&&eligible(candidate,x.d,x.e)&&same(candidate.referenceScopeReview,row.referenceScopeReview);};
  valid.proofFor=row=>{const x=entries.get(row?.id);return x&&eligible(row,x.d,x.e)&&byId.get(row.id)===row?x.proof:null;};
  // Positive identity is limited to the three historically reviewed method pairs.
  // The expressions retain the dynamic id and query construction from each core.
  valid.namedMethodsPresent=(names,routeLiteral)=>{try{
   const pairs=[
    {names:['transform','transformJson'],route:'/geo/coordconvert',suffix:'',queries:['u.join("&")','u.join("&")']},
    {names:['getGeofencingFromSearch','getGeofencingFromSearchJson'],route:'/geofencing/regions',suffix:'',queries:['u.join("&")','u.join("&")']},
    {names:['getGeofencingFromId','getGeofencingFromIdJson'],route:'/geofencing/regions/',suffix:'t',queries:['a.join("&")','s.join("&")']}
   ];
   const pair=pairs.find(p=>same(p.names,names)&&p.route===routeLiteral);if(!pair)return null;
   if(report.baselineId!==m.id||report.sdkSha256!==c.sources[0].sha256||!identity(m,report.referenceRuntimeEvidence,c.sources[0])||!reportMethods(c,report,report.referenceRuntimeEvidence,m,reviewedRows))return null;
   if(report.referenceRuntimeEvidence.phases.filter(p=>p.phase==='loaded').length!==1||report.referenceRuntimeEvidence.networkScripts.filter(n=>n.sha256===c.sources[0].sha256).length!==1)return null;
   const loaded=report.referenceRuntimeEvidence.rows;
   if(!loaded.every(r=>same(Object.keys(r).sort(),['enumerable','evidence','id','kind','phase','valueType','writable'])&&r.enumerable===true&&r.writable===true&&r.evidence.length===1&&same(Object.keys(r.evidence[0]).sort(),['channel','phase','sha256','source'])))return null;
   const cores=[];
   for(let i=0;i<c.sources.length;i++){
    const s=c.sources[i], selected=[];
    for(const name of pair.names){
     const candidates=s.methods.filter(x=>x.name===name);if(candidates.length!==1)return null;
     const method=candidates[0], expression='A.protocol+"//"+this._requestUrl+"'+pair.route+(pair.suffix?'"+'+pair.suffix+'+"?':'?')+'"+'+pair.queries[i];
     if(method.httpVerb!=='GET'||method.expectedNamedRoute!==pair.route||method.requestExpression!==expression)return null;
     selected.push({...method});
    }
    cores.push({role:s.role,sha256:s.sha256,methodCount:s.methods.length,methods:s.methods.map(x=>({...x})),selectedMethods:selected});
   }
   const activeMethods=c.sources[0].methods.map(method=>{
    const id=prefix+method.name, matching=report.rows.filter(r=>r.id===id), runtime=loaded.filter(r=>r.id===id);
    if(matching.length!==1||runtime.length!==1)throw Error('duplicate or missing method');
    return {id,reportRowSourceHash:rowSourceHash(matching[0]),runtimeRow:structuredClone(runtime[0])};
   });
   return {baselineId:c.manifestId,comparisonSha256:comparisonHash,bootstrapSha256:m.auth.sha256,
    activeCoreSha256:c.sources[0].sha256,names:[...pair.names],httpMethod:'GET',routeLiteral:pair.route,
    dynamicSuffix:pair.suffix||null,cores,activeMethods,wireStatus:'UNVERIFIED'};
  }catch{return null;}};
  // A direct REST path is outside both authenticated 28-method closures only if no
  // named route equals it, no dynamic-id route ('/pois/'+id) prefixes it, and no core literal contains it.
  valid.namedRouteAbsent=endpoint=>{try{
   if(typeof endpoint!=='string'||!/^(\/[A-Za-z0-9_-]+)+$/.test(endpoint))return null;
   const cores=[];
   for(const s of c.sources){const routes=[...new Set(s.methods.map(x=>x.expectedNamedRoute))];
    if(routes.some(r=>typeof r!=='string'||r===endpoint||(r.endsWith('/')&&endpoint.startsWith(r)))||!coreProof(s,readBytes(read,s.sha256),[endpoint]))return null;
    cores.push({role:s.role,sha256:s.sha256,methods:s.methods.length,namedRoutes:routes,endpointLiteralOccurrences:0});}
   return {baselineId:c.manifestId,comparisonSha256:comparisonHash,bootstrapSha256:m.auth.sha256,endpoint,cores};
  }catch{return null;}};
  return valid;
 }catch{return ()=>false;}
}
function srcIndex(m,h){return m.sources.find(s=>s.kind==='index'&&s.sha256===h)?.url;}
export function reviewCurrentReferences(rows,{manifest,runtime}) {
 const receipt=referenceRuntimeReceipt(runtime),report={rows,baselineId:manifest?.id,sdkSha256:manifest?.sources?.find(s=>s.kind==='sdk')?.sha256,referenceRuntimeEvidence:receipt};
 // Validate the supplied manifest itself, not merely its ID.
 try{if(!same(manifest,JSON.parse(fs.readFileSync(manifestPath))))return null;
  const valid=currentReferenceValidator(report);
  for(const row of rows){
   const p=valid.proofFor?.(row);
   if(p&&row.status==='unmapped'){row.status='reviewed-reference-only';row.referenceScopeReview=p;}
   else if(row.referenceScopeReview?.reviewType==='current-navigation-reference-only'&&(!p||!same(p,row.referenceScopeReview))){row.status='unmapped';delete row.referenceScopeReview;}
  }
 }catch{}return receipt;
}
