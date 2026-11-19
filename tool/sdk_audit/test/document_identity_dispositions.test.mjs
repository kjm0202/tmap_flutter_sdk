import test from 'node:test';
import assert from 'node:assert/strict';
import {sha} from '../common.mjs';
import {createDocumentIdentityDisposer, requiresDocumentIdentityEvidence} from '../document_identity_dispositions.mjs';
import {adjudicate} from '../resolutions.mjs';
import fs from 'node:fs';

function fixture({duplicateHeading=false, duplicateAnchor=false, badMenu=false, addTarget=false}={}) {
  const DOC='https://example.test/docs', INDEX='https://example.test/index', SDK='https://example.test/sdk', BOOT='https://example.test/bootstrap';
  const OWNER='Tmapv3.extension.TData', bootstrap='bootstrap', BH=sha(bootstrap);
  const name='getPOIDataFromIdJson', stale='getPOIDataFromIdson', menuName='getAutoCompleteSearchV2Json';
  const heading=`id="Tdata_${name}">${stale}</h4>`, example=`tData.${name}(`;
  let doc=`<h2>Tmapv3.Tdata</h2><h4 ${heading}<code>${example}</code>`;
  if (duplicateHeading) doc+=`<h4 id="other">${stale}</h4>`;
  if (duplicateAnchor) doc+=`<h4 id="Tdata_${name}">other</h4>`;
  if (addTarget) doc+=`<h4 id="Tdata_${menuName}">${menuName}</h4>`;
  const menuExcerpt=`href="#webv3VSM/docs/WebDocs.Tdata_${menuName}">${menuName}</a>`;
  let index=`<li><a id="webv3VSM_docs_WebDocs_Tdata_${menuName}" ${menuExcerpt}</li>`;
  if (badMenu) index += `<li><a ${menuExcerpt}</li>`;
  const prefix=n=>`A.prototype.${n}=function(`;
  const sdk=`${prefix(name)}a){};${prefix(menuName)}a){};`;
  const DH=sha(doc), IH=sha(index), SH=sha(sdk);
  const evidence={channel:'docs',source:DOC,sha256:DH,anchor:`Tdata_${name}`,line:1};
  const issues=[{code:'document-method-name-disagreement',owner:'Tmapv3.Tdata',title:stale,anchorName:name,evidence},
    {code:'broken-menu-anchor',source:DOC,anchor:`Tdata_${menuName}`,label:menuName}];
  const reviews=[{fingerprint:sha(JSON.stringify(issues[0])),name,stale,docStart:doc.indexOf(heading),docEnd:doc.indexOf(heading)+heading.length,exampleStart:doc.indexOf(example),exampleEnd:doc.indexOf(example)+example.length,sdkStart:sdk.indexOf(prefix(name))},
    {fingerprint:sha(JSON.stringify(issues[1])),name:menuName,menuStart:index.indexOf(menuExcerpt),menuEnd:index.indexOf(menuExcerpt)+menuExcerpt.length,sdkStart:sdk.indexOf(prefix(menuName))}];
  const sources=[{url:DOC,kind:'document',sha256:DH,text:doc},{url:INDEX,kind:'index',sha256:IH,text:index},{url:SDK,kind:'sdk',sha256:SH,text:sdk},{url:BOOT,kind:'sdk-script',sha256:BH,text:bootstrap,role:'official-key-authenticated-bootstrap'}];
  const manifest={sources:sources.map(({text,...s})=>s),links:[{url:DOC,anchor:`Tdata_${menuName}`,label:menuName,discoveredAt:INDEX}]};
  const ast={issues:[],rows:reviews.map(r=>({id:`${OWNER}#${r.name}`,kind:'method',static:false,evidence:[{channel:'ast',source:SDK,sha256:SH,start:r.sdkStart,end:r.sdkStart+prefix(r.name).length}]}))};
  const runtime={auth:'script-executed',verifiedBootstrapDigest:BH,issues:[],phases:[{phase:'loaded',rows:2}],networkScripts:[{sha256:SH,bytes:Buffer.byteLength(sdk),status:200,pinned:true,classification:'pinned-core'}],rows:reviews.map(r=>({id:`${OWNER}#${r.name}`,kind:'method',valueType:'function',phase:'loaded',evidence:[{channel:'runtime',source:SDK,sha256:SH,phase:'loaded'}]}))};
  runtime.rows.push({id:`${OWNER}#prototype`,kind:'prototype',valueType:'object',phase:'loaded',evidence:[{channel:'runtime',source:SDK,sha256:SH,phase:'loaded'}]});
  return {input:{issues,manifest,sources,ast,runtime},disposer:createDocumentIdentityDisposer({DOC,INDEX,SDK,BOOT,DH,IH,SH,BH,OWNER,reviews}),name,stale,menuName,OWNER};
}
const run = f => f.disposer(f.input);

test('source-bound dispositions retain original names, unknown target, and do not change inventory or Flutter status',()=>{
  const f=fixture(); const before=structuredClone(f.input); const r=run(f);
  assert.equal(r.resolved.length,2); assert.equal(r.open.length,0);
  assert.deepEqual(f.input,before); assert.deepEqual(r.resolved.map(x=>x.original), f.input.issues);
  assert.ok(r.resolved.every(x=>x.status==='CONFIRMED_UPSTREAM_INCONSISTENCY'));
  assert.match(r.resolved[1].scope,/target unknown/); assert.match(r.resolved[0].rationale,new RegExp(f.stale));
  assert.ok(r.resolved.every(x=>!('flutter' in x) && !('alias' in x) && !('parity' in x)));
});

test('changed or missing pinned source and SDK AST evidence leave issues open',()=>{
  for(const mutate of [f=>f.input.sources[0].text+='x',f=>f.input.sources[1].kind='document',f=>f.input.sources[2].text+='x',f=>f.input.sources.pop(),f=>f.input.ast.issues.push({code:'sdk-parse-failed'}),f=>f.input.ast.rows[0].evidence[0].start++,f=>f.input.ast.rows.push({id:`${f.OWNER}#${f.stale}`})]) {
    const f=fixture(); mutate(f); assert.ok(run(f).open.some(i=>i.code==='document-method-name-disagreement'));
  }
});

test('ambiguous headings, duplicate IDs, duplicate menu links and an existing target stay open even with matching source hashes',()=>{
  for(const options of [{duplicateHeading:true},{duplicateAnchor:true},{badMenu:true},{addTarget:true}]) {
    const f=fixture(options), r=run(f); const code=options.badMenu||options.addTarget?'broken-menu-anchor':'document-method-name-disagreement';
    assert.ok(r.open.some(i=>i.code===code));
  }
});

test('failed, unauthenticated, changed or incomplete runtime cannot confirm a disposition',()=>{
  for(const mutate of [f=>f.input.runtime.auth='failed',f=>f.input.runtime.verifiedBootstrapDigest='other',f=>f.input.runtime.networkScripts[0].sha256='other',f=>f.input.runtime.issues.push({code:'runtime-capture-failed'}),f=>f.input.runtime.issues.push({code:'runtime-reflection-failed'}),f=>f.input.runtime.rows[0].valueType='object',f=>f.input.runtime.rows.push({id:`${f.OWNER}#${f.stale}`,phase:'loaded'}),f=>f.input.runtime.rows=[]]) {
    const f=fixture(); mutate(f); assert.ok(run(f).open.some(i=>i.code==='document-method-name-disagreement'));
  }
});

test('current baseline cannot fall back to older manifest-only reviews',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../baselines/production-2026-11-19-46fa62a7bb27.json',import.meta.url)));
  const source='https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html';
  const issue={code:'document-method-name-disagreement',owner:'Tmapv3.Tdata',title:'getPOIDataFromIdson',anchorName:'getPOIDataFromIdJson',evidence:{channel:'docs',source,sha256:'bae9de2c73bf9be412694e92f26f95007f6d46e81845bf271bd20b1e1481e214',anchor:'Tdata_getPOIDataFromIdJson',line:5570}};
  const legacy=JSON.parse(fs.readFileSync(new URL('../resolutions.json',import.meta.url)));
  assert.equal(adjudicate([issue],manifest).resolved.length,0);
  // Even if a legacy review is later rebound to the current baseline, it must
  // not bypass the source/runtime checks in the report pipeline.
  legacy.baselineId=manifest.id;
  assert.equal(adjudicate([issue],manifest,legacy).resolved.length,1);
  assert.equal(requiresDocumentIdentityEvidence(manifest,issue),true);
  assert.equal(requiresDocumentIdentityEvidence({...manifest,id:'older'},issue),false);
  const filtered=[issue].filter(i=>!requiresDocumentIdentityEvidence(manifest,i));
  assert.equal(adjudicate(filtered,manifest,legacy).resolved.length,0);
});
